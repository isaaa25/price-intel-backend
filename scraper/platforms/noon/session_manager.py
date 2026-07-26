"""
scraper/session_manager.py

The central nervous system of the stealth layer.

Every curl_cffi API call goes through this file.
It is responsible for four distinct things:

  1. SESSION BUNDLE MODEL
     Typed Pydantic model holding every piece of session state:
     cookies, user agent, x-headers, JWT token, proxy URL.
     All other components read from this single source of truth.

  2. DISK PERSISTENCE
     The bundle is serialised to JSON after every bootstrap and
     every JWT refresh. On script startup, we try to load it.
     If it is valid and fresh, we skip the browser entirely and
     just refresh the JWT. This means a 12-hour monitoring script
     only ever needs one browser launch, not one per run.

  3. HEALTH ORCHESTRATION
     health_check() inspects the bundle and returns one of three
     states: OK, REFRESH_JWT, REBOOTSTRAP. SessionManager.ensure_valid()
     calls this before every API request and acts on the result.
     The scraper never manages session state — it just calls ensure_valid().

  4. HEADER BUILDING
     build_request_headers() assembles the complete, correctly ordered
     header dict that curl_cffi sends to noon's API. This includes:
       - Full Akamai cookie string
       - All noon x- headers extracted from x-whoami-data
       - sec-ch-ua derived from the actual user agent
       - Fresh sentry-trace + baggage per request
       - Correct sec-fetch-* values for XHR/fetch requests

PRIVATE HELPERS (why they live here, not in utils.py):
  _generate_sentry_headers, _derive_sec_ch_ua, _build_cookie_string
  are only ever called by build_request_headers(). Putting them in
  utils.py would split the complete header-building picture across
  two files. All header logic lives here — open this file and you
  see exactly how every header value is produced.
"""

import asyncio
import base64
import json
import logging
import random
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ConfigDict
from curl_cffi.requests import AsyncSession

from app.config import settings
from scraper.platforms.noon.proxy_manager import ProxyManager

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

# noon whoami endpoint — used for lightweight JWT refresh
WHOAMI_URL = "https://www.noon.com/_vs/st/st-whoami-api-web/whoami/noon"

# Static parts of sentry baggage — tied to noon's deployment.
# Extracted from real network captures. Do not change these.
SENTRY_ENVIRONMENT = "cloudrun"
SENTRY_RELEASE     = "com%404.1.48"
SENTRY_PUBLIC_KEY  = "7b7a99a633ce48be2de6269da900186c"
SENTRY_SAMPLE_RATE = "0.1"

# Fallback x-header values if x-whoami-data decoding fails.
# These are the stable Dubai/UAE zone values observed in captures.
FALLBACK_ZONECODE       = "AE_DXB-S14"
FALLBACK_ROCKET_ZONE    = "W00068765A"
FALLBACK_LAT            = "251998495"
FALLBACK_LNG            = "552715985"


# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE ENUM
# ─────────────────────────────────────────────────────────────────────────────

class SessionState(Enum):
    """
    The three possible outcomes of health_check().

    OK           → session is fresh, JWT valid, nothing to do
    REFRESH_JWT  → Akamai cookies are fine but JWT expires soon;
                   hit /whoami/noon via curl_cffi to get a new one
    REBOOTSTRAP  → session is too old OR critical cookies are missing;
                   must run the full Patchright browser again
    """
    OK          = "ok"
    REFRESH_JWT = "refresh_jwt"
    REBOOTSTRAP = "rebootstrap"


# ─────────────────────────────────────────────────────────────────────────────
# SESSION BUNDLE MODEL
# ─────────────────────────────────────────────────────────────────────────────

class SessionBundle(BaseModel):
    """
    Complete snapshot of a valid noon session.

    This is the single source of truth for the session layer.
    Produced by browser.bootstrap_session() and persisted to disk.
    Every piece of state needed for API calls lives here.

    Fields:
      cookies        : All cookies collected from the browser.
                       57 cookies on a typical noon homepage visit.
                       Includes Akamai bm_* + noon session + analytics.
                       nguestv2 is updated in-place by JWT refresh.

      user_agent     : The exact UA string used by the bootstrap browser.
                       Must match sec-ch-ua version in API call headers.
                       Never change this between bootstrap and API calls.

      x_headers      : Decoded from x-whoami-data cookie.
                       Contains x-ab-test array, zonecodes, lat/lng.
                       Extracted once at bootstrap, reused until rebootstrap.

      jwt_token      : Current nguestv2 JWT string.
                       Updated every ~4 minutes by refresh_jwt().

      jwt_expiry     : UTC datetime when jwt_token expires.
                       Decoded from JWT payload at bootstrap and refresh time.
                       health_check() compares this against utcnow().

      bootstrap_time : UTC datetime when the browser last ran.
                       health_check() enforces SESSION_MAX_AGE_HOURS limit.

      proxy_url      : SOCKS5 URL for curl_cffi.
                       "socks5://user:pass@host:port"
                       Stored here so SessionManager never calls ProxyManager
                       mid-session — the proxy is locked for the session.

      request_count  : Informational counter. Incremented on every API call.
    """
    cookies:        dict[str, str]
    user_agent:     str
    x_headers:      dict
    jwt_token:      str
    jwt_expiry:     datetime
    bootstrap_time: datetime
    proxy_url:      str
    request_count:  int = 0


    def model_post_init(self, __context) -> None:
        """
        Ensure all datetimes are timezone-aware (UTC).
        browser.py may return naive UTC datetimes.
        We normalise here so all comparisons use aware datetimes.
        """
        if self.jwt_expiry.tzinfo is None:
            self.jwt_expiry = self.jwt_expiry.replace(tzinfo=timezone.utc)
        if self.bootstrap_time.tzinfo is None:
            self.bootstrap_time = self.bootstrap_time.replace(tzinfo=timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# DISK PERSISTENCE
# ─────────────────────────────────────────────────────────────────────────────

def save_to_disk(bundle: SessionBundle) -> None:
    """
    Serialises the SessionBundle to JSON at SESSION_BUNDLE_PATH.

    Called after every bootstrap and every JWT refresh.
    Creates parent directories if they don't exist (e.g. data/).

    JSON datetimes are stored as ISO 8601 strings with UTC offset.
    Pydantic v2 handles this automatically via model_dump_json().
    """
    try:
        path = Path(settings.SESSION_BUNDLE_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(bundle.model_dump_json(indent=2), encoding="utf-8")
        logger.info(
            f"[Session] Bundle saved → {path}. "
            f"JWT expiry: {bundle.jwt_expiry.strftime('%H:%M:%S')} UTC."
        )
    except Exception as exc:
        # Non-fatal: in-memory session is still valid.
        # Worst case: next startup will re-bootstrap.
        logger.warning(f"[Session] Failed to save bundle to disk: {exc}")


def load_from_disk() -> Optional[SessionBundle]:
    """
    Attempts to load and validate a saved SessionBundle from disk.

    Validation steps (in order):
      1. File must exist at SESSION_BUNDLE_PATH.
      2. File must be valid JSON parseable as SessionBundle.
      3. bootstrap_time must be within SESSION_MAX_AGE_HOURS.
         (Akamai bm_* cookies expire — an old session is worthless.)
      4. Critical cookies (bm_sv, nguestv2) must be present.
         (Corrupted or partial saves are rejected.)

    Returns None on any failure — caller handles by bootstrapping fresh.

    Note: JWT will almost certainly be expired (5 min TTL) when loaded
    from disk. This is expected and fine. SessionManager.initialise()
    calls ensure_valid() immediately after loading, which triggers a
    lightweight JWT refresh rather than a full browser bootstrap.
    """
    path = Path(settings.SESSION_BUNDLE_PATH)

    if not path.exists():
        logger.info("[Session] No saved bundle at disk. Fresh bootstrap needed.")
        return None

    try:
        bundle = SessionBundle.model_validate_json(
            path.read_text(encoding="utf-8")
        )
    except Exception as exc:
        logger.warning(f"[Session] Bundle file corrupt or unreadable: {exc}. Re-bootstrapping.")
        return None

    # Check age
    now = datetime.now(timezone.utc)
    age_hours = (now - bundle.bootstrap_time).total_seconds() / 3600
    max_age   = settings.SESSION_MAX_AGE_HOURS

    if age_hours > max_age:
        logger.info(
            f"[Session] Saved bundle is {age_hours:.1f}h old "
            f"(max: {max_age}h). Re-bootstrapping."
        )
        return None

    # Check critical cookies
    critical = {"bm_sv", "nguestv2"}
    missing  = critical - set(bundle.cookies)
    if missing:
        logger.warning(
            f"[Session] Saved bundle missing critical cookies: {missing}. "
            f"Re-bootstrapping."
        )
        return None

    logger.info(
        f"[Session] Loaded bundle from disk. "
        f"Age: {age_hours:.1f}h. "
        f"JWT expired: {now > bundle.jwt_expiry} "
        f"(will refresh immediately if so)."
    )
    return bundle


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

def health_check(bundle: SessionBundle) -> SessionState:
    """
    Inspects the current SessionBundle and returns the required action.

    Decision logic (checked in priority order):

      REBOOTSTRAP if:
        → bootstrap_time older than SESSION_MAX_AGE_HOURS
          (Akamai bm_* cookies become stale over time regardless of JWT)
        → bm_sv missing from cookies
          (should not happen post-bootstrap but defensive check)

      REFRESH_JWT if:
        → jwt_expiry is within JWT_REFRESH_THRESHOLD_SECS seconds
          (nguestv2 has 5-min TTL; we refresh 90s before expiry by default)

      OK if:
        → none of the above conditions are met

    This function is pure — it only reads, never modifies the bundle.
    SessionManager.ensure_valid() acts on the returned state.
    """
    now = datetime.now(timezone.utc)

    # ── Check session age ──────────────────────────────────────────────────
    age_seconds = (now - bundle.bootstrap_time).total_seconds()
    max_seconds = settings.SESSION_MAX_AGE_HOURS * 3600

    if age_seconds > max_seconds:
        logger.info(
            f"[HealthCheck] Session age {age_seconds/3600:.1f}h exceeds "
            f"limit {settings.SESSION_MAX_AGE_HOURS}h → REBOOTSTRAP."
        )
        return SessionState.REBOOTSTRAP

    # ── Check critical cookie presence ────────────────────────────────────
    if "bm_sv" not in bundle.cookies:
        logger.warning("[HealthCheck] bm_sv missing from bundle → REBOOTSTRAP.")
        return SessionState.REBOOTSTRAP

    # ── Check JWT expiry ───────────────────────────────────────────────────
    seconds_to_expiry = (bundle.jwt_expiry - now).total_seconds()
    threshold         = settings.JWT_REFRESH_THRESHOLD_SECS

    if seconds_to_expiry <= threshold:
        logger.debug(
            f"[HealthCheck] JWT expires in {seconds_to_expiry:.0f}s "
            f"(threshold: {threshold}s) → REFRESH_JWT."
        )
        return SessionState.REFRESH_JWT

    logger.debug(
        f"[HealthCheck] Session OK. "
        f"JWT valid for {seconds_to_expiry:.0f}s. "
        f"Session age: {age_seconds/3600:.1f}h."
    )
    return SessionState.OK


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HEADER HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _decode_jwt_expiry(token: str) -> datetime:
    """
    Decodes nguestv2 JWT payload to extract expiry timestamp.
    Duplicated from browser.py intentionally — session_manager must
    be self-contained for JWT refresh without importing browser internals.

    Returns UTC-aware datetime. On any decode failure, returns
    utcnow() + 4 minutes as a conservative fallback.
    """
    try:
        payload_b64 = token.split(".")[1]
        remainder = len(payload_b64) % 4
        if remainder:
            payload_b64 += "=" * (4 - remainder)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    except Exception as exc:
        logger.warning(f"[Session] JWT decode failed: {exc}. Using 4min fallback.")
        return datetime.now(timezone.utc) + timedelta(seconds=240)


def _generate_sentry_headers() -> tuple[str, str]:
    """
    Generates fresh sentry-trace and baggage values per request.

    WHY fresh per request:
      sentry-trace contains a trace_id that noon's observability
      infrastructure uses to correlate events. The same trace_id
      on multiple requests would indicate replay or bot behaviour.
      Generating fresh IDs per request matches real browser behaviour.

    The trace_id MUST be the same in sentry-trace and baggage.
    The static fields (environment, release, public_key) never change —
    they are noon's deployment constants extracted from real traffic.

    Returns: (sentry_trace_header_value, baggage_header_value)
    """
    trace_id  = secrets.token_hex(16)   # 32 hex chars
    span_id   = secrets.token_hex(8)    # 16 hex chars
    replay_id = secrets.token_hex(16)   # 32 hex chars

    sentry_trace = f"{trace_id}-{span_id}-0"

    baggage = (
        f"sentry-environment={SENTRY_ENVIRONMENT},"
        f"sentry-release={SENTRY_RELEASE},"
        f"sentry-public_key={SENTRY_PUBLIC_KEY},"
        f"sentry-trace_id={trace_id},"
        f"sentry-replay_id={replay_id},"
        f"sentry-sample_rate={SENTRY_SAMPLE_RATE},"
        f"sentry-sampled=false"
    )

    return sentry_trace, baggage


def _derive_sec_ch_ua(user_agent: str) -> str:
    """
    Derives sec-ch-ua header value from the User-Agent string.

    WHY derive instead of hardcode:
      sec-ch-ua must report the SAME Chrome version as User-Agent.
      If UA says Chrome/145 but sec-ch-ua says Chrome/146, that
      version mismatch is a known bot detection signal.
      We extract the version from the actual UA and use it here.

    Example:
      UA:  "...Chrome/146.0.0.0 Safari/537.36"
      Out: '"Chromium";v="146", "Google Chrome";v="146", "Not/A)Brand";v="99"'
    """
    match = re.search(r"Chrome/(\d+)\.", user_agent)
    version = match.group(1) if match else "146"
    return (
        f'"Chromium";v="{version}", '
        f'"Google Chrome";v="{version}", '
        f'"Not/A)Brand";v="99"'
    )

THIRD_PARTY_COOKIES = frozenset({
    # LinkedIn — linkedin.com domain cookies
    "bcookie", "lidc", "bh",
    # Google DoubleClick — doubleclick.net
    "IDE",
    # Microsoft
    "CLID",
    # TapAd advertising platform
    "TapAd_3WAY_SYNCS", "TapAd_DID", "TapAd_TS",
    # Yandex — yandex.com domain
    "yabs-sid", "yandexuid", "yashr", "ymex", "yuidss",
    # Chrome CHIPS testing cookie — irrelevant to noon
    "receive-cookie-deprecation",
})
def _build_cookie_string(cookies: dict[str, str]) -> str:
    """
    Sends all cookies that noon.com's server legitimately set,
    dropping only cookies that belong to foreign domains.
    
    A real browser never sends linkedin.com or doubleclick.net
    cookies to noon.com — doing so is a detectable bot signal.
    """
    filtered = {k: v for k, v in cookies.items() if k not in THIRD_PARTY_COOKIES}
    return "; ".join(f"{k}={v}" for k, v in filtered.items())


# ─────────────────────────────────────────────────────────────────────────────
# HEADER BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_request_headers(bundle: SessionBundle, referer: str) -> dict[str, str]:
    """
    Assembles the complete, correctly ordered header dict for curl_cffi.

    HEADER ORDER:
      curl_cffi with chrome146 impersonation sends headers in the exact
      order Chrome would. The order below matches the captured traffic
      from real noon.com API XHR calls. Wrong order = fingerprint mismatch.
      We use a regular dict — Python 3.7+ preserves insertion order,
      and curl_cffi respects it when building the HTTP/2 HEADERS frame.

    Parameters:
      bundle  : Current SessionBundle (source of cookies, UA, x-headers)
      referer : The page the XHR originates from.
                Search calls → "https://www.noon.com/uae-en/search/?q=..."
                Store calls  → "https://www.noon.com/uae-en/..."

    Returns:
      Ordered dict of all headers. Pass directly to curl_cffi's get()/post().
    """
    sentry_trace, baggage = _generate_sentry_headers()
    sec_ch_ua             = _derive_sec_ch_ua(bundle.user_agent)
    cookie_string         = _build_cookie_string(bundle.cookies)

    # x-ab-test is a list of ints — join as comma-separated string
    ab_test_str = ",".join(
        str(x) for x in bundle.x_headers.get("x-ab-test", [])
    )

    # Read zone values from decoded whoami data, fall back to known defaults
    ecom_zonecode   = bundle.x_headers.get("x-ecom-zonecode",  FALLBACK_ZONECODE)
    rocket_zonecode = bundle.x_headers.get("x-rocket-zonecode", FALLBACK_ROCKET_ZONE)
    lat             = str(bundle.x_headers.get("x-lat",         FALLBACK_LAT))
    lng             = str(bundle.x_headers.get("x-lng",         FALLBACK_LNG))

    return {
        # ── Standard fetch/XHR headers ────────────────────────────────────
        "accept":               "application/json, text/plain, */*",
        "accept-encoding":      "gzip, deflate, br, zstd",
        "accept-language":      "en-US,en;q=0.9",
        # ── Sentry observability (fresh per request) ──────────────────────
        "baggage":              baggage,
        # ── Cache control ─────────────────────────────────────────────────
        "cache-control":        "no-cache, max-age=0, must-revalidate, no-store",
        # ── Full cookie string ────────────────────────────────────────────
        "cookie":               cookie_string,
        # ── Priority hint ─────────────────────────────────────────────────
        "priority":             "u=1, i",
        # ── Navigation context ────────────────────────────────────────────
        "referer":              referer,
        # ── Browser identity ──────────────────────────────────────────────
        "sec-ch-ua":            sec_ch_ua,
        "sec-ch-ua-mobile":     "?0",
        "sec-ch-ua-platform":   '"Windows"',
        # ── Fetch metadata ────────────────────────────────────────────────
        "sec-fetch-dest":       "empty",
        "sec-fetch-mode":       "cors",
        "sec-fetch-site":       "same-origin",
        # ── Sentry trace (fresh per request, matches baggage trace_id) ────
        "sentry-trace":         sentry_trace,
        # ── User agent ────────────────────────────────────────────────────
        "user-agent":           bundle.user_agent,
        # ── noon-specific x- headers (from x-whoami-data) ─────────────────
        "x-ab-test":            ab_test_str,
        "x-border-enabled":     "true",
        "x-cms":                "v2",
        "x-content":            "desktop",
        "x-ecom-zonecode":      ecom_zonecode,
        "x-lat":                lat,
        "x-lng":                lng,
        "x-locale":             "en-ae",
        "x-mp-country":         "ae",
        "x-platform":           "web",
        "x-rocket-enabled":     "true",
        "x-rocket-zonecode":    rocket_zonecode,
        "x-visitor-id":         bundle.cookies.get("visitor_id", ""),
    }


# ─────────────────────────────────────────────────────────────────────────────
# JWT REFRESH
# ─────────────────────────────────────────────────────────────────────────────

async def refresh_jwt(bundle: SessionBundle) -> bool:
    """
    Hits /whoami/noon via curl_cffi to obtain a fresh nguestv2 JWT.

    WHY this is lightweight:
      The Akamai bm_* cookies last ~2 hours. The JWT lasts 5 minutes.
      We don't need the browser again — just send the valid bm_* cookies
      to the whoami endpoint and noon issues a fresh JWT in Set-Cookie.

    On success:
      Updates bundle.jwt_token, bundle.cookies["nguestv2"],
      and bundle.jwt_expiry in place.
      Returns True.

    On failure (non-200, network error, no JWT in response):
      Does NOT modify the bundle.
      Returns False.
      SessionManager treats False as a REBOOTSTRAP signal.

    x-whoami-req-id:
      The whoami endpoint expects a UUID per call.
      Real browsers generate this in frontend JS.
      We generate a fresh UUID4 here.
    """
    sentry_trace, baggage = _generate_sentry_headers()
    sec_ch_ua             = _derive_sec_ch_ua(bundle.user_agent)
    cookie_string         = _build_cookie_string(bundle.cookies)
    ab_test_str           = ",".join(
        str(x) for x in bundle.x_headers.get("x-ab-test", [])
    )

    headers = {
        "accept":             "application/json, text/plain, */*",
        "accept-encoding":    "gzip, deflate, br, zstd",
        "accept-language":    "en-US,en;q=0.9",
        "baggage":            baggage,
        "cache-control":      "no-cache, max-age=0, must-revalidate, no-store",
        "cookie":             cookie_string,
        "pragma":             "no-cache",
        "priority":           "u=1, i",
        "referer":            "https://www.noon.com/uae-en/",
        "sec-ch-ua":          sec_ch_ua,
        "sec-ch-ua-mobile":   "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest":     "empty",
        "sec-fetch-mode":     "cors",
        "sec-fetch-site":     "same-origin",
        "sentry-trace":       sentry_trace,
        "user-agent":         bundle.user_agent,
        "x-ab-test":          ab_test_str,
        "x-border-enabled":   "true",
        "x-cms":              "v2",
        "x-content":          "desktop",
        "x-ecom-zonecode":    bundle.x_headers.get("x-ecom-zonecode",  FALLBACK_ZONECODE),
        "x-lat":              str(bundle.x_headers.get("x-lat",        FALLBACK_LAT)),
        "x-lng":              str(bundle.x_headers.get("x-lng",        FALLBACK_LNG)),
        "x-locale":           "en-ae",
        "x-mp-country":       "ae",
        "x-platform":         "web",
        "x-rocket-enabled":   "true",
        "x-rocket-zonecode":  bundle.x_headers.get("x-rocket-zonecode", FALLBACK_ROCKET_ZONE),
        "x-visitor-id":       bundle.cookies.get("visitor_id", ""),
        "x-whoami-req-id":    str(uuid.uuid4()),   # fresh UUID per whoami call
    }

    try:
        async with AsyncSession(impersonate="chrome146") as session:
            resp = await session.get(
                WHOAMI_URL,
                headers=headers,
                proxy=bundle.proxy_url,
                timeout=15,
            )

        if resp.status_code != 200:
            logger.warning(
                f"[Session] Whoami refresh failed: "
                f"HTTP {resp.status_code}. "
                f"bm_* cookies may be stale → rebootstrap."
            )
            return False

        # Extract the new nguestv2 from response cookies.
        # curl_cffi stores Set-Cookie values in resp.cookies.
        new_jwt = resp.cookies.get("nguestv2")

        if not new_jwt:
            logger.warning(
                "[Session] Whoami returned 200 but no nguestv2 in Set-Cookie. "
                "Treating as soft failure → rebootstrap."
            )
            return False

        # Update bundle in place
        bundle.jwt_token              = new_jwt
        bundle.cookies["nguestv2"]    = new_jwt
        bundle.jwt_expiry             = _decode_jwt_expiry(new_jwt)

        logger.info(
            f"[Session] JWT refreshed. "
            f"New expiry: {bundle.jwt_expiry.strftime('%H:%M:%S')} UTC."
        )
        return True

    except Exception as exc:
        logger.warning(f"[Session] JWT refresh error: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# SESSION MANAGER
# ─────────────────────────────────────────────────────────────────────────────

class SessionManager:
    """
    Orchestrates the full session lifecycle.

    The scraper (search_scraper, store_scraper) only interacts with
    three methods:
      ensure_valid()   → call before every API request
      get_headers()    → get complete headers dict for curl_cffi
      get_proxy()      → get proxy URL for curl_cffi

    Everything else (bootstrapping, JWT refresh, rotation, persistence)
    is managed internally. The scraper is completely decoupled from
    session management complexity.

    Dependency injection:
      ProxyManager is passed in at construction. SessionManager never
      creates or owns a ProxyManager — it only calls it. This keeps
      the two components independently testable and debuggable.
    """

    def __init__(self, proxy_manager: ProxyManager) -> None:
        self._proxy_manager: ProxyManager               = proxy_manager
        self._bundle:        Optional[SessionBundle]    = None

    # ── Public interface ───────────────────────────────────────────────────

    async def initialise(self) -> None:
        """
        Entry point. Call once at application startup before any scraping.

        Tries to load a saved session from disk first.
        If the saved session is valid, skip the browser entirely and just
        refresh the JWT (which is almost certainly expired after disk load).

        If no valid session exists on disk, runs the full browser bootstrap.
        """
        bundle = load_from_disk()

        if bundle is not None:
            self._bundle = bundle
            logger.info("[SessionManager] Resuming from saved session.")
            # JWT is likely expired — ensure_valid() handles it
            await self.ensure_valid()
        else:
            logger.info("[SessionManager] No valid saved session. Bootstrapping...")
            await self._do_bootstrap()

    async def ensure_valid(self) -> None:
        """
        Ensures the session is valid before an API call.
        Call this at the start of EVERY request in search_scraper/store_scraper.

        Acts on health_check() result:
          OK          → return immediately
          REFRESH_JWT → lightweight whoami call, retry once if it fails
          REBOOTSTRAP → cool down + rotate proxy + full browser bootstrap
        """
        if self._bundle is None:
            logger.warning("[SessionManager] No bundle in memory. Bootstrapping.")
            await self._do_bootstrap()
            return

        state = health_check(self._bundle)

        if state == SessionState.OK:
            return

        if state == SessionState.REFRESH_JWT:
            logger.info("[SessionManager] JWT refresh needed.")
            success = await refresh_jwt(self._bundle)
            if success:
                save_to_disk(self._bundle)
                return
            # Refresh failed — bm_* cookies are likely stale
            logger.warning(
                "[SessionManager] JWT refresh failed. "
                "Escalating to full rebootstrap."
            )
            await self._do_rebootstrap()
            return

        if state == SessionState.REBOOTSTRAP:
            await self._do_rebootstrap()

    def get_headers(self, referer: str) -> dict[str, str]:
        """
        Returns the complete ordered header dict for a curl_cffi API call.

        Parameters:
          referer : The page URL the XHR originates from.
                    For search: "https://www.noon.com/uae-en/search/?q={keyword}"
                    For store:  "https://www.noon.com/uae-en/{store-slug}/"

        Raises RuntimeError if called before initialise().
        """
        if self._bundle is None:
            raise RuntimeError(
                "[SessionManager] get_headers() called before initialise(). "
                "Always call await session_manager.initialise() at startup."
            )
        return build_request_headers(self._bundle, referer)

    def get_proxy(self) -> str:
        """
        Returns the SOCKS5 proxy URL for curl_cffi.
        This is the proxy locked in at bootstrap time for this session.
        """
        if self._bundle is None:
            raise RuntimeError(
                "[SessionManager] get_proxy() called before initialise()."
            )
        return self._bundle.proxy_url

    def log_request(self) -> None:
        """
        Increments request counters on the bundle and proxy manager.
        Call after every successful API response.
        """
        if self._bundle:
            self._bundle.request_count += 1
        self._proxy_manager.log_request()

    async def handle_block(self) -> None:
        """
        Call this when the scraper detects a hard block:
          → HTTP 403 from noon's API
          → HTTP 200 with zero hits on a keyword that should have results

        Different from health_check's REBOOTSTRAP:
          health_check triggers on age/expiry (predictable, scheduled).
          handle_block() triggers on active detection (reactive).

        Marks the current proxy slot as blocked (cooling + fresh session_id),
        then re-bootstraps with the next available proxy slot.
        """
        logger.warning(
            "[SessionManager] Hard block detected by scraper. "
            "Rotating proxy and re-bootstrapping."
        )
        self._proxy_manager.mark_blocked()
        await self._do_rebootstrap()

    def get_status(self) -> dict:
        """
        Returns current session status for logging and diagnostics.
        Safe to call at any time including before initialise().
        """
        if self._bundle is None:
            return {"status": "uninitialised"}

        now = datetime.now(timezone.utc)
        return {
            "status":          "active",
            "bootstrap_age_h": round(
                (now - self._bundle.bootstrap_time).total_seconds() / 3600, 2
            ),
            "jwt_expires_in_s": max(
                0, int((self._bundle.jwt_expiry - now).total_seconds())
            ),
            "request_count":   self._bundle.request_count,
            "proxy_url":       self._bundle.proxy_url[:40] + "...",
            "proxy_pool":      self._proxy_manager.status(),
        }

    # ── Private methods ────────────────────────────────────────────────────

    async def _do_bootstrap(self) -> None:
        """
        Runs the full Patchright browser bootstrap.

        Gets proxy from the currently active ProxyManager slot.
        Builds a SessionBundle from the raw dict returned by browser.py.
        Saves to disk.

        Local import of bootstrap_session avoids a module-level circular
        dependency between session_manager and browser.
        """
        from scraper.platforms.noon.browser import bootstrap_session

        proxy_dict = self._proxy_manager.get_patchright()
        proxy_url  = self._proxy_manager.get_curl()

        logger.info(
            f"[SessionManager] Running browser bootstrap. "
            f"Proxy: {proxy_url[:50]}..."
        )

        raw = await bootstrap_session(
            proxy_dict=proxy_dict,
            proxy_url=proxy_url,
        )

        self._bundle = SessionBundle(**raw)
        save_to_disk(self._bundle)

        logger.info(
            f"[SessionManager] Bootstrap complete. "
            f"Cookies: {len(self._bundle.cookies)}. "
            f"JWT expiry: {self._bundle.jwt_expiry.strftime('%H:%M:%S')} UTC."
        )

    async def _do_rebootstrap(self) -> None:
        """
        Cooldown + proxy rotation + full bootstrap.

        Used when the session has expired (health_check) or a block
        was detected (handle_block). The cooldown prevents hammering
        noon immediately after a block — a known detection signal.
        """
        wait_secs = random.uniform(30, 90)
        logger.info(
            f"[SessionManager] Re-bootstrap cooldown: {wait_secs:.0f}s. "
            f"Rotating proxy slot."
        )
        await asyncio.sleep(wait_secs)

        self._proxy_manager.rotate()
        await self._do_bootstrap()