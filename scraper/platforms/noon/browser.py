"""
scraper/browser.py

Two responsibilities:
  1. Browser infrastructure — launch Patchright and create contexts
     (get_browser, get_context, handle_route — existing, modified)
  2. Session bootstrap — drive a real browser visit to noon.com,
     let Akamai sensors execute naturally, extract every cookie and
     header value needed for subsequent curl_cffi API calls.
     (bootstrap_session — new)

WHY A REAL BROWSER FOR BOOTSTRAP:
  Akamai Bot Manager generates its bm_* cookies by running a
  JavaScript sensor inside a real browser. That sensor collects
  mouse events, canvas fingerprints, WebGL data, audio fingerprints,
  and dozens of other signals. The result is an encrypted blob stored
  in bm_sv/bm_ss/ak_bmsc. There is no way to fake these without
  executing the sensor in a real JS engine. Patchright gives us that
  real engine with all automation signals patched out.

  Once we have valid bm_* cookies, all subsequent requests use
  curl_cffi (pure HTTP) — no browser needed until the session expires.

RESOURCE BLOCKING STRATEGY:
  Block: image, media, font
    → These contribute nothing to session generation.
    → Blocking them cuts page load time by ~70%.
    → Web fonts are blocked safely — Akamai's canvas fingerprint
      uses SYSTEM fonts (measured via JS), not CDN font files.
  Allow: document, script, stylesheet, xhr, fetch
    → Scripts MUST load — Akamai sensor is a JS file.
    → XHR/fetch MUST work — whoami call is how we know sensor ran.

ABORT-ON-WHOAMI STRATEGY:
  We navigate with wait_until="commit" so goto() returns the instant
  the server starts responding. The browser continues loading scripts
  in the background. We listen for the whoami response — that tells us
  Akamai's sensor has executed and noon's frontend has initialised.
  Once whoami fires we call window.stop() to halt further loading.
  This is faster than waiting for networkidle and more precise than
  a fixed sleep.
"""

import asyncio
import base64
import json
import logging
import random
from datetime import datetime, timedelta,timezone
from typing import Optional
from urllib.parse import unquote
from typing import Sequence,Mapping

from patchright.async_api import async_playwright, Browser, BrowserContext, Page

from app.config import settings
from scraper.platforms.noon.utils import fetch_header_pool

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

# These three Akamai cookies MUST be present after bootstrap.
# If any are missing, the sensor did not execute — hard failure.
REQUIRED_AKAMAI = frozenset({"bm_sv", "bm_ss", "ak_bmsc"})

# These noon cookies MUST be present for API calls to work.
REQUIRED_NOON = frozenset({"nguestv2", "visitor_id"})

# Fallback UA when ScrapeOps returns no Windows desktop entries.
# Chrome 146 matches our curl_cffi impersonation target exactly.
FALLBACK_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)

# noon homepage — never go straight to a search or product page
# on bootstrap. Akamai expects homepage as entry point.
NOON_HOME = "https://www.noon.com/uae-en/"

# URL fragment that identifies the whoami call in network traffic
WHOAMI_URL_FRAGMENT = "whoami/noon"


# WHOAMI_URL = "https://www.noon.com/_vs/st/st-whoami-api-web/whoami/noon"

# Cookies from third-party domains — never send these to noon.com
# Defined here for Phase 2 whoami header building.
THIRD_PARTY_COOKIES = frozenset({
    "bcookie", "lidc", "bh",           # LinkedIn
    "IDE",                              # Google DoubleClick
    "CLID",                             # Microsoft
    "TapAd_3WAY_SYNCS", "TapAd_DID", "TapAd_TS",   # TapAd
    "yabs-sid", "yandexuid", "yashr", "ymex", "yuidss",  # Yandex
    "receive-cookie-deprecation",       # Chrome testing
})

import re
import secrets

def _generate_sentry_headers() -> tuple[str, str]:
    trace_id  = secrets.token_hex(16)
    span_id   = secrets.token_hex(8)
    replay_id = secrets.token_hex(16)
    sentry_trace = f"{trace_id}-{span_id}-0"
    baggage = (
        f"sentry-environment=cloudrun,"
        f"sentry-release=com%404.1.48,"
        f"sentry-public_key=7b7a99a633ce48be2de6269da900186c,"
        f"sentry-trace_id={trace_id},"
        f"sentry-replay_id={replay_id},"
        f"sentry-sample_rate=0.1,"
        f"sentry-sampled=false"
    )
    return sentry_trace, baggage


def _derive_sec_ch_ua(user_agent: str) -> str:
    match = re.search(r"Chrome/(\d+)\.", user_agent)
    version = match.group(1) if match else "146"
    return (
        f'"Chromium";v="{version}", '
        f'"Google Chrome";v="{version}", '
        f'"Not/A)Brand";v="99"'
    )


FALLBACK_ZONECODE    = "AE_DXB-S14"
FALLBACK_ROCKET_ZONE = "W00068765A"
FALLBACK_LAT         = "251998495"
FALLBACK_LNG         = "552715985"
WHOAMI_URL           = "https://www.noon.com/_vs/st/st-whoami-api-web/whoami/noon"


SENTRY_ENVIRONMENT = "cloudrun"
SENTRY_RELEASE     = "com%404.1.48"
SENTRY_PUBLIC_KEY  = "7b7a99a633ce48be2de6269da900186c"
SENTRY_SAMPLE_RATE = "0.1"

# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM EXCEPTION
# ─────────────────────────────────────────────────────────────────────────────

class BootstrapError(Exception):
    """
    Raised when the browser bootstrap cannot produce a valid session.

    Hard failures (missing Akamai cookies, browser crash) raise this.
    session_manager catches it and triggers a proxy rotation + retry.

    Soft failures (whoami timeout but cookies partially present) do NOT
    raise this — they return whatever was collected and let
    session_manager decide whether it is usable via health_check().
    """


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_windows_ua(headers_pool: list[dict]) -> str:
    """
    Filters the ScrapeOps header pool to Windows desktop entries only.

    We strictly want Windows + desktop because:
      - Mobile UAs trigger noon's mobile API (different response format)
      - x-content: desktop header we send would mismatch a mobile UA
      - Mac UAs are fine technically but rarer in the Middle East
        — Windows dominates UAE desktop market share

    sec-ch-ua-mobile "?0"  = desktop (not mobile)
    sec-ch-ua-platform contains '"Windows"' (note the surrounding quotes
    — that is how Chrome serialises this header value)
    """
    windows_desktop = [
        h for h in headers_pool
        if h.get("sec-ch-ua-mobile") == "?0"
        and '"Windows"' in h.get("sec-ch-ua-platform", "")
    ]

    if windows_desktop:
        chosen = random.choice(windows_desktop)
        ua = chosen.get("user-agent", FALLBACK_UA)
        logger.debug(f"[UA] Selected from ScrapeOps pool: {ua[:80]}")
        return ua

    logger.warning(
        "[UA] No Windows desktop entries in ScrapeOps pool. "
        "Using fallback Chrome 146 UA."
    )
    return FALLBACK_UA


def _extract_cookies(cookie_list: list[dict]) -> dict[str, str]:
    """
    Converts Playwright's cookie list (list of dicts with 'name'/'value')
    into a simple name→value dict for easy access.

    Note: if the same cookie name appears multiple times (e.g. nguestv2
    which refreshes during the whoami call), the LAST occurrence wins.
    This is intentional — we always want the most recently issued value.
    """
    result = {}
    for cookie in cookie_list:
        result[cookie["name"]] = cookie["value"]
    return result


def _validate_cookies(cookies: dict[str, str]) -> None:
    """
    Validates that all critical cookies are present after bootstrap.

    Akamai cookies missing → sensor did not run → hard failure.
    Noon cookies missing   → session not initialised → hard failure.

    Raises BootstrapError with actionable message so session_manager
    knows exactly what went wrong.
    """
    missing_akamai = REQUIRED_AKAMAI - set(cookies)
    if missing_akamai:
        raise BootstrapError(
            f"Akamai sensor cookies missing: {missing_akamai}. "
            f"Sensor JS likely did not execute — possible JS block "
            f"or proxy issue. Rotate proxy and retry."
        )

    missing_noon = REQUIRED_NOON - set(cookies)
    if missing_noon:
        raise BootstrapError(
            f"Noon session cookies missing: {missing_noon}. "
            f"Whoami call may have failed silently."
        )

    logger.debug(
        f"[Cookies] Validation passed. "
        f"Total cookies collected: {len(cookies)}."
    )


def _decode_whoami_data(raw_value: str) -> dict:
    """
    Decodes the x-whoami-data cookie into a usable dict.

    The cookie contains a base64url-encoded JSON blob. When retrieved
    from Playwright's context.cookies(), the value may be URL-encoded
    (percent-encoded) depending on how noon set it.

    We unquote first, then base64-decode, then JSON-parse.

    The decoded structure (relevant part):
      {
        "headers": {
          "x-ab-test": [2921, 2840, ...],   ← A/B test group assignments
          "x-ecom-zonecode": "AE_DXB-S14",  ← Location zone
          "x-lat": "251998495",              ← Latitude (scaled int)
          "x-lng": "552715985",              ← Longitude (scaled int)
          "x-rocket-zonecode": "W00068765A", ← Rocket delivery zone
          "x-border-enabled": true,
          "x-mp-country": "ae",
          "x-rocket-enabled": true
        },
        ...
      }

    Returns the "headers" sub-dict, or {} on any decode failure.
    We do NOT raise on failure — missing x-headers degrade gracefully
    (session_manager will use fallback values for the x- headers).
    """
    try:
        # Step 1: URL-decode percent-encoded characters
        unquoted = unquote(raw_value)

        # Step 2: Normalise base64 padding
        # base64 strings must be a multiple of 4 chars
        remainder = len(unquoted) % 4
        if remainder:
            unquoted += "=" * (4 - remainder)

        # Step 3: Decode (urlsafe handles both + and - variants)
        raw_bytes = base64.urlsafe_b64decode(unquoted)
        data = json.loads(raw_bytes.decode("utf-8"))

        headers = data.get("headers", {})
        logger.debug(
            f"[Whoami] Decoded successfully. "
            f"x-ab-test length: {len(headers.get('x-ab-test', []))}. "
            f"Zonecode: {headers.get('x-ecom-zonecode')}."
        )
        return headers

    except Exception as exc:
        logger.warning(f"[Whoami] Decode failed: {exc}. Will use defaults.")
        return {}


def _decode_jwt_expiry(token: str) -> datetime:
    """
    Decodes the nguestv2 JWT to extract its expiry timestamp.

    JWT format: base64url(header) . base64url(payload) . signature
    We only need the payload — no signature verification required.
    We are not validating the token, just reading its exp field.

    The payload looks like:
      {"kid": "be023cff...", "iat": 1779970182, "exp": 1779970482}
    Lifetime = exp - iat = 300 seconds (5 minutes).

    If decode fails (malformed token), we return utcnow() + 4 minutes
    as a conservative fallback so the next health_check() triggers
    a refresh before the real expiry.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError(f"Unexpected JWT part count: {len(parts)}")

        payload_b64 = parts[1]
        # Normalise padding
        remainder = len(payload_b64) % 4
        if remainder:
            payload_b64 += "=" * (4 - remainder)

        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        exp_unix = payload["exp"]

        expiry = datetime.fromtimestamp(exp_unix,tz=timezone.utc)

        issued_at = datetime.fromtimestamp(payload['iat'], tz=timezone.utc)


        logger.debug(
            f"[JWT] Decoded. "
            f"Issued: {datetime.utcfromtimestamp(payload['iat']).strftime('%H:%M:%S')} UTC. "
            f"Expires: {expiry.strftime('%H:%M:%S')} UTC. "
            f"Lifetime: {payload['exp'] - payload['iat']}s."
        )
        return expiry

    except Exception as exc:
        fallback = datetime.now(timezone.utc)+ timedelta(seconds=240)
        logger.warning(
            f"[JWT] Decode failed ({exc}). "
            f"Using conservative fallback expiry: "
            f"{fallback.strftime('%H:%M:%S')} UTC."
        )
        return fallback


async def _human_simulation(page: Page) -> None:
    """
    Performs realistic human-like interactions while the page loads.

    This serves two purposes:
      1. Akamai's sensor specifically checks for mouse/scroll events.
         A page with zero interaction events is a strong bot signal.
      2. The timing between actions mimics human reaction time and
         reading behaviour — not perfectly uniform, not instantaneous.

    Mouse moves use `steps` parameter which controls how many
    intermediate mousemove events are dispatched. More steps =
    smoother movement = more realistic. Real human mouse paths are
    curved and multi-step, never single-jump teleports.

    page.mouse.wheel() fires a real wheel event (same as physical
    scroll wheel). More authentic than window.scrollBy() because it
    goes through the same browser event stack as real user input.

    All timing values are random within observed human ranges:
      Reaction time:    800ms – 1600ms  (time to first interaction)
      Mouse move time:  matched to `steps` × ~30ms per step
      Scroll:           one natural wheel movement
      Reading pause:    400ms – 1100ms  (eyes moving across content)
    """
    viewport = page.viewport_size or {"width": 1366, "height": 768}
    w, h = viewport["width"], viewport["height"]

    # ── Reaction pause — nobody moves instantly after page starts loading ──
    await asyncio.sleep(random.uniform(0.8, 1.6))

    # ── Cookie consent dialog — must click before whoami fires ─────────────
    # Noon holds the whoami call until the user responds to this dialog.
    # # Without this click, nguestv2 is never issued regardless of timeout.
    # try:
    #     accept_button = page.locator("button:has-text('ACCEPT ALL')")
    #     if await accept_button.is_visible(timeout=8000):
    #         # Small pause before clicking — real users read the dialog briefly
    #         await asyncio.sleep(random.uniform(0.6, 1.2))
    #         await accept_button.click()
    #         logger.info("[HumanSim] Cookie consent accepted.")
    #         # Give noon's JS a moment to process the consent and fire whoami
    #         await asyncio.sleep(random.uniform(1.0, 1.8))
    # except Exception:
    #     # Dialog not present or already accepted — not a failure
    #     logger.debug("[HumanSim] No cookie consent dialog found. Continuing.")

    # ── Mouse move 1: upper area (header / navigation region) ─────────────
    # Real users look at the header first — logo, search bar, menu
    await page.mouse.move(
        x=random.randint(120, w - 120),
        y=random.randint(60, h // 3),
        steps=random.randint(10, 18),    # smooth multi-point path
    )
    await asyncio.sleep(random.uniform(0.5, 1.1))

    # ── Natural scroll — curious about what's below the fold ──────────────
    # wheel() parameters: (delta_x, delta_y) — vertical scroll only
    scroll_px = random.randint(90, 220)
    await page.mouse.wheel(0, scroll_px)
    await asyncio.sleep(random.uniform(0.4, 0.9))

    # ── Mouse move 2: middle content area ─────────────────────────────────
    # Eyes shift from nav to content after scrolling
    await page.mouse.move(
        x=random.randint(200, w - 200),
        y=random.randint(h // 3, int(h * 0.65)),
        steps=random.randint(7, 14),
    )
    await asyncio.sleep(random.uniform(0.3, 0.8))

    # ── Optional third move: random explore ───────────────────────────────
    # 60% chance — real users don't all behave identically
    if random.random() < 0.60:
        await page.mouse.move(
            x=random.randint(80, w - 80),
            y=random.randint(h // 4, int(h * 0.75)),
            steps=random.randint(5, 11),
        )
        await asyncio.sleep(random.uniform(0.2, 0.6))

    logger.debug("[HumanSim] Mouse simulation complete.")


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING FUNCTIONS (modified)
# ─────────────────────────────────────────────────────────────────────────────

async def get_browser(headless: bool = False):
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=headless,
        args=[
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-http2",
            # Chromium cannot handle HTTP/2 through HTTP CONNECT proxy.
            # curl_cffi does not have this limitation — it uses libcurl
            # which tunnels H2 correctly. This flag is browser-only.
        ],
    )
    logger.info(f"[Browser] Patchright launched (headless={headless}).")
    return playwright, browser

async def get_context(
    browser: Browser,
    user_agent: str,
    proxy: Optional[dict] = None,
) -> BrowserContext:
    """
        Creates a browser context that precisely mimics a UAE-based
        Windows Chrome user.

    VIEWPORT — 1366x768:
      Most common global screen resolution (StatCounter).
      Akamai's sensor reads window.screen.width/height.
      1280x800 (old default) is less common and slightly unusual.

    LOCALE — en-US:
      navigator.language returns "en-US" for English Chrome installs,
      even when the user is physically in the UAE. Real expats and
      tourists have English browser installs. Using "en-AE" would be
      unusual and a fingerprint signal. The AE context comes from
      the proxy IP and noon's cookies, not the browser locale.

    TIMEZONE — Asia/Dubai:
      Matches our UAE proxy IP. Timezone mismatch (e.g. UTC while
      appearing to be in Dubai) is a clear bot signal.

    GEOLOCATION — Dubai city centre:
      Consistent with the proxy IP location. Akamai's sensor can
      read this via the Geolocation API if the site requests it.

    extra_http_headers ONLY contains accept-language:
      We do NOT set 'accept' here because it differs between
      navigation requests (text/html) and XHR (application/json).
      Chrome manages this correctly on its own. handle_route()
      injects the per-request-type values at route level.
    """
    effective_proxy = proxy or getattr(settings, "PROXY", None)

    context_options = {
        "user_agent": user_agent,
        "viewport": {"width": 1366, "height": 768},
        "locale": "en-US",
        "timezone_id": "Asia/Dubai",
        "geolocation": {"latitude": 25.2048, "longitude": 55.2708},
        "permissions": ["geolocation"],
        "extra_http_headers": {
            "accept-language": "en-US,en;q=0.9",
        },
    }

    if effective_proxy:
        context_options["proxy"] = effective_proxy
        server = effective_proxy.get("server", "unknown")
        logger.info(f"[Context] Proxy attached: {server}")
    else:
        logger.info(
            "[Context] No proxy — using direct connection for browser bootstrap. "
            "UAE proxy applies to curl_cffi API calls only."
        )
    context = await browser.new_context(**context_options)

    # Route ALL requests through handle_route for resource blocking
    # and per-request-type header injection.
    await context.route("**/*", handle_route)

    logger.info(
        f"[Context] Created. "
        f"UA: {user_agent[:70]}... "
        f"Viewport: 1366x768. TZ: Asia/Dubai."
    )
    return context


async def handle_route(route) -> None:
    """
    Intercepts every browser request and applies two behaviours:

    1. ABORT blocked resource types:
       image, media, font — not needed for session generation.
       Aborting them cuts page load time significantly.
       font files are safe to block: Akamai's canvas fingerprint
       measures system fonts via JS text rendering, NOT loaded font files.

    2. INJECT per-request-type headers:
       Navigation requests need text/html accept + navigate sec-fetch-*.
       XHR/fetch requests need application/json accept + cors sec-fetch-*.
       Chrome manages this automatically — we mirror that exact behaviour
       so Patchright's requests look identical to a real Chrome browser.

    This is applied at context level (not page level) so it covers
    ALL pages opened in this context.
    """
    request = route.request
    resource_type = request.resource_type

    # ── Block heavy/unnecessary resources ─────────────────────────────────
    if resource_type in ("image", "media", "font"):
        await route.abort()
        return

    # ── Inject per-request-type headers ───────────────────────────────────
    extra_headers: dict[str, str] = {}

    if resource_type in ("xhr", "fetch"):
        # API calls — what Chrome sends for XHR/fetch requests
        extra_headers["accept"] = "application/json, text/plain, */*"
        extra_headers["sec-fetch-dest"] = "empty"
        extra_headers["sec-fetch-mode"] = "cors"
        extra_headers["sec-fetch-site"] = "same-origin"
        # noon-specific headers present on all internal API calls
        extra_headers["x-locale"] = "en-ae"
        extra_headers["x-platform"] = "web"
        extra_headers["x-mp-country"] = "ae"
        extra_headers["x-content"] = "desktop"

    # Merge injected headers with whatever the browser already set.
    # extra_headers takes priority (right-side wins on dict merge).
    await route.continue_(headers={**request.headers, **extra_headers})


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BOOTSTRAP FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

# async def bootstrap_session(proxy_dict: dict, proxy_url: str) -> dict:
#     """
#     Runs the full browser bootstrap to produce a valid Akamai session.

#     Called by session_manager on startup and on session expiry.
#     Returns a raw dict — session_manager wraps it in a SessionBundle.

#     Parameters:
#       proxy_dict : Patchright-format proxy {"server", "username", "password"}
#       proxy_url  : curl_cffi-format URL "http://user:pass@host:port"

#     Returns dict with keys:
#       cookies        : {name: value} for all browser cookies
#       user_agent     : UA string used by the browser (use same in curl_cffi)
#       x_headers      : decoded x-whoami-data headers dict
#       jwt_token      : latest nguestv2 JWT string
#       jwt_expiry     : datetime when nguestv2 expires
#       bootstrap_time : datetime.utcnow() at completion
#       proxy_dict     : the patchright proxy dict (stored for reference)
#       proxy_url      : the curl proxy URL (stored for reference)

#     Raises:
#       BootstrapError : on hard failures (missing Akamai cookies, crash)
#                        session_manager catches this and rotates proxy.
#     """
#     playwright = None
#     browser = None

#     try:
#         # ── Step 1: Get a realistic Windows UA ────────────────────────────
#         # fetch_header_pool() is your existing ScrapeOps utility.
#         # We filter its output to Windows desktop Chrome only.
#         try:
#             pool = await fetch_header_pool()
#             user_agent = _get_windows_ua(pool)
#         except Exception as exc:
#             logger.warning(
#                 f"[Bootstrap] ScrapeOps pool fetch failed ({exc}). "
#                 f"Using fallback UA."
#             )
#             user_agent = FALLBACK_UA

#         logger.info("[Bootstrap] Starting browser session bootstrap.")
#         logger.info(f"[Bootstrap] UA: {user_agent[:80]}")
#         logger.info(
#             f"[Bootstrap] Proxy: "
#             f"{proxy_dict.get('server', 'unknown')}"
#         )

#         # ── Step 2: Launch browser and create context ─────────────────────
#         playwright, browser = await get_browser(headless=False)
#         context = await get_context(browser, user_agent, proxy=proxy_dict)
#         # context = await get_context(browser, user_agent, proxy=None)
#         page = await context.new_page()

#         # ── Step 3: Register whoami listener BEFORE navigation ────────────
#         # Critical: if registered after goto(), whoami might fire
#         # before the listener is attached — race condition.
#         whoami_fired = asyncio.Event()

#         async def _on_response(response) -> None:
#             """Fires for every network response. We only care about whoami."""
#             if WHOAMI_URL_FRAGMENT in response.url and response.status == 200:
#                 logger.debug(
#                     f"[Bootstrap] Whoami response intercepted: "
#                     f"{response.url[:80]}"
#                 )
#                 whoami_fired.set()

#         page.on("response", _on_response)

#         # ── Step 4: Navigate (return immediately on commit) ───────────────
#         # "commit" = fires the instant the server's first bytes arrive.
#         # The page continues loading scripts in the background.
#         # This lets us start human simulation before full load.
#         logger.info("[Bootstrap] Navigating to noon homepage...")
#         await page.goto(
#             NOON_HOME,
#             wait_until="domcontentloaded",  # scripts have started loading
#             timeout=65_000,                 # more time for slow proxy
#         )
#         logger.debug("[Bootstrap] DOM loaded. Scripts initialising...")

#         # ── Step 5: Wait for page to be fully interactive ─────────────────────
#         # domcontentloaded fires before JS finishes rendering components.
#         # The cookie dialog and whoami call both require JS to finish.
#         # networkidle waits until no network requests for 500ms — by that
#         # point all JS components including the consent dialog are rendered.
#         try:
#             await page.wait_for_load_state("networkidle", timeout=15_000)
#         except Exception:
#             # networkidle timeout is non-fatal — page may still be usable
#             logger.debug("[Bootstrap] networkidle timeout — continuing anyway.")

#         # Give JS one extra second to render React components
#         await asyncio.sleep(1.5)

#         # ── Step 6: Click cookie consent (MUST happen before whoami fires) ─────
#         # Noon's frontend holds the whoami API call until the user responds
#         # to the cookie consent dialog. This is not optional.
#         try:
#             # Try multiple selectors — noon may use different button text/attributes
#             consent_selectors = [
#                 "button:has-text('ACCEPT ALL')",
#                 "button:has-text('Accept All')",
#                 "button:has-text('Accept all')",
#                 "[data-testid='cookie-accept']",
#                 ".cookie-banner button:first-child",
#                 "button.accept-cookies",
#             ]

#             clicked = False
#             for selector in consent_selectors:
#                 try:
#                     btn = page.locator(selector).first
#                     if await btn.is_visible(timeout=3_000):
#                         await asyncio.sleep(random.uniform(0.8, 1.5))  # human pause
#                         await btn.click()
#                         logger.info(
#                             f"[Bootstrap] Cookie consent accepted via: {selector}"
#                         )
#                         await asyncio.sleep(random.uniform(1.2, 2.0))
#                         clicked = True
#                         break
#                 except Exception:
#                     continue

#             if not clicked:
#                 # Last resort — try clicking by evaluating JS directly
#                 try:
#                     accepted = await page.evaluate("""
#                         () => {
#                             // Find any button containing accept/ACCEPT text
#                             const buttons = Array.from(document.querySelectorAll('button'));
#                             const btn = buttons.find(b => 
#                                 b.textContent.trim().toUpperCase().includes('ACCEPT')
#                             );
#                             if (btn) { btn.click(); return true; }
#                             return false;
#                         }
#                     """)
#                     if accepted:
#                         logger.info("[Bootstrap] Cookie consent accepted via JS evaluate.")
#                         await asyncio.sleep(random.uniform(1.2, 2.0))
#                     else:
#                         logger.warning(
#                             "[Bootstrap] No cookie consent button found. "
#                             "Whoami may not fire."
#                         )
#                 except Exception as e:
#                     logger.warning(f"[Bootstrap] JS consent click failed: {e}")

#         except Exception as e:
            
            
#                 logger.warning(f"[Bootstrap] Cookie consent handling failed: {e}")

#         # Debug: log what buttons exist on the page right now
#         try:
#             button_texts = await page.evaluate("""
#                 () => Array.from(document.querySelectorAll('button'))
#                     .map(b => b.textContent.trim())
#                     .filter(t => t.length > 0)
#                     .slice(0, 20)
#             """)
#             logger.info(f"[Bootstrap] Buttons visible on page: {button_texts}")
#         except Exception:
#             pass

#         # ── NEW: Wait for sensor to complete BEFORE any mouse activity ─────────
#         # Akamai's sensor writes bm_sv as its final action after collecting
#         # all fingerprint data. Mouse events and other interference during this
#         # window can prevent bm_sv from being written.
#         # The sensor needs 15-25 seconds after consent to complete its challenge.
#         logger.info("[Bootstrap] Waiting for Akamai sensor to complete...")
#         await asyncio.sleep(random.uniform(15.0, 20.0))

#         # Check if bm_sv already written — if so sensor is done, no need to wait more
#         try:
#             current_cookies = await context.cookies("https://www.noon.com")
#             cookie_names = {c["name"] for c in current_cookies}
#             if "bm_sv" in cookie_names:
#                 logger.info("[Bootstrap] bm_sv confirmed written. Sensor complete.")
#             else:
#                 logger.warning("[Bootstrap] bm_sv not yet written after 15s wait. Adding more time.")
#                 await asyncio.sleep(10.0)
#         except Exception:
#             pass

# # ── NOW run human simulation ───────────────────────────────────────────
#         await _human_simulation(page)

#         # ── Step 5: Human simulation (concurrent with page load) ──────────
#         # While scripts load and execute (including Akamai sensor),
#         # we perform realistic mouse and scroll interactions.
#         await _human_simulation(page)

#         # ── Step 6: Wait for whoami, then abort page load ─────────────────
#         # whoami fires AFTER Akamai sensor runs and noon's frontend
#         # initialises — it's our signal that bm_* cookies are set.
#         try:
#             await asyncio.wait_for(
#                 whoami_fired.wait(),
#                 timeout=90.0,    # proxy is slower than direct connection
#             )
#             logger.info("[Bootstrap] Whoami detected. Waiting for sensor finalisation.")
#             # bm_sv is written by Akamai's JS slightly AFTER whoami returns.
#             # We must NOT stop the page here — give the sensor 3s to finish.
#             await asyncio.sleep(random.uniform(5, 8))

#         except asyncio.TimeoutError:
#             logger.warning(
#                 "[Bootstrap] Whoami timed out after 90s. "
#                 "Proceeding with available cookies."
#             )
#             await asyncio.sleep(4.0)
#             # Don't raise here — check cookies below and raise if critical
#             # ones are missing. Timeout alone isn't a hard failure.

#         # ── Step 7: Extract all cookies ───────────────────────────────────
#         # context.cookies() returns a list of dicts with name/value/domain
#         # etc. We convert to a simple name→value mapping.
#         # If nguestv2 appears twice (it refreshes during whoami), the
#         # LAST entry wins — _extract_cookies() preserves insertion order
#         # so the last write wins.
#         all_cookie_dicts = await context.cookies("https://www.noon.com")
#         cookies = _extract_cookies(all_cookie_dicts)

#         logger.info(
#             f"[Bootstrap] Cookies extracted: {len(cookies)}. "
#             f"Keys: {sorted(cookies.keys())}"
#         )

#         # ── Step 8: Validate critical cookies are present ─────────────────
#         # Raises BootstrapError if Akamai or noon cookies missing.
#         _validate_cookies(cookies)

#         # ── Step 9: Decode x-whoami-data ──────────────────────────────────
#         # This cookie contains the full x-header context we need:
#         # x-ab-test array, zonecodes, lat/lng, country flags.
#         whoami_raw = cookies.get("x-whoami-data", "")
#         x_headers = _decode_whoami_data(whoami_raw) if whoami_raw else {}

#         if not x_headers:
#             logger.warning(
#                 "[Bootstrap] x-whoami-data absent or undecodable. "
#                 "session_manager will use hardcoded x-header defaults."
#             )

#         # ── Step 10: Handle nguestv2 — take the latest occurrence ─────────
#         # The raw cookie list may have two nguestv2 entries: the initial
#         # guest token and a refreshed one issued during the whoami call.
#         # We want the newest one (highest iat timestamp).
#         nguestv2_entries = [
#             c for c in all_cookie_dicts if c["name"] == "nguestv2"
#         ]

#         if nguestv2_entries:
#             # Sort by iat embedded in JWT payload, take the latest
#             def _iat(cookie_dict: dict) -> int:
#                 try:
#                     token = cookie_dict["value"]
#                     payload_b64 = token.split(".")[1]
#                     remainder = len(payload_b64) % 4
#                     if remainder:
#                         payload_b64 += "=" * (4 - remainder)
#                     payload = json.loads(base64.urlsafe_b64decode(payload_b64))
#                     return payload.get("iat", 0)
#                 except Exception:
#                     return 0

#             latest_nguestv2 = max(nguestv2_entries, key=_iat)
#             jwt_token = latest_nguestv2["value"]
#             # Overwrite cookies dict with the freshest token
#             cookies["nguestv2"] = jwt_token
#         else:
#             jwt_token = cookies.get("nguestv2", "")

#         # ── Step 11: Decode JWT expiry ─────────────────────────────────────
#         jwt_expiry = _decode_jwt_expiry(jwt_token)

#         logger.info(
#             f"[Bootstrap] Session established. "
#             f"JWT expiry: {jwt_expiry.strftime('%H:%M:%S')} UTC. "
#             f"x-ab-test length: {len(x_headers.get('x-ab-test', []))}."
#         )

#         # ── Step 12: Build and return raw session data ─────────────────────
#         return {
#             "cookies": cookies,
#             "user_agent": user_agent,
#             "x_headers": x_headers,
#             "jwt_token": jwt_token,
#             "jwt_expiry": jwt_expiry,
#             "bootstrap_time": datetime.utcnow(),
#             "proxy_dict": proxy_dict,
#             "proxy_url": proxy_url,
#         }

#     except BootstrapError:
#         # Hard failure — propagate to session_manager for proxy rotation
#         raise

#     except Exception as exc:
#         # Unexpected failure — wrap in BootstrapError for uniform handling
#         logger.error(f"[Bootstrap] Unexpected failure: {exc}", exc_info=True)
#         raise BootstrapError(
#             f"Bootstrap failed with unexpected error: {exc}"
#         ) from exc

#     finally:
#         # Always clean up — even if we raised. Browser is single-use.
#         # All subsequent work is curl_cffi. No browser kept alive.
#         try:
#             if browser:
#                 await browser.close()
#                 logger.debug("[Bootstrap] Browser closed.")
#             if playwright:
#                 await playwright.stop()
#                 logger.debug("[Bootstrap] Playwright stopped.")
#         except Exception as cleanup_exc:
#             logger.warning(
#                 f"[Bootstrap] Cleanup error (non-fatal): {cleanup_exc}"
#             )
async def bootstrap_session(proxy_dict: dict, proxy_url: str) -> dict:
    """
    Two-phase bootstrap:

    Phase 1 — Browser (no proxy, direct connection):
        Lets Akamai's sensor execute without HTTP proxy interference.
        Collects: bm_sv, bm_ss, ak_bmsc, and all other Akamai cookies.
        proxy_dict parameter is kept for signature compatibility but
        is NOT passed to the browser context.

    Phase 2 — curl_cffi (SOCKS5 UAE proxy):
        Hits /whoami/noon with Phase 1 cookies from a UAE IP.
        Noon checks the IP is UAE before issuing nguestv2.
        Collects: nguestv2 (JWT token for all API calls).

    Why split:
        Browser cannot use SOCKS5 with auth (Chromium hard limitation).
        HTTP proxy interferes with Akamai sensor → bm_sv never written.
        Direct connection = clean sensor = bm_sv always written.
        curl_cffi has no SOCKS5 auth limitation.
        Akamai bm_sv encodes browser fingerprint, not IP — safe to use
        from a different IP in Phase 2.
    """
    playwright = None
    browser    = None

    try:
        # ── Step 1: User Agent ────────────────────────────────────────────
        try:
            pool       = await fetch_header_pool()
            user_agent = _get_windows_ua(pool)
        except Exception as exc:
            logger.warning(f"[Bootstrap] ScrapeOps failed ({exc}). Using fallback UA.")
            user_agent = FALLBACK_UA

        logger.info("[Bootstrap] Starting two-phase browser bootstrap.")
        logger.info(f"[Bootstrap] UA: {user_agent[:80]}")
        logger.info("[Bootstrap] Phase 1: Browser (no proxy) — Akamai sensor collection.")

        # ── Step 2: Launch browser WITHOUT proxy ──────────────────────────
        playwright, browser = await get_browser(headless=False)
        context = await get_context(browser, user_agent, proxy=None)
        page    = await context.new_page()

        # ── Step 3: Register whoami listener BEFORE navigation ────────────
        whoami_fired = asyncio.Event()

        async def _on_response(response) -> None:
            if WHOAMI_URL_FRAGMENT in response.url and response.status == 200:
                logger.debug(f"[Bootstrap] Whoami intercepted: {response.url[:80]}")
                whoami_fired.set()

        page.on("response", _on_response)

        # ── Step 4: Navigate ───────────────────────────────────────────────
        logger.info("[Bootstrap] Navigating to noon homepage...")
        await page.goto(NOON_HOME, wait_until="domcontentloaded", timeout=60_000)

        # Wait for JS components to render
        try:
            await page.wait_for_load_state("networkidle", timeout=12_000)
        except Exception:
            pass
        await asyncio.sleep(1.5)

        # ── Step 5: Cookie consent ────────────────────────────────────────
        consent_selectors = [
            "button:has-text('ACCEPT ALL')",
            "button:has-text('Accept All')",
            "button:has-text('Accept all')",
            "[data-testid='cookie-accept']",
        ]
        clicked = False
        for selector in consent_selectors:
            try:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=4_000):
                    await asyncio.sleep(random.uniform(0.8, 1.4))
                    await btn.click()
                    logger.info(f"[Bootstrap] Cookie consent accepted via: {selector}")
                    await asyncio.sleep(random.uniform(1.2, 2.0))
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            try:
                accepted = await page.evaluate("""
                    () => {
                        const btn = Array.from(document.querySelectorAll('button'))
                            .find(b => b.textContent.trim().toUpperCase().includes('ACCEPT'));
                        if (btn) { btn.click(); return true; }
                        return false;
                    }
                """)
                if accepted:
                    logger.info("[Bootstrap] Consent accepted via JS evaluate.")
                    await asyncio.sleep(random.uniform(1.2, 2.0))
                else:
                    logger.warning("[Bootstrap] No consent button found.")
            except Exception as e:
                logger.warning(f"[Bootstrap] JS consent failed: {e}")

        # ── Step 6: Wait for Akamai sensor to write bm_sv ─────────────────
        # Poll every 3 seconds. bm_sv is written by sensor after it
        # completes all fingerprinting. No need to wait a fixed time.
        logger.info("[Bootstrap] Polling for bm_sv (Akamai sensor completion)...")
        bm_sv_found = False
        for attempt in range(10):   # poll up to 30 seconds
            await asyncio.sleep(3.0)
            try:
                current = await context.cookies("https://www.noon.com")
                names   = {c["name"] for c in current}
                if "bm_sv" in names:
                    logger.info(f"[Bootstrap] bm_sv written after {(attempt+1)*3}s. Sensor complete.")
                    bm_sv_found = True
                    break
                else:
                    logger.debug(f"[Bootstrap] bm_sv not yet present ({(attempt+1)*3}s elapsed).")
            except Exception:
                pass

        if not bm_sv_found:
            logger.warning("[Bootstrap] bm_sv not written after 30s polling. Continuing anyway.")

        # ── Step 7: Human simulation ───────────────────────────────────────
        await _human_simulation(page)

        # ── Step 8: Also wait for whoami from the browser (best case) ─────
        # Without UAE proxy the browser won't get nguestv2 from whoami,
        # but we wait briefly in case it fires anyway.
        try:
            await asyncio.wait_for(whoami_fired.wait(), timeout=15.0)
            logger.info("[Bootstrap] Whoami fired from browser (bonus).")
            await asyncio.sleep(3.0)
        except asyncio.TimeoutError:
            logger.info("[Bootstrap] Whoami did not fire from browser (expected without UAE proxy).")

        # ── Step 9: Extract Phase 1 cookies ───────────────────────────────
        all_cookie_dicts = await context.cookies("https://www.noon.com")
        cookies          = _extract_cookies(all_cookie_dicts)

        logger.info(
            f"[Bootstrap] Phase 1 complete. "
            f"Cookies: {len(cookies)}. "
            f"bm_sv: {'✓' if 'bm_sv' in cookies else '✗'} | "
            f"nguestv2: {'✓' if 'nguestv2' in cookies else '✗ (expected)'}"
        )

        # Validate Akamai cookies — these MUST be present from browser phase
        missing_akamai = REQUIRED_AKAMAI - set(cookies)
        if missing_akamai:
            raise BootstrapError(
                f"Phase 1 failed: Akamai cookies missing: {missing_akamai}. "
                f"Sensor JS did not execute."
            )

        # ── Step 10: Phase 2 — curl_cffi whoami via UAE proxy ─────────────
        logger.info("[Bootstrap] Phase 2: curl_cffi whoami via UAE SOCKS5 proxy → nguestv2.")

        from curl_cffi.requests import AsyncSession as CurlSession

        # Build whoami headers using the Akamai cookies from Phase 1
        whoami_cookie_str = "; ".join(
            f"{k}={v}" for k, v in cookies.items()
            if k not in THIRD_PARTY_COOKIES  # reuse your existing filter set
        )


        import uuid as _uuid

        sentry_trace, baggage = _generate_sentry_headers()
        sec_ch_ua             = _derive_sec_ch_ua(user_agent)

        whoami_headers = {
            "accept":             "application/json, text/plain, */*",
            "accept-encoding":    "gzip, deflate, br, zstd",
            "accept-language":    "en-US,en;q=0.9",
            "baggage":            baggage,
            "cache-control":      "no-cache, max-age=0, must-revalidate, no-store",
            "cookie":             whoami_cookie_str,
            "priority":           "u=1, i",
            "referer":            "https://www.noon.com/uae-en/",
            "sec-ch-ua":          sec_ch_ua,
            "sec-ch-ua-mobile":   "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest":     "empty",
            "sec-fetch-mode":     "cors",
            "sec-fetch-site":     "same-origin",
            "sentry-trace":       sentry_trace,
            "user-agent":         user_agent,
            "x-border-enabled":   "true",
            "x-cms":              "v2",
            "x-content":          "desktop",
            "x-ecom-zonecode":    FALLBACK_ZONECODE,
            "x-lat":              FALLBACK_LAT,
            "x-lng":              FALLBACK_LNG,
            "x-locale":           "en-ae",
            "x-mp-country":       "ae",
            "x-platform":         "web",
            "x-rocket-enabled":   "true",
            "x-rocket-zonecode":  FALLBACK_ROCKET_ZONE,
            "x-visitor-id":       cookies.get("visitor_id", ""),
            "x-whoami-req-id":    str(_uuid.uuid4()),
        }

        nguestv2   = None
        x_headers  = {}
        jwt_expiry = None

        for attempt in range(1, 4):  # up to 3 attempts
            logger.info(f"[Bootstrap] Phase 2 attempt {attempt} of 3...")
            try:
                async with CurlSession(impersonate="chrome146") as curl:
                    # Use HTTP proxy for whoami — SOCKS5 fails with error 97 in this environment.
                    # Akamai sensor is already complete at this point so HTTP proxy interference
                    # is irrelevant. We only need a UAE IP to get nguestv2 issued.
                    # http_proxy_url = proxy_url.replace("socks5://", "http://").replace("_streaming-1", "")
                    resp = await curl.get(
                        WHOAMI_URL,
                        headers = whoami_headers,
                        proxy   = proxy_url,
                        timeout = 20,
                    )

                if resp.status_code == 200:
                    # nguestv2 comes in Set-Cookie
                    nguestv2 = resp.cookies.get("nguestv2")

                    if nguestv2:
                        cookies["nguestv2"] = nguestv2
                        logger.info("[Bootstrap] Phase 2 success. nguestv2 obtained via UAE proxy.")
                    
                    else:
                        logger.warning(
                            "[Bootstrap] Phase 2: whoami returned 200 but no nguestv2 in Set-Cookie. "
                            "UAE proxy may not be routing correctly."
                        )

                    # Decode x-whoami-data from response if available
                    whoami_raw = cookies.get("x-whoami-data", "")
                    if whoami_raw:
                        x_headers = _decode_whoami_data(whoami_raw)
                        logger.info(
                            f"[Bootstrap] Phase 2 success on attempt {attempt}. "
                            f"x-ab-test length: {len(x_headers.get('x-ab-test', []))}."
                )
                        
                        break
                    else:
                        logger.warning(f"[Bootstrap] Attempt {attempt}: 200 OK but no nguestv2.")
                else:
                    logger.warning(f"[Bootstrap] Attempt {attempt}: HTTP {resp.status_code}.")

            except Exception as e:
                logger.warning(f"[Bootstrap] Attempt {attempt} failed: {e}")

            if attempt < 3:
                await asyncio.sleep(3.0)
        # ── Step 11: Validate nguestv2 obtained ───────────────────────────
        if not nguestv2:
            # Last chance — check if browser phase got it anyway
            nguestv2 = cookies.get("nguestv2")
            if not nguestv2:
                raise BootstrapError(
                    "Phase 2 failed: nguestv2 not obtained. "
                    "UAE proxy may be blocked or misconfigured. "
                    "Check SOCKS5 proxy credentials and port."
                )

        # ── Step 12: Decode JWT expiry ────────────────────────────────────
        jwt_expiry = _decode_jwt_expiry(nguestv2)

        logger.info(
            f"[Bootstrap] Both phases complete. "
            f"JWT expiry: {jwt_expiry.strftime('%H:%M:%S')} UTC. "
            f"Total cookies: {len(cookies)}."
        )

        return {
            "cookies":        cookies,
            "user_agent":     user_agent,
            "x_headers":      x_headers,
            "jwt_token":      nguestv2,
            "jwt_expiry":     jwt_expiry,
            "bootstrap_time": datetime.utcnow(),
            "proxy_dict":     proxy_dict,
            "proxy_url":      proxy_url,
        }

    except BootstrapError:
        raise

    except Exception as exc:
        logger.error(f"[Bootstrap] Unexpected failure: {exc}", exc_info=True)
        raise BootstrapError(f"Bootstrap failed: {exc}") from exc

    finally:
        try:
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()
        except Exception as e:
            logger.warning(f"[Bootstrap] Cleanup error: {e}")