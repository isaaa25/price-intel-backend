# import logging
# import random
# import string
# from dataclasses import dataclass, field
# from datetime import datetime, timedelta, timezone
# from typing import Optional

# from config import settings

# logger = logging.getLogger(__name__)


# # ─────────────────────────────────────────────────────────────────────────────
# # HELPERS
# # ─────────────────────────────────────────────────────────────────────────────

# def _new_session_id(length: int = 10) -> str:
#     """
#     NOTE:
#     This is NOT an "IPRoyal concept".
#     This is YOUR system's sticky identity key.

#     IPRoyal only consumes this string.
#     You define it.
#     """
#     chars = string.ascii_lowercase + string.digits
#     return "".join(random.choices(chars, k=length))


# # ─────────────────────────────────────────────────────────────────────────────
# # PROXY SLOT — one UAE residential IP
# # ─────────────────────────────────────────────────────────────────────────────

# @dataclass
# class ProxySlot:
#     """
#     Represents ONE proxy endpoint (NOT a session owner anymore).

#     IMPORTANT FIX:
#     - session_id does NOT belong to ProxySlot lifecycle
#     - ProxySlot ONLY manages IP health (cooldown, blocks, stats)
#     """

#     # NOTE: this is ONLY for tracking/debugging slot usage, NOT identity
#     session_id: str

#     blocked_until: Optional[datetime] = field(default=None)
#     request_count: int = field(default=0)
#     block_count: int = field(default=0)

#     # ── state ──────────────────────────────────────────────────────────────

#     @property
#     def is_cooling(self) -> bool:
#         """True if this slot is currently in cooldown period."""
#         if self.blocked_until is None:
#             return False
#         return datetime.now(timezone.utc) < self.blocked_until

#     @property
#     def seconds_until_ready(self) -> int:
#         """How long until this slot becomes usable again."""
#         if self.blocked_until is None:
#             return 0

#         if not self.is_cooling:
#             return 0

#         now = datetime.now(timezone.utc)
#         return max(0, int((self.blocked_until - now).total_seconds()))

#     # ── actions ────────────────────────────────────────────────────────────



#     # ── proxy format builders ──────────────────────────────────────────────

#     def _password(self, runtime_session_id: str) -> str:
#         """
#         IMPORTANT FIX:

#         Previously:
#             we used self.session_id (wrong ownership)

#         NOW:
#             session_id is injected from OUTSIDE (scraping job level)

#         WHY:
#         - session is identity of scraping job
#         - NOT identity of proxy slot
#         """
#         return (
#             f"{settings.IPROYAL_PASSWORD}"
#             f"_country-{settings.IPROYAL_COUNTRY}"
#             f"_session-{runtime_session_id}"   # FIXED: injected session
#             f"_lifetime-{settings.IPROYAL_SESSION_LIFETIME}"
#         )

#     def _get_protocol(self) -> str:
#         """Returns http or socks5 based on config."""
#         return getattr(settings, 'PROXY_PROTOCOL', 'http')

#     def as_patchright_dict(self, runtime_session_id: str) -> dict:
#         """
#         FIX:
#         session is passed externally now
#         """
#         proto = self._get_protocol()

#         return {
#             "server": f"{proto}://{settings.IPROYAL_HOST}:{settings.IPROYAL_PORT}",
#             "username": settings.IPROYAL_USERNAME,
#             "password": self._password(runtime_session_id),
#         }

#     def as_curl_url(self, runtime_session_id: str) -> str:
#         """
#         FIX:
#         session is injected externally
#         """
#         proto = self._get_protocol()

#         return (
#             f"{proto}://{settings.IPROYAL_USERNAME}:{self._password(runtime_session_id)}"
#             f"@{settings.IPROYAL_HOST}:{settings.IPROYAL_PORT}"
#         )

#     def __repr__(self) -> str:
#         status = f"cooling({self.seconds_until_ready}s)" if self.is_cooling else "ready"
#         return (
#             f"ProxySlot(session={self.session_id!r}, "
#             f"status={status}, reqs={self.request_count}, "
#             f"blocks={self.block_count})"
#         )


# # ─────────────────────────────────────────────────────────────────────────────
# # PROXY MANAGER — pool orchestration
# # ─────────────────────────────────────────────────────────────────────────────

# class ProxyManager:
#     """
#     ONLY RESPONSIBILITY:
#     - rotate proxies
#     - track failures
#     - NEVER manage session identity

#     FIX:
#     session_id is NOT owned here anymore
#     """

#     def __init__(self) -> None:
#         self._pool: list[ProxySlot] = []
#         self._active_index: int = 0
#         self._build_pool()

#     # ── setup ──────────────────────────────────────────────────────────────

#     def _build_pool(self) -> None:
#         count = settings.IPROYAL_PROXY_COUNT

#         for i in range(count):
#             # FIX: slot still exists but session_id here is ONLY a label
#             slot = ProxySlot(session_id=f"slot-{i}")
#             self._pool.append(slot)

#         logger.info(
#             f"[ProxyManager] Pool ready — {count} proxy slots initialized."
#         )

#     # ── active slot access ─────────────────────────────────────────────────

#     @property
#     def active(self) -> ProxySlot:
#         return self._pool[self._active_index]

#     # ── proxy builders (FIXED) ─────────────────────────────────────────────

#     def get_patchright(self, session_id: str) -> dict:
#         """
#         FIX:
#         session is passed from scraping job level
#         """
#         proxy = self.active.as_patchright_dict(session_id)

#         logger.debug(
#             f"[ProxyManager] Using slot {self._active_index} "
#             f"with session {session_id}"
#         )

#         return proxy

#     def get_curl(self, session_id: str) -> str:
#         return self.active.as_curl_url(session_id)

#     # ── state changes ──────────────────────────────────────────────────────



#     def log_request(self) -> None:
#         self.active.request_count += 1

#     def status(self) -> list[dict]:
#         return [
#             {
#                 "index": i,
#                 "session_id": s.session_id,
#                 "active": i == self._active_index,
#                 "status": "cooling" if s.is_cooling else "ready",
#                 "ready_in_secs": s.seconds_until_ready,
#                 "request_count": s.request_count,
#                 "block_count": s.block_count,
#             }
#             for i, s in enumerate(self._pool)
#         ]

#     def __repr__(self) -> str:
#         ready = sum(1 for s in self._pool if not s.is_cooling)
#         return (
#             f"ProxyManager(slots={len(self._pool)}, "
#             f"ready={ready}, active={self._active_index})"
#         )

"""
scraper/proxy_manager.py

Manages IPRoyal residential sticky-session UAE proxies.

HOW IPROYAL STICKY SESSIONS WORK:
  IPRoyal pins you to one residential IP by embedding a session ID
  string into the proxy password. As long as you send the same session
  ID, you keep the same IP for up to 24 hours. This is critical for us
  because Akamai correlates IP across the bootstrap (browser) and all
  subsequent API calls (curl_cffi). A mid-session IP change = instant
  re-score and likely block.

  Sticky password format:
    {base_password}_country-ae_session-{session_id}_lifetime-24h

POOL DESIGN:
  We pre-generate N session IDs on startup. Each is an independent UAE
  IP. On a block we mark that slot as "cooling" and rotate to the next.
  This means a block never halts the whole scraper — we just switch lanes.

PROXY FORMAT BY CONSUMER:
  Patchright expects: {"server": "...", "username": "...", "password": "..."}
  curl_cffi expects:  "http://user:pass@host:port"
  Both are provided via dedicated methods so callers never build URLs.
"""

import logging
import random
import string
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _new_session_id(length: int = 10) -> str:
    """
    Generates a random alphanumeric string used as an IPRoyal session ID.
    Length 10 gives 36^10 ≈ 3.6 trillion combinations — no collision risk.
    """
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


# ─────────────────────────────────────────────────────────────────────────────
# PROXY SLOT — one UAE residential IP
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ProxySlot:
    """
    Represents one sticky-session proxy slot = one UAE residential IP.

    Fields:
      session_id    : The random string that pins us to one IP on IPRoyal.
      blocked_until : If set, this slot is in cooldown. Don't use until past.
      request_count : Informational — how many requests used this slot.
      block_count   : Informational — how many times this slot got blocked.
    """
    session_id: str
    blocked_until: Optional[datetime] = field(default=None)
    request_count: int = field(default=0)
    block_count: int = field(default=0)

    # ── state ──────────────────────────────────────────────────────────────

    @property
    def is_cooling(self) -> bool:
        """True if this slot is currently in cooldown period."""
        if self.blocked_until is None:
            return False
        return datetime.utcnow() < self.blocked_until

    @property
    def seconds_until_ready(self) -> int:
        """How many seconds until this cooling slot is usable again."""
        if not self.is_cooling:
            return 0
        return max(0, int((self.blocked_until - datetime.now(timezone.utc)).total_seconds()))

    # ── actions ────────────────────────────────────────────────────────────

    def mark_blocked(self) -> None:
        """
        Call this when Akamai blocks this IP.
        Puts slot into cooldown for BLOCK_COOLDOWN_MINS minutes.
        Also bumps the session_id so the next bootstrap with this slot
        gets a FRESH IP — we don't want to retry with the same flagged IP.
        """
        cooldown = settings.BLOCK_COOLDOWN_MINS
        self.blocked_until = datetime.now(timezone.utc) + timedelta(minutes=cooldown)
        self.block_count += 1
        old_id = self.session_id
        self.session_id = _new_session_id()          # fresh IP on next use
        logger.warning(
            f"[ProxySlot] Session {old_id!r} blocked. "
            f"New session {self.session_id!r} ready after "
            f"{self.blocked_until.strftime('%H:%M:%S')} UTC "
            f"({cooldown}min cooldown). Block #{self.block_count}."
        )

    # ── proxy format builders ──────────────────────────────────────────────

    def _http_password(self) -> str:
        """
        HTTP proxy password — no _streaming-1.
        Used by as_patchright_dict() for browser context.
        Browser currently runs without proxy, but method
        kept for completeness and future use.
        """
        return (
            f"{settings.IPROYAL_PASSWORD}"
            f"_country-{settings.IPROYAL_COUNTRY}"
            f"_session-{self.session_id}"
            f"_lifetime-{settings.IPROYAL_SESSION_LIFETIME}"
        )

    def _socks5_password(self) -> str:
        """
        SOCKS5 proxy password — _streaming-1 required.
        IPRoyal's SOCKS5 endpoint (port 11203) rejects
        connections without this suffix.
        """
        return (
            f"{settings.IPROYAL_PASSWORD}"
            f"_country-{settings.IPROYAL_COUNTRY}"
            f"_session-{self.session_id}"
            f"_lifetime-{settings.IPROYAL_SESSION_LIFETIME}"
            f"_streaming-1"
        )

    def as_patchright_dict(self) -> dict:
        """
        SOCKS5 format for Patchright browser bootstrap.
    
    Changed from HTTP to SOCKS5 because:
    HTTP proxy operates at the application layer — it modifies request
    headers and response timing. Akamai's sensor JS detects this
    interference and refuses to write bm_sv.
    
    SOCKS5 tunnels at the TCP layer — completely invisible to the 
    sensor JS. The UAE IP routing is preserved but the sensor sees
    a clean unmodified connection identical to a real browser.
    
    _streaming-1 suffix is required by IPRoyal's SOCKS5 endpoint.
    Without it the connection is refused.
        HTTP format for Patchright — kept for completeness.
        Browser bootstrap currently runs without any proxy.
        """

        # return {
        #     "server":   f"http://{settings.IPROYAL_HOST}:{settings.IPROYAL_HTTP_PORT}",
        #     "username": settings.IPROYAL_USERNAME,
        #     "password": self._http_password(),
        # }
        return {
        "server":   f"socks5://{settings.IPROYAL_HOST}:{settings.IPROYAL_SOCKS5_PORT}",
        "username": settings.IPROYAL_USERNAME,
        "password": self._socks5_password(),
    }


    def as_curl_url(self) -> str:
        """
        HTTP format for curl_cffi.
        SOCKS5 fails with error 97 in this environment.
        HTTP proxy works correctly for all curl_cffi calls.
        """
        return (
            f"http://{settings.IPROYAL_USERNAME}:{self._http_password()}"
            f"@{settings.IPROYAL_HOST}:{settings.IPROYAL_HTTP_PORT}"
        )

    def __repr__(self) -> str:
        status = f"cooling({self.seconds_until_ready}s)" if self.is_cooling else "ready"
        return (
            f"ProxySlot(session={self.session_id!r}, "
            f"status={status}, reqs={self.request_count}, "
            f"blocks={self.block_count})"
        )


# ─────────────────────────────────────────────────────────────────────────────
# PROXY MANAGER — pool orchestration
# ─────────────────────────────────────────────────────────────────────────────

class ProxyManager:
    """
    Orchestrates a pool of ProxySlot instances.

    Usage in the rest of the codebase:
      proxy = proxy_manager.get_patchright()   # for browser bootstrap
      proxy = proxy_manager.get_curl()         # for curl_cffi API calls
      proxy_manager.mark_blocked()             # when Akamai blocks us
      proxy_manager.rotate()                   # explicit rotate if needed

    The active slot is always proxy_manager.active — everything reads from
    this property so there is never a stale reference.
    """

    def __init__(self) -> None:
        self._pool: list[ProxySlot] = []
        self._active_index: int = 0
        self._build_pool()

    # ── setup ──────────────────────────────────────────────────────────────

    def _build_pool(self) -> None:
        """
        Creates IPROYAL_SESSION_COUNT independent sticky-session slots.
        Each gets a unique session_id so each maps to a different UAE IP.
        """
        count = settings.IPROYAL_SESSION_COUNT
        for i in range(count):
            slot = ProxySlot(session_id=_new_session_id())
            self._pool.append(slot)
            logger.debug(f"[ProxyManager] Slot {i}: {slot}")

        logger.info(
            f"[ProxyManager] Pool ready — "
            f"{count} sticky UAE residential slots. "
            f"HTTP: {settings.IPROYAL_HOST}:{settings.IPROYAL_HTTP_PORT} | "
            f"SOCKS5: {settings.IPROYAL_HOST}:{settings.IPROYAL_SOCKS5_PORT}"
        )

    # ── active slot access ─────────────────────────────────────────────────

    @property
    def active(self) -> ProxySlot:
        """The currently active ProxySlot."""
        return self._pool[self._active_index]

    def get_patchright(self) -> dict:
        """
        Returns the active proxy as a Patchright-compatible dict.
        Call this when launching the browser bootstrap.
        """
        proxy = self.active.as_patchright_dict()
        logger.debug(
            f"[ProxyManager] Patchright proxy → "
            f"session={self.active.session_id!r}"
        )
        return proxy

    def get_curl(self) -> str:
        """
        Returns the active proxy as a curl_cffi-compatible URL string.
        Call this when building the curl_cffi AsyncSession.
        """
        return self.active.as_curl_url()

    # ── state changes ──────────────────────────────────────────────────────

    def mark_blocked(self) -> None:
        """
        Call this when a hard block is detected (403, or silent empty results).
        Marks current slot as cooling with a fresh session ID, then rotates.
        The cooldown prevents immediately retrying with a flagged IP.
        """
        logger.warning(
            f"[ProxyManager] Active slot {self._active_index} "
            f"({self.active.session_id!r}) marked as blocked."
        )
        self.active.mark_blocked()
        self.rotate()

    def rotate(self) -> None:
        """
        Moves to the next non-cooling slot in the pool.

        If ALL slots are cooling (unlikely with 4+ slots but possible),
        we pick the one with the shortest remaining cooldown and log a
        warning so the operator knows to buy more proxy slots.
        """
        pool_size = len(self._pool)

        # Walk forward through the pool looking for a ready slot
        for step in range(1, pool_size + 1):
            candidate = (self._active_index + step) % pool_size
            if not self._pool[candidate].is_cooling:
                self._active_index = candidate
                logger.info(
                    f"[ProxyManager] Rotated to slot {self._active_index} "
                    f"(session={self.active.session_id!r})."
                )
                return

        # All slots cooling — use the one that recovers soonest
        soonest_index = min(
            range(pool_size),
            key=lambda i: self._pool[i].seconds_until_ready
        )
        self._active_index = soonest_index
        wait = self._pool[soonest_index].seconds_until_ready
        logger.warning(
            f"[ProxyManager] All {pool_size} slots are cooling. "
            f"Using soonest slot {soonest_index} "
            f"(session={self.active.session_id!r}). "
            f"Ready in {wait}s. Consider buying more proxy slots."
        )

    def log_request(self) -> None:
        """
        Increments the request counter on the active slot.
        Call this after every successful API response.
        """
        self.active.request_count += 1

    # ── diagnostics ────────────────────────────────────────────────────────

    def status(self) -> list[dict]:
        """
        Returns a snapshot of all slots — useful for logging and debugging.
        Call this at startup and after any rotation to see pool health.
        """
        return [
            {
                "index":          i,
                "session_id":     s.session_id,
                "active":         i == self._active_index,
                "status":         "cooling" if s.is_cooling else "ready",
                "ready_in_secs":  s.seconds_until_ready,
                "request_count":  s.request_count,
                "block_count":    s.block_count,
            }
            for i, s in enumerate(self._pool)
        ]

    def __repr__(self) -> str:
        ready = sum(1 for s in self._pool if not s.is_cooling)
        return (
            f"ProxyManager(slots={len(self._pool)}, "
            f"ready={ready}, active={self._active_index})"
        )