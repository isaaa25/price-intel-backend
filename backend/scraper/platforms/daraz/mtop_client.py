
"""
scraper/platforms/daraz/mtop_client.py

Handles the mtop (Mobile Taobao Open Platform) request-signing scheme
that Daraz's product-detail API requires. "mtop" is Alibaba/Lazada's
own name for this API family (visible in the endpoint itself:
mtop.global.detail.web.getdetailinfo) — this file is named to match,
so anyone opening it immediately knows what problem it solves.

WHY THIS IS ITS OWN FILE, SEPARATE FROM utils.py:
    All signing/anti-bot logic lives here, and nowhere else. If Daraz
    ever changes their signing scheme or starts blocking requests, this
    is the one file to open — no need to search across the codebase.
    utils.py stays pure/network-free (SKU extraction, URL parsing,
    field mapping); this file is the only place that talks to Daraz's
    token/signing handshake.

═══════════════════════════════════════════════════════════════════════════════
THE SIGNING FORMULA — verified against real captured traffic
═══════════════════════════════════════════════════════════════════════════════

    sign = MD5(token + "&" + t + "&" + APP_KEY + "&" + data)

    token   : the segment of the _m_h5_tk cookie BEFORE the underscore.
              _m_h5_tk looks like "abc123..._1784557495608" — token is
              everything before the "_".
    t       : the same millisecond timestamp sent as the URL's t= param.
    APP_KEY : "24937400" — confirmed to be the correct key via direct
              MD5 verification against two real captured requests.
              NOTE: the request URL also carries a second, DIFFERENT
              value as a lowercase "appkey=24677475" query param. That
              second value is a decoy/unrelated param — it is NOT used
              in the signing formula. Only the first, mixed-case
              "appKey=24937400" matters here.
    data    : the exact, fully JSON-encoded string sent as the POST
              body's "data" field (see build_data_payload below) — the
              raw JSON string itself, not URL-encoded, not re-escaped.

═══════════════════════════════════════════════════════════════════════════════
THE TWO-STEP HANDSHAKE — verified against real captured traffic
═══════════════════════════════════════════════════════════════════════════════

    Step 1: A request with NO _m_h5_tk cookie is sent. Daraz's server
            rejects it (body: {"ret":["FAIL_SYS_TOKEN_EMPTY::..."]})
            but issues a FRESH _m_h5_tk via Set-Cookie on that very
            response. This "failure" is expected and required — it's
            how a token gets minted in the first place.

    Step 2: The fresh token is extracted, a new sign is computed using
            it, and the SAME logical request is retried. This one
            succeeds and returns real product data.

═══════════════════════════════════════════════════════════════════════════════
COOKIEPARAMS — confirmed NOT to need real browser cookie values
═══════════════════════════════════════════════════════════════════════════════

    The "data" payload includes a cookieParams field, which is itself a
    JSON string mirroring some of the browser's cookie jar. Testing
    confirmed Daraz's server does NOT validate the actual VALUES in
    here — a request with placeholder/fake values for t_fv and t_uid
    succeeded identically to one with real captured values. Only the
    genuine _m_h5_tk value matters (since it's also what token is
    derived from). This means NO browser session is needed anywhere in
    this file — everything here is plain curl_cffi + pure Python.

═══════════════════════════════════════════════════════════════════════════════
NO DISK PERSISTENCE NEEDED (unlike Noon's session_manager.py)
═══════════════════════════════════════════════════════════════════════════════

    Noon's SessionBundle is saved to disk because bootstrapping it costs
    a full browser launch — expensive, worth avoiding on every run.
    Here, "bootstrapping" a token costs exactly one extra lightweight
    HTTP call (the deliberately-failing Step 1 request). That's cheap
    enough to just do in-memory, once per scrape run, via
    MtopClient.ensure_token(). No SessionBundle-equivalent, no
    save_to_disk/load_from_disk — this class just holds the current
    token as a plain attribute for the life of one script run.
"""

import hashlib
import json
import logging
import random
import re
import time
from typing import Optional

import httpx
from curl_cffi.requests import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

APP_KEY = "24937400"
ENDPOINT = "https://acs-m.daraz.pk/h5/mtop.global.detail.web.getdetailinfo/1.0/"

# curl_cffi impersonation target — must match whatever Chrome version the
# installed curl_cffi build actually supports faithfully. Kept in sync
# with Noon's choice (chrome146) since both platforms run on the same
# curl_cffi install — bumping one without the other would leave Daraz
# quietly presenting a stale/inconsistent fingerprint.
IMPERSONATE_TARGET = "chrome146"

# Static fallback ONLY — used if the ScrapeOps header pool is empty or
# unreachable. Real requests should always prefer a header pulled from
# fetch_header_pool() below, not this constant.
_FALLBACK_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)

USER_AGENT = settings.user_agents


# ─────────────────────────────────────────────────────────────────────────────
# SCRAPEOPS HEADER POOL 
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_header_pool(num_results: int = 10) -> list[dict]:
    """
    Hits ScrapeOps once per scrape run. Returns a list of realistic
    browser header dicts (each including a matching user-agent +
    sec-ch-ua pair already generated together by ScrapeOps).

    Store the result in memory — never call this per request. Mirrors
    scraper/platforms/noon/utils.py's fetch_header_pool exactly, kept
    as its own copy here since Daraz
    is a separate platform module and shouldn't depend on anywhere else.
    """
    url = "https://headers.scrapeops.io/v1/browser-headers"
    params = {
        "api_key": settings.SCRAPEOPS_API_KEY,
        "num_results": num_results,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            headers_list = data.get("result", [])

            if not headers_list:
                logger.warning(
                    "[MtopClient] ScrapeOps returned empty headers. "
                    "Check your API key or quota."
                )
                return []

            logger.info(f"[MtopClient] Fetched {len(headers_list)} headers from ScrapeOps.")
            return headers_list

    except httpx.HTTPError as e:
        logger.error(f"[MtopClient] Failed to fetch headers from ScrapeOps: {e}")
        return []


def get_random_header(header_pool: list[dict]) -> dict:
    """
    Picks one random header dict from the in-memory pool. Pure function
    — no API call, no side effects. Falls back to a basic header if the
    pool is empty (e.g. ScrapeOps was unreachable at startup).
    """
    if not header_pool:
        logger.warning("[MtopClient] Header pool is empty. Using fallback header.")
        return {"user-agent": _FALLBACK_USER_AGENT}
    return random.choice(header_pool)


def _derive_sec_ch_ua(user_agent: str) -> str:
    """
    Derives a sec-ch-ua value from a user-agent string's Chrome version,
    for cases where the ScrapeOps header entry doesn't already include
    its own sec-ch-ua. Mirrors Noon's session_manager._derive_sec_ch_ua
    — sec-ch-ua must report the SAME Chrome version as the user-agent,
    or the mismatch itself is a known bot-detection signal.
    """
    match = re.search(r"Chrome/(\d+)\.", user_agent)
    version = match.group(1) if match else "146"
    return (
        f'"Chromium";v="{version}", '
        f'"Google Chrome";v="{version}", '
        f'"Not/A)Brand";v="99"'
    )


# ─────────────────────────────────────────────────────────────────────────────
# PURE SIGNING FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def build_data_payload(product_url: str, uri: str) -> str:
    """
    Builds the JSON string that goes into the "data" POST field.

    cookieParams and headerParams are DELIBERATELY minimal/placeholder —
    confirmed via direct testing that Daraz's server does not validate
    their contents. Do not be tempted to replicate a full real browser
    cookie jar here; it adds complexity for zero verified benefit.

    Args:
      product_url : Full frontend URL of the product (competitor_listings.url).
      uri         : The Daraz "uri" identifier — the URL path segment
                    with ".html" and any query string stripped (e.g.
                    "dw-210-20-1-i212788200"). See utils.py's
                    extract_uri_from_url for how this is derived.
    """
    header_params = json.dumps({"user-agent": USER_AGENT})
    cookie_params = json.dumps({
        "t_fv": "0",
        "t_uid": "0",
    })
    request_params = json.dumps({"spm": "a2a0e.pdp.0.0"})

    payload = {
        "deviceType": "pc",
        "path": product_url,
        "uri": uri,
        "headerParams": header_params,
        "cookieParams": cookie_params,
        "requestParams": request_params,
    }
    return json.dumps(payload)


def compute_sign(token: str, t: str, data: str) -> str:
    """
    Pure function: sign = MD5(token & t & APP_KEY & data).
    See module docstring for the full verified formula explanation.
    """
    base = f"{token}&{t}&{APP_KEY}&{data}"
    return hashlib.md5(base.encode()).hexdigest()


def build_request_url(t: str, sign: str) -> str:
    """
    Builds the full mtop endpoint URL with all its fixed query params,
    plus the request-specific t and sign values.

    All non-t/sign params below are static values copied directly from
    real captured traffic — Daraz's frontend always sends these same
    values regardless of which product is being requested.
    """
    params = {
        "jsv": "2.6.1",
        "appKey": APP_KEY,
        "t": t,
        "sign": sign,
        "api": "mtop.global.detail.web.getDetailInfo",
        "v": "1.0",
        "type": "originaljson",
        "isSec": "1",
        "AntiCreep": "true",
        "timeout": "20000",
        "dataType": "json",
        "sessionOption": "AutoLoginOnly",
        "x-i18n-language": "en",
        "x-i18n-regionID": "PK",
        "traffic": "drz-replatform",
        # This second, lowercase "appkey" is a distinct param from the
        # "appKey" above and is NOT used in the signing formula — it's
        # copied here only because real traffic always includes it, and
        # omitting it is an unnecessary deviation from observed behavior.
        "appkey": "24677475",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{ENDPOINT}?{query}"


def build_request_headers(referer: str, scrapeops_header: dict) -> dict[str, str]:
    """
    Headers for the mtop POST call. Daraz-protocol-required fields
    (accept, content-type, origin, x-i18n-*, traffic) are fixed values
    copied from real captured traffic — these are not fingerprint
    related and must stay exactly as observed regardless of which
    browser identity is in use.

    Fingerprint-related fields (user-agent, sec-ch-ua, sec-ch-ua-mobile,
    sec-ch-ua-platform, accept-language) come from scrapeops_header —
    the single header dict selected once per MtopClient instance (see
    get_random_header) and reused for every call that instance makes,
    so the fingerprint never shifts mid-session.

    referer should be the frontend product URL being requested — matches
    what a real browser would send.
    """
    user_agent = scrapeops_header.get("user-agent", _FALLBACK_USER_AGENT)
    sec_ch_ua = scrapeops_header.get("sec-ch-ua") or _derive_sec_ch_ua(user_agent)

    return {
        "accept": "application/json",
        "accept-language": scrapeops_header.get("accept-language", "en-US,en;q=0.9"),
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        "origin": "https://www.daraz.pk",
        "pragma": "no-cache",
        "referer": referer,
        "sec-ch-ua": sec_ch_ua,
        "sec-ch-ua-mobile": scrapeops_header.get("sec-ch-ua-mobile", "?0"),
        "sec-ch-ua-platform": scrapeops_header.get("sec-ch-ua-platform", '"Windows"'),
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": user_agent,
        "x-i18n-language": "en",
        "x-i18n-regionid": "PK",
        "traffic": "drz-replatform",
    }


# ─────────────────────────────────────────────────────────────────────────────
# MTOP CLIENT — token handshake + signed requests
# ─────────────────────────────────────────────────────────────────────────────

class MtopClient:
    """
    Holds the current mtop token in memory for the life of one scrape
    run and exposes a single method — fetch_product_detail — that
    handles the token handshake transparently.

    No disk persistence (see module docstring for why this is fine —
    unlike Noon, a token "bootstrap" here is just one cheap HTTP call,
    not a full browser launch).

    One MtopClient instance should be reused across every Daraz product
    call within a single scrape run, so the token handshake (Step 1's
    deliberately-failing request) only has to happen once, not once per
    product. If a token expires mid-run (a 401-equivalent or a
    FAIL_SYS_TOKEN_EXPIRED-style response), ensure_token() is called
    again automatically to re-mint one.
    """

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._session = AsyncSession(impersonate=IMPERSONATE_TARGET)
        # Selected once, in initialise(), and reused for every request
        # this instance makes — never re-picked mid-run. Switching
        # user-agent/sec-ch-ua mid-session on the same underlying
        # connection is itself a fingerprint-mismatch signal, same
        # reasoning as Noon's SessionBundle locking in one user_agent
        # for the life of a session.
        self._header: dict = {"user-agent": _FALLBACK_USER_AGENT}

    async def initialise(self, num_results: int = 10) -> None:
        """
        Fetches the ScrapeOps header pool and locks in one header for
        this instance's lifetime. Call this once before the first
        fetch_product_detail call. If ScrapeOps is unreachable, falls
        back to the static fallback UA (fetch_header_pool/get_random_header
        already handle this internally — this method just wires it in).
        """
        pool = await fetch_header_pool(num_results=num_results)
        self._header = get_random_header(pool)
        logger.info(
            f"[MtopClient] Locked in header: "
            f"{self._header.get('user-agent', _FALLBACK_USER_AGENT)[:60]}..."
        )

    async def close(self) -> None:
        await self._session.close()

    # ── Token handshake ────────────────────────────────────────────────────

    async def _mint_token(self, product_url: str, uri: str) -> Optional[str]:
        """
        Performs the deliberately-failing Step 1 request to obtain a
        fresh _m_h5_tk cookie from Daraz's server, then extracts and
        returns the token portion (before the underscore).

        Returns None if the server did not set a usable cookie at all
        (genuine failure — network issue, endpoint change, etc.).
        """
        t = str(int(time.time() * 1000))
        data = build_data_payload(product_url, uri)
        # No token yet on this first call — sign is computed with an
        # empty token string, matching what was observed in real traffic
        # (the failing first request's sign used no real token).
        sign = compute_sign(token="", t=t, data=data)

        url = build_request_url(t, sign)
        headers = build_request_headers(referer=product_url, scrapeops_header=self._header)

        try:
            resp = await self._session.post(
                url, headers=headers, data={"data": data}, timeout=20
            )
        except Exception as exc:
            logger.error(f"[MtopClient] Token-mint request failed: {exc}")
            return None

        raw_cookie = resp.cookies.get("_m_h5_tk")
        if not raw_cookie:
            logger.warning(
                "[MtopClient] No _m_h5_tk cookie returned on token-mint "
                "request. Daraz's response may have changed shape."
            )
            return None

        token = raw_cookie.split("_")[0]
        logger.info(f"[MtopClient] Minted fresh token: {token[:12]}...")
        return token

    async def ensure_token(self, product_url: str, uri: str) -> Optional[str]:
        """
        Returns the current in-memory token, minting a fresh one first
        if none exists yet. Does NOT re-mint on every call — callers
        that suspect the token has expired should clear self._token
        (or call _mint_token directly) rather than relying on this to
        detect staleness itself.
        """
        if self._token is None:
            self._token = await self._mint_token(product_url, uri)
        return self._token

    # ── Public entry point ─────────────────────────────────────────────────

    async def fetch_product_detail(self, product_url: str, uri: str) -> Optional[dict]:
        """
        Fetches raw product-detail JSON for one Daraz listing, handling
        the token handshake transparently.

        Args:
          product_url : Full frontend URL (competitor_listings.url).
          uri         : Derived via utils.extract_uri_from_url(product_url).

        Returns:
          The raw parsed JSON response dict on success (still containing
          the double-encoded "module" string — see utils.py's
          extract_product_detail for parsing that further), or None on
          any failure (network error, non-200, both handshake attempts
          failed, or the response shape is unexpected).

        One retry-with-fresh-token is attempted automatically if the
        first real request fails with a token-related error — this
        covers the case where an in-memory token from earlier in a long
        scrape run has expired mid-run.
        """
        token = await self.ensure_token(product_url, uri)
        if token is None:
            logger.error(
                f"[MtopClient] Could not obtain a token at all for {uri}."
            )
            return None

        result = await self._signed_request(product_url, uri, token)

        if result is not None:
            return result

        # First attempt failed — could be an expired token. Force a fresh
        # mint and retry exactly once before giving up on this listing.
        logger.info(
            f"[MtopClient] First attempt failed for {uri}. "
            f"Re-minting token and retrying once."
        )
        self._token = None
        token = await self.ensure_token(product_url, uri)
        if token is None:
            return None

        return await self._signed_request(product_url, uri, token)

    async def _signed_request(
        self, product_url: str, uri: str, token: str
    ) -> Optional[dict]:
        """
        Makes one signed request using the given token. Returns the
        parsed JSON dict on a clean success (ret contains "SUCCESS"),
        or None on any failure — non-200, malformed JSON, or a non-
        success ret value (token expired, rate limited, etc.).
        """
        t = str(int(time.time() * 1000))
        data = build_data_payload(product_url, uri)
        sign = compute_sign(token=token, t=t, data=data)

        url = build_request_url(t, sign)
        headers = build_request_headers(referer=product_url, scrapeops_header=self._header)

        try:
            resp = await self._session.post(
                url, headers=headers, data={"data": data}, timeout=20
            )
        except Exception as exc:
            logger.error(f"[MtopClient] Request failed for {uri}: {exc}")
            return None

        if resp.status_code != 200:
            logger.error(
                f"[MtopClient] HTTP {resp.status_code} for {uri}."
            )
            return None

        try:
            parsed = resp.json()
        except Exception as exc:
            logger.error(f"[MtopClient] Failed to parse JSON for {uri}: {exc}")
            return None

        ret = parsed.get("ret", [])
        if not any("SUCCESS" in r for r in ret):
            logger.warning(
                f"[MtopClient] Non-success ret for {uri}: {ret}"
            )
            return None

        return parsed