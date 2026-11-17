

# from __future__ import annotations

# import json
# import logging
# import os
# import time
# from dataclasses import dataclass, field
# from datetime import datetime, timezone
# from pathlib import Path
# from typing import Optional

# from browserbase import Browserbase
# from playwright.sync_api import sync_playwright

# from app.config import settings

# logger = logging.getLogger(__name__)

# COOKIE_CACHE_PATH = Path(
#     getattr(settings, "BROWSERBASE_COOKIE_PATH", "data/browserbase_noon_cookies.json")
# )
# DEFAULT_NOON_URL = "https://www.noon.com/uae-en/"
# CACHE_MAX_AGE_SECONDS = int(getattr(settings, "BROWSERBASE_COOKIE_MAX_AGE_SECS", 20 * 60))


# @dataclass
# class BrowserbaseBundle:
#     cookies: dict[str, str]
#     user_agent: str
#     harvested_at: datetime
#     raw_cookies: list = field(default_factory=list)


# def _api_key() -> str:
#     return os.environ.get("BROWSERBASE_API_KEY") or getattr(settings, "BROWSERBASE_API_KEY", "") or ""


# # def _project_id() -> Optional[str]:
# #     return os.environ.get("BROWSERBASE_PROJECT_ID") or getattr(settings, "BROWSERBASE_PROJECT_ID", None)


# def _harvest_sync(country_url: str = DEFAULT_NOON_URL) -> BrowserbaseBundle:
#     key = _api_key()
#     if not key:
#         raise RuntimeError("BROWSERBASE_API_KEY is not set")

#     bb = Browserbase(api_key=key)
#     create_kwargs = {}
#     # pid = _project_id()
#     # if pid:
#     #     create_kwargs["project_id"] = pid

#     # Optional if your plan supports it:
#     # create_kwargs["proxies"] = True

#     session = bb.sessions.create(**create_kwargs)
#     logger.info(f"[Browserbase] session={session.id}")

#     with sync_playwright() as p:
#         browser = p.chromium.connect_over_cdp(session.connect_url)
#         context = browser.contexts[0]
#         page = context.pages[0] if context.pages else context.new_page()

#         page.goto(country_url, wait_until="domcontentloaded", timeout=120_000)
#         time.sleep(15)
#         try:
#             page.mouse.move(180, 320)
#         except Exception:
#             pass
#         time.sleep(2)

#         all_cookies = context.cookies()
#         noon_like = [c for c in all_cookies if "noon" in (c.get("domain") or "")]
#         use = noon_like or all_cookies
#         jar = {c["name"]: c["value"] for c in use}
#         ua = page.evaluate("() => navigator.userAgent")

#         browser.close()

#     if not jar:
#         raise RuntimeError("[Browserbase] No cookies harvested")

#     bundle = BrowserbaseBundle(
#         cookies=jar,
#         user_agent=ua or "Mozilla/5.0",
#         harvested_at=datetime.now(timezone.utc),
#         raw_cookies=use,
#     )
#     _save_cache(bundle)
#     logger.info(f"[Browserbase] harvested {len(jar)} cookies")
#     return bundle


# def _save_cache(bundle: BrowserbaseBundle) -> None:
#     try:
#         COOKIE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
#         payload = {
#             "cookies": bundle.cookies,
#             "user_agent": bundle.user_agent,
#             "harvested_at": bundle.harvested_at.isoformat(),
#             "raw": bundle.raw_cookies,
#         }
#         COOKIE_CACHE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
#     except Exception as exc:
#         logger.warning(f"[Browserbase] cache save failed: {exc}")


# def _load_cache() -> Optional[BrowserbaseBundle]:
#     if not COOKIE_CACHE_PATH.exists():
#         return None
#     try:
#         data = json.loads(COOKIE_CACHE_PATH.read_text(encoding="utf-8"))
#         harvested = datetime.fromisoformat(data["harvested_at"])
#         if harvested.tzinfo is None:
#             harvested = harvested.replace(tzinfo=timezone.utc)
#         age = (datetime.now(timezone.utc) - harvested).total_seconds()
#         if age > CACHE_MAX_AGE_SECONDS:
#             logger.info(f"[Browserbase] cache age {age:.0f}s > max; refresh")
#             return None
#         cookies = data.get("cookies") or {}
#         if "bm_sv" not in cookies and "_abck" not in cookies:
#             logger.info("[Browserbase] cache missing typical Akamai cookies; refresh")
#             return None
#         return BrowserbaseBundle(
#             cookies=cookies,
#             user_agent=data.get("user_agent") or "Mozilla/5.0",
#             harvested_at=harvested,
#             raw_cookies=data.get("raw") or [],
#         )
#     except Exception as exc:
#         logger.warning(f"[Browserbase] cache load failed: {exc}")
#         return None


# class BrowserbaseCookieProvider:
#     """
#     Drop-in style provider for scrapers that used SessionManager.

#     Usage in search / product / store:
#         provider = BrowserbaseCookieProvider(country="ae")
#         await provider.initialise()
#         headers = provider.get_headers(referer)
#         cookies = provider.get_cookies()
#         # then: session.get(url, headers=headers, cookies=cookies)
#     """

#     def __init__(self, country: str = "ae", noon_home: str | None = None) -> None:
#         self._country = (country or "ae").lower()
#         self._home = noon_home or f"https://www.noon.com/{self._country}-en/"
#         self._bundle: Optional[BrowserbaseBundle] = None

#     async def initialise(self, force: bool = False) -> None:
#         """Load cache or harvest. Safe to call from async scrapers."""
#         import asyncio

#         if not force:
#             cached = _load_cache()
#             if cached is not None:
#                 self._bundle = cached
#                 logger.info("[Browserbase] using cached cookies")
#                 return

#         self._bundle = await asyncio.to_thread(_harvest_sync, self._home)

#     async def refresh(self) -> None:
#         await self.initialise(force=True)

#     def get_cookies(self) -> dict[str, str]:
#         if self._bundle is None:
#             raise RuntimeError("BrowserbaseCookieProvider.initialise() not called")
#         return dict(self._bundle.cookies)

#     def get_headers(self, referer: str) -> dict[str, str]:
#         if self._bundle is None:
#             raise RuntimeError("BrowserbaseCookieProvider.initialise() not called")
#         ua = self._bundle.user_agent
#         return {
#             "accept": "application/json, text/plain, */*",
#             "accept-encoding": "gzip, deflate, br, zstd",
#             "accept-language": "en-US,en;q=0.9",
#             "cache-control": "no-cache, max-age=0, must-revalidate, no-store",
#             "referer": referer,
#             "user-agent": ua,
#             "x-locale": f"en-{self._country}",
#             "x-mp-country": self._country,
#             "x-platform": "web",
#         }

#     def get_proxy(self) -> None:
#         return None

#     def log_request(self) -> None:
#         pass

#     async def handle_block(self, reason: str = "") -> None:
#         logger.warning(f"[Browserbase] block: {reason}; re-harvesting")
#         await self.refresh()
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from browserbase import Browserbase
from curl_cffi.requests import AsyncSession
from playwright.sync_api import sync_playwright

from app.config import settings

logger = logging.getLogger(__name__)

COOKIE_CACHE_PATH = Path(
    getattr(settings, "BROWSERBASE_COOKIE_PATH", "data/browserbase_noon_cookies.json")
)
DEFAULT_NOON_URL = "https://www.noon.com/uae-en/"
CACHE_MAX_AGE_SECONDS = int(
    getattr(settings, "BROWSERBASE_COOKIE_MAX_AGE_SECS", 20 * 60)
)

THIRD_PARTY_COOKIES = frozenset({
    "bcookie", "lidc", "bh",
    "IDE",
    "CLID",
    "TapAd_3WAY_SYNCS", "TapAd_DID", "TapAd_TS",
    "yabs-sid", "yandexuid", "yashr", "ymex", "yuidss",
    "receive-cookie-deprecation",
})


@dataclass
class BrowserbaseBundle:
    cookies: dict[str, str]
    user_agent: str
    harvested_at: datetime
    raw_cookies: list = field(default_factory=list)
    request_count: int = 0


def _api_key() -> str:
    return (
        os.environ.get("BROWSERBASE_API_KEY")
        or getattr(settings, "BROWSERBASE_API_KEY", "")
        or ""
    )


def _chrome_version_from_ua(user_agent: str) -> Optional[int]:
    match = re.search(r"Chrome/(\d+)\.", user_agent or "")
    return int(match.group(1)) if match else None


def _derive_sec_ch_ua(user_agent: str) -> str:
    version = _chrome_version_from_ua(user_agent) or 131
    return (
        f'"Chromium";v="{version}", '
        f'"Google Chrome";v="{version}", '
        f'"Not/A)Brand";v="99"'
    )


def _pick_impersonate_target(user_agent: str) -> str:
    """
    Pick a curl_cffi chromeNNN target close to the harvested UA.
    Falls back to chrome131 if introspection fails.
    """
    version = _chrome_version_from_ua(user_agent)
    supported = [131]
    try:
        from curl_cffi.const import BrowserType

        found = []
        for member in BrowserType:
            name = member.value if hasattr(member, "value") else str(member)
            m = re.fullmatch(r"chrome(\d+)", name)
            if m:
                found.append(int(m.group(1)))
        if found:
            supported = sorted(set(found))
    except Exception:
        pass

    if version is None:
        return f"chrome{supported[-1]}"

    closest = min(supported, key=lambda v: abs(v - version))
    return f"chrome{closest}"


def _harvest_sync(country_url: str = DEFAULT_NOON_URL) -> BrowserbaseBundle:
    key = _api_key()
    if not key:
        raise RuntimeError("BROWSERBASE_API_KEY is not set")

    bb = Browserbase(api_key=key)
    create_kwargs: dict = {}
    # Optional:
    # pid = os.environ.get("BROWSERBASE_PROJECT_ID") or getattr(settings, "BROWSERBASE_PROJECT_ID", None)
    # if pid:
    #     create_kwargs["project_id"] = pid
    # create_kwargs["proxies"] = True

    session = bb.sessions.create(**create_kwargs)
    logger.info(f"[Browserbase] session={session.id}")

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        context = browser.contexts[0]
        page = context.pages[0] if context.pages else context.new_page()

        page.goto(country_url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(15)
        try:
            page.mouse.move(180, 320)
            page.mouse.wheel(0, 400)
        except Exception:
            pass
        time.sleep(2)

        all_cookies = context.cookies()
        noon_like = [c for c in all_cookies if "noon" in (c.get("domain") or "")]
        use = noon_like or all_cookies
        jar = {
            c["name"]: c["value"]
            for c in use
            if c["name"] not in THIRD_PARTY_COOKIES
        }
        ua = page.evaluate("() => navigator.userAgent")

        browser.close()

    if not jar:
        raise RuntimeError("[Browserbase] No cookies harvested")

    if "bm_sv" not in jar and "_abck" not in jar and "ak_bmsc" not in jar:
        logger.warning(
            "[Browserbase] Harvest has no typical Akamai cookies "
            "(bm_sv / _abck / ak_bmsc). API calls may still fail."
        )

    bundle = BrowserbaseBundle(
        cookies=jar,
        user_agent=ua or "Mozilla/5.0",
        harvested_at=datetime.now(timezone.utc),
        raw_cookies=use,
    )
    _save_cache(bundle)
    logger.info(f"[Browserbase] harvested {len(jar)} cookies")
    return bundle


def _save_cache(bundle: BrowserbaseBundle) -> None:
    try:
        COOKIE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "cookies": bundle.cookies,
            "user_agent": bundle.user_agent,
            "harvested_at": bundle.harvested_at.isoformat(),
            "raw": bundle.raw_cookies,
        }
        COOKIE_CACHE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning(f"[Browserbase] cache save failed: {exc}")


def _load_cache() -> Optional[BrowserbaseBundle]:
    if not COOKIE_CACHE_PATH.exists():
        return None
    try:
        data = json.loads(COOKIE_CACHE_PATH.read_text(encoding="utf-8"))
        harvested = datetime.fromisoformat(data["harvested_at"])
        if harvested.tzinfo is None:
            harvested = harvested.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - harvested).total_seconds()
        if age > CACHE_MAX_AGE_SECONDS:
            logger.info(f"[Browserbase] cache age {age:.0f}s > max; refresh")
            return None
        cookies = data.get("cookies") or {}
        if "bm_sv" not in cookies and "_abck" not in cookies:
            logger.info("[Browserbase] cache missing typical Akamai cookies; refresh")
            return None
        return BrowserbaseBundle(
            cookies=cookies,
            user_agent=data.get("user_agent") or "Mozilla/5.0",
            harvested_at=harvested,
            raw_cookies=data.get("raw") or [],
        )
    except Exception as exc:
        logger.warning(f"[Browserbase] cache load failed: {exc}")
        return None


class BrowserbaseCookieProvider:
    """
    Drop-in replacement for SessionManager.

    Public surface used by search / product / store:
        await provider.initialise()
        session  = provider.get_session()
        headers  = provider.get_headers(referer)
        proxy    = provider.get_proxy()
        provider.log_request()
        await provider.handle_block(reason)
        provider.get_status()
    """

    def __init__(
        self,
        country: str = "ae",
        noon_home: str | None = None,
        use_proxy: bool = False,
        proxy_url: Optional[str] = None,
    ) -> None:
        self._country = (country or "ae").lower()
        self._home = noon_home or f"https://www.noon.com/{self._country}-en/"
        self._use_proxy = use_proxy
        self._proxy_url = proxy_url

        self._bundle: Optional[BrowserbaseBundle] = None
        self._session: Optional[AsyncSession] = None
        self._impersonate: str = "chrome131"

        if self._use_proxy and not self._proxy_url:
            raise ValueError(
                "[Browserbase] use_proxy=True but no proxy_url provided."
            )

    async def initialise(self, force: bool = False) -> None:
        if not force:
            cached = _load_cache()
            if cached is not None:
                logger.info("[Browserbase] using cached cookies")
                self._load_bundle_and_session(cached)
                return

        raw = await asyncio.to_thread(_harvest_sync, self._home)
        self._load_bundle_and_session(raw)

    async def refresh(self) -> None:
        await self.initialise(force=True)

    def _load_bundle_and_session(self, bundle: BrowserbaseBundle) -> None:
        self._bundle = bundle
        self._impersonate = _pick_impersonate_target(bundle.user_agent)

        self._session = AsyncSession(impersonate=self._impersonate)
        for name, value in bundle.cookies.items():
            if name in THIRD_PARTY_COOKIES:
                continue
            self._session.cookies.set(name, value, domain=".noon.com")

        logger.info(
            f"[Browserbase] Session ready | cookies={len(bundle.cookies)} | "
            f"impersonate={self._impersonate}"
        )

    def get_session(self) -> AsyncSession:
        if self._session is None:
            raise RuntimeError(
                "[Browserbase] get_session() called before initialise()."
            )
        return self._session

    def get_cookies(self) -> dict[str, str]:
        if self._bundle is None:
            raise RuntimeError(
                "[Browserbase] get_cookies() called before initialise()."
            )
        return dict(self._bundle.cookies)

    def get_headers(self, referer: str) -> dict[str, str]:
        if self._bundle is None:
            raise RuntimeError(
                "[Browserbase] get_headers() called before initialise()."
            )
        ua = self._bundle.user_agent
        return {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "no-cache, max-age=0, must-revalidate, no-store",
            "priority": "u=1, i",
            "referer": referer,
            "sec-ch-ua": _derive_sec_ch_ua(ua),
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": ua,
            "x-locale": f"en-{self._country}",
            "x-mp-country": self._country,
            "x-platform": "web",
        }

    def get_proxy(self) -> Optional[str]:
        return self._proxy_url if self._use_proxy else None

    def log_request(self) -> None:
        if self._bundle:
            self._bundle.request_count += 1

    async def handle_block(self, reason: str = "") -> None:
        logger.warning(f"[Browserbase] block: {reason}; re-harvesting")
        await self.refresh()

    def get_status(self) -> dict:
        if self._bundle is None:
            return {"status": "uninitialised"}

        now = datetime.now(timezone.utc)
        age_s = (now - self._bundle.harvested_at).total_seconds()
        return {
            "status": "active",
            "bootstrap_age_s": round(age_s, 1),
            "request_count": self._bundle.request_count,
            "cookie_count": len(self._bundle.cookies),
            "use_proxy": self._use_proxy,
            "impersonate": self._impersonate,
        }