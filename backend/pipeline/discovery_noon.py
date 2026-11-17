"""
pipeline/discovery_noon.py

On-demand competitor discovery for a single TrackedProduct on Noon.

Used by:
  - POST /products/{product_id}/discover (via discovery router / service)
  - CLI / background tasks

Flow:
  1. Load product + store context
  2. Resolve search_keyword (AI generalizer if missing)
  3. Scrape Noon search via SessionManager + curl_cffi
  4. AI relevance filter (Gemini)
  5. Soft-delete previous pending candidates (confirmed_by_user=False)
  6. Save new hits as unconfirmed candidates
  7. Set last_discovered_at = now()
  8. Return newly saved candidate dicts
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.tracked_product import TrackedProduct
from app.models.user_store import UserStore
from app.models.competitor_listing import CompetitorListing

from pipeline.cleaner import clean_product
from pipeline.loader import save_product
from pipeline.ai.relevance_filter import filter_relevant_listings
from pipeline.orchestration_common import ensure_search_keyword

from scraper.platforms.noon.session_manager import SessionManager
from scraper.platforms.noon.search_scraper import scrape_search

logger = logging.getLogger(__name__)

NOON_COUNTRY_MAP: dict[str, dict[str, str]] = {
    "saudi arabia": {"code": "sa", "locale": "saudi-en", "country": "Saudi Arabia"},
    "sa":           {"code": "sa", "locale": "saudi-en", "country": "Saudi Arabia"},
    "sau":          {"code": "sa", "locale": "saudi-en", "country": "Saudi Arabia"},
    "uae":          {"code": "ae", "locale": "uae-en",   "country": "UAE"},
    "ae":           {"code": "ae", "locale": "uae-en",   "country": "UAE"},
    "egypt":        {"code": "eg", "locale": "egypt-en", "country": "Egypt"},
    "eg":           {"code": "eg", "locale": "egypt-en", "country": "Egypt"},
    "egy":          {"code": "eg", "locale": "egypt-en", "country": "Egypt"},
    "kuwait":       {"code": "kw", "locale": "kuwait-en","country": "Kuwait"},
    "kw":           {"code": "kw", "locale": "kuwait-en","country": "Kuwait"},
    "qatar":        {"code": "qa", "locale": "qatar-en", "country": "Qatar"},
    "qa":           {"code": "qa", "locale": "qatar-en", "country": "Qatar"},
    "bahrain":      {"code": "bh", "locale": "bahrain-en","country": "Bahrain"},
    "bh":           {"code": "bh", "locale": "bahrain-en","country": "Bahrain"},
    "oman":         {"code": "om", "locale": "oman-en",  "country": "Oman"},
    "om":           {"code": "om", "locale": "oman-en",  "country": "Oman"},
}

_session_managers: dict[str, SessionManager] = {}


async def _get_noon_session_manager(country_code: str) -> SessionManager:
    """Returns a cached or freshly initialised SessionManager for the country."""
    sm = _session_managers.get(country_code)
    if sm is None:
        sm = SessionManager(
            scrapfly_api_key=settings.SCRAPFLY_API_KEY,
            use_proxy=getattr(settings, "USE_PROXY", False),
            proxy_url=getattr(settings, "IPROYAL_PROXY_URL", None) if getattr(settings, "USE_PROXY", False) else None,
            country=country_code,
        )
        await sm.initialise()
        _session_managers[country_code] = sm
    return sm


async def _load_product_context(product_id: uuid.UUID) -> dict[str, Any] | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TrackedProduct, UserStore)
            .join(UserStore, TrackedProduct.store_id == UserStore.id)
            .where(TrackedProduct.id == product_id)
            .where(TrackedProduct.is_active == True)
        )
        row = result.first()
        if row is None:
            return None
        tracked, store = row
        return {
            "tracked_product_id": str(tracked.id),
            "user_id": str(store.user_id),
            "title": tracked.title,
            "search_keyword": tracked.search_keyword,
            "country": store.country,
            "marketplace": store.marketplace,
        }


async def _clear_pending_candidates(session: AsyncSession, tracked_product_id: str) -> int:
    """Soft-delete all unconfirmed candidates for this product."""
    result = await session.execute(
        update(CompetitorListing)
        .where(CompetitorListing.tracked_product_id == tracked_product_id)
        .where(CompetitorListing.confirmed_by_user == False)
        .where(CompetitorListing.is_active == True)
        .values(is_active=False)
    )
    return result.rowcount or 0


async def _mark_discovered(session: AsyncSession, tracked_product_id: str) -> None:
    await session.execute(
        update(TrackedProduct)
        .where(TrackedProduct.id == tracked_product_id)
        .values(last_discovered_at=datetime.now(timezone.utc))
    )


async def _fetch_candidates_after_save(
    session: AsyncSession, tracked_product_id: str
) -> list[dict]:
    """Return active unconfirmed candidates (same shape as get_competitor_candidates)."""
    from sqlalchemy import text

    result = await session.execute(
        text("""
            SELECT
                cl.id, cl.url, cl.platform, cl.name, cl.image_url,
                cl.is_active, cl.discovered_by, cl.confirmed_by_user,
                (SELECT ps.price FROM price_snapshots ps
                 WHERE ps.competitor_listing_id = cl.id
                 ORDER BY ps.scraped_at DESC LIMIT 1) AS latest_price,
                (SELECT ps.scraped_at FROM price_snapshots ps
                 WHERE ps.competitor_listing_id = cl.id
                 ORDER BY ps.scraped_at DESC LIMIT 1) AS last_scraped_at
            FROM competitor_listings cl
            WHERE cl.tracked_product_id = :pid
              AND cl.confirmed_by_user = false
              AND cl.is_active = true
            ORDER BY cl.created_at DESC
        """),
        {"pid": tracked_product_id},
    )
    rows = result.fetchall()
    return [
        {
            "id": str(r.id),
            "url": r.url,
            "platform": r.platform,
            "name": r.name,
            "image_url": r.image_url,
            "is_active": r.is_active,
            "discovered_by": r.discovered_by,
            "confirmed_by_user": r.confirmed_by_user,
            "latest_price": r.latest_price,
            "last_scraped_at": r.last_scraped_at.isoformat() if r.last_scraped_at else None,
        }
        for r in rows
    ]


async def discover_competitors_for_noon_context(ctx: dict[str, Any]) -> list[dict]:
    """Runs full discovery pipeline for a loaded Noon product context."""
    country_raw = (ctx["country"] or "UAE").strip()
    country_info = NOON_COUNTRY_MAP.get(
        country_raw.lower(),
        {"code": "ae", "locale": "uae-en", "country": country_raw}
    )
    country_code = country_info["code"]
    locale = country_info["locale"]
    country_name = country_info["country"]

    title = ctx["title"]
    search_keyword = ctx.get("search_keyword")
    if not search_keyword:
        search_keyword = await ensure_search_keyword(
            ctx["tracked_product_id"], title
        )

    logger.info(
        f"[Discover Noon] product={ctx['tracked_product_id'][:8]}... "
        f"country={country_name} keyword={search_keyword!r}"
    )

    # ── Scrape Noon ─────────────────────────────────────────────────────────
    try:
        sm = await _get_noon_session_manager(country_code)
        raw_products = await scrape_search(
            session_manager=sm,
            keyword=search_keyword,
            pages=1,  # 1 page of Noon search returns up to 50 items
            sort_by="recommended",
            locale=locale,
        )
    except Exception as exc:
        logger.error(
            f"[Discover Noon] Scraper error for keyword={search_keyword!r}: {exc}",
            exc_info=True,
        )
        raise ValueError(f"Noon search failed for '{search_keyword}': {exc}") from exc

    logger.info(f"[Discover Noon] Found {len(raw_products)} raw listings")

    # ── AI Relevance Filter ─────────────────────────────────────────────────
    if raw_products:
        raw_products = await filter_relevant_listings(
            search_keyword=search_keyword,
            original_title=title,
            raw_listings=raw_products,
        )
        logger.info(f"[Discover Noon] After AI relevance filter: {len(raw_products)} listings")

    # ── Persist ─────────────────────────────────────────────────────────────
    async with AsyncSessionLocal() as session:
        async with session.begin():
            cleared = await _clear_pending_candidates(
                session, ctx["tracked_product_id"]
            )
            if cleared:
                logger.info(
                    f"[Discover Noon] Cleared {cleared} previous pending candidate(s)"
                )

            for raw in raw_products:
                clean = clean_product(
                    raw,
                    marketplace="noon",
                    country=country_name,
                )
                clean["user_id"] = ctx["user_id"]
                clean["tracked_product_id"] = ctx["tracked_product_id"]
                clean["scrape_job_id"] = None
                clean.setdefault("discovered_by", "noon_search")
                clean.setdefault("confirmed_by_user", False)

                await save_product(session, clean)

            await _mark_discovered(session, ctx["tracked_product_id"])

            candidates = await _fetch_candidates_after_save(
                session, ctx["tracked_product_id"]
            )

    logger.info(
        f"[Discover Noon] Done | product={ctx['tracked_product_id'][:8]}... "
        f"| candidates={len(candidates)}"
    )
    return candidates


async def discover_competitors_for_noon_product(product_id: uuid.UUID) -> list[dict]:
    """Full Noon discovery pipeline for one product id."""
    ctx = await _load_product_context(product_id)
    if ctx is None:
        raise ValueError("Product not found or inactive")

    marketplace = (ctx["marketplace"] or "").lower()
    if marketplace != "noon":
        raise ValueError(
            f"Noon discovery called for non-Noon product (marketplace={marketplace!r})"
        )

    return await discover_competitors_for_noon_context(ctx)
