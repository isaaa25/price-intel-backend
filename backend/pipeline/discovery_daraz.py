"""
pipeline/discovery_daraz.py

On-demand competitor discovery for a single TrackedProduct on Daraz.

Used by:
  - POST /products/{product_id}/discover  (UI button)
  - Can later be called from CLI / scheduler for one product

Flow:
  1. Load product + store
  2. Resolve search_keyword (fallback to AI generalizer if missing)
  3. Scrape Daraz search
  4. AI relevance filter
  5. Soft-delete previous *pending* candidates (confirmed_by_user=False)
  6. Save new hits as unconfirmed candidates
  7. Set last_discovered_at = now()
  8. Return the newly saved candidate dicts (same shape as candidates API)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.tracked_product import TrackedProduct
from app.models.user_store import UserStore
from app.models.competitor_listing import CompetitorListing

from pipeline.cleaner import clean_daraz_hit
from pipeline.loader import save_product
from pipeline.ai.relevance_filter import filter_relevant_listings
from pipeline.orchestration_common import ensure_search_keyword

from scraper.platforms.daraz.search_scraper import scrape_search

logger = logging.getLogger(__name__)

DARAZ_COUNTRY_DOMAIN = {
    "Pakistan": "www.daraz.pk",
    "pk": "www.daraz.pk",
    "PK": "www.daraz.pk",
    "BD": "www.daraz.com.bd",
    "NP": "www.daraz.com.np",
    "MM": "www.daraz.com.mm",
}


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


async def discover_competitors_for_product(product_id: uuid.UUID) -> list[dict]:
    """
    Full discovery pipeline for one product.

    Returns list of newly saved candidate dicts (pending review).
    Raises ValueError for business errors the API should turn into 4xx.
    """
    ctx = await _load_product_context(product_id)
    if ctx is None:
        raise ValueError("Product not found or inactive")

    marketplace = (ctx["marketplace"] or "").lower()
    if marketplace != "daraz":
        raise ValueError(
            f"On-demand discovery is currently only supported for Daraz "
            f"(this product's store is marketplace={marketplace!r})."
        )

    country = ctx["country"]
    domain = DARAZ_COUNTRY_DOMAIN.get(country) or DARAZ_COUNTRY_DOMAIN.get(
        (country or "").upper()
    )
    if domain is None:
        raise ValueError(f"No Daraz domain mapping for country={country!r}")

    title = ctx["title"]
    search_keyword = ctx["search_keyword"]
    if not search_keyword:
        search_keyword = await ensure_search_keyword(
            ctx["tracked_product_id"], title
        )

    logger.info(
        f"[Discover] product={ctx['tracked_product_id'][:8]}... "
        f"keyword={search_keyword!r}"
    )

    # ── Scrape ──────────────────────────────────────────────────────────
    raw_products = await scrape_search(domain=domain, keyword=search_keyword)
    logger.info(f"[Discover] Found {len(raw_products)} raw listings")

    if raw_products:
        raw_products = await filter_relevant_listings(
            search_keyword=search_keyword,
            original_title=title,
            raw_listings=raw_products,
        )
        logger.info(f"[Discover] After filter: {len(raw_products)} listings")

    # ── Persist ─────────────────────────────────────────────────────────
    async with AsyncSessionLocal() as session:
        async with session.begin():
            cleared = await _clear_pending_candidates(
                session, ctx["tracked_product_id"]
            )
            if cleared:
                logger.info(
                    f"[Discover] Cleared {cleared} previous pending candidate(s)"
                )

            for raw in raw_products:
                clean = clean_daraz_hit(
                    raw,
                    marketplace=ctx["marketplace"],
                    country=country,
                )
                clean["user_id"] = ctx["user_id"]
                clean["tracked_product_id"] = ctx["tracked_product_id"]
                clean["scrape_job_id"] = None
                # Ensure discovery path marks these as search-discovered + unconfirmed
                clean.setdefault("discovered_by", "search")
                clean.setdefault("confirmed_by_user", False)

                await save_product(session, clean)

            await _mark_discovered(session, ctx["tracked_product_id"])

            candidates = await _fetch_candidates_after_save(
                session, ctx["tracked_product_id"]
            )

    logger.info(
        f"[Discover] Done | product={ctx['tracked_product_id'][:8]}... "
        f"| candidates={len(candidates)}"
    )
    return candidates