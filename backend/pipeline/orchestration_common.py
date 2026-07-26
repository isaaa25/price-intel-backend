"""
pipeline/orchestration_common.py

Platform-agnostic orchestration helpers shared by main_noon.py and
main_daraz.py.

WHAT BELONGS HERE, AND WHY — the test applied to every function below:
does its LOGIC differ by platform, or only the DATA flowing through it?
Only true logic-sharing lives in this file. Anything where the actual
scrape call, matching step, or write shape differs per platform stays
in that platform's own main_*.py — see _run_own_snapshot_noon /
_run_own_snapshot_daraz for the clearest example of something that
looks shared but isn't.

Every function here was lifted unchanged (aside from the marketplace
parameter added to the two loader queries) from the single merged
main.py — nothing here is new logic, just relocated shared logic.
"""

import asyncio
import uuid
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select,update
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.tracked_product import TrackedProduct
from app.models.user_store import UserStore
from app.models.competitor_listing import CompetitorListing
from app.models.scrape_job import ScrapeJob
from pipeline.ai.query_generalizer import generalize_title

logger = logging.getLogger("orchestration_common")


# ─── Counter helpers ────────────────────────────────────────────────────────

def _empty_counters() -> dict:
    return {
        "products_found":   0,
        "products_saved":   0,
        "products_skipped": 0,
        "products_rejected":0,
        "alerts_triggered": 0,
        "errors":           0,
    }


def _update_counters(counters: dict, result: dict) -> None:
    """
    Reads the generic {"status": ..., "alerts": ...} shape that every
    save_* loader entry point returns identically — save_product,
    save_monitoring_snapshot, save_daraz_monitoring_snapshot, and
    save_own_snapshot all conform to this same contract, which is what
    makes this function usable by both platforms unchanged.
    """
    status = result.get("status")
    if status == "rejected":
        counters["products_rejected"] += 1
        counters["errors"] += 1
    elif status == "skipped":
        counters["products_skipped"] += 1
    elif status == "saved":
        counters["products_saved"] += 1
        counters["alerts_triggered"] += result.get("alerts", 0)


# ─── Load tracked products (single marketplace) ────────────────────────────

async def load_tracked_products(marketplace: str) -> list[dict]:
    """
    Loads all active TrackedProducts for ONE marketplace ("noon" or
    "daraz"). The marketplace filter is a parameter, not a hardcoded
    string, so this function itself stays platform-neutral — each
    main_*.py supplies its own value.

    Returns a list of dicts (not ORM objects) so they stay usable
    after the session closes.

    This runs in its own session that closes immediately after the query.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TrackedProduct, UserStore)
            .join(UserStore, TrackedProduct.store_id == UserStore.id)
            .where(TrackedProduct.is_active == True)
            .where(UserStore.is_active == True)
            .where(UserStore.marketplace == marketplace)
        )
        rows = result.all()

    if not rows:
        logger.warning(
            f"No active TrackedProducts found for marketplace={marketplace!r}. "
            f"Add a product via the database first."
        )
        return []

    products = []
    for tracked, store in rows:
        products.append({
            "tracked_product_id": str(tracked.id),
            "user_id":            str(store.user_id),
            "title":              tracked.title,
            "search_keyword":     tracked.search_keyword,
            "own_url":            tracked.own_url,
            "country":            store.country,
            "marketplace":        store.marketplace,
        })

    logger.info(
        f"Loaded {len(products)} active tracked product(s) for "
        f"marketplace={marketplace!r}."
    )
    return products


# ─── Load confirmed listings (single marketplace) ──────────────────────────

async def load_confirmed_listings(session, marketplace: str) -> dict:
    """
    Loads all confirmed, active CompetitorListings for ONE marketplace,
    grouped by tracked_product_id, within the GIVEN session. Same
    parameterization reasoning as load_tracked_products above.

    Each group also carries the tracked product's own_url, country,
    and marketplace, so each main_*.py's monitoring loop can run its
    own-product snapshot step without a second query.

    Deliberately shares the caller's session rather than detaching into
    plain dicts and closing: the Noon write path mutates
    listing.consecutive_unchanged, volatility_score,
    last_price_change_at, and listing.marketplace_seller.
    external_store_id directly on the ORM objects (the Daraz write path
    does the same, minus the partner_code matching). Keeping them
    attached to the same session that will commit those mutations is
    simplest and correct for now; if monitoring needs to scale to
    multiple concurrent workers later, this is the first place to
    revisit.

    marketplace_seller is eager-loaded via selectinload — required for
    Noon's partner_code matching; harmless/unused on the Daraz path,
    which gets seller_external_id directly from every scrape instead.

    Returns:
      {
        tracked_product_id (str): {
            "user_id": str,
            "own_url": str,
            "country": str,
            "marketplace": str,
            "listings": list[CompetitorListing],
        },
        ...
      }
    """
    result = await session.execute(
        select(CompetitorListing, TrackedProduct, UserStore)
        .join(TrackedProduct, CompetitorListing.tracked_product_id == TrackedProduct.id)
        .join(UserStore, TrackedProduct.store_id == UserStore.id)
        .where(CompetitorListing.confirmed_by_user == True)
        .where(CompetitorListing.is_active == True)
        .where(TrackedProduct.is_active == True)
        .where(UserStore.is_active == True)
        .where(UserStore.marketplace == marketplace)
        .options(selectinload(CompetitorListing.marketplace_seller))
    )
    rows = result.all()

    grouped: dict = {}
    for listing, tracked, store in rows:
        tracked_product_id = str(tracked.id)
        if tracked_product_id not in grouped:
            grouped[tracked_product_id] = {
                "user_id": str(store.user_id),
                "own_url": tracked.own_url,
                "country": store.country,
                "marketplace": store.marketplace,
                "listings": [],
            }
        grouped[tracked_product_id]["listings"].append(listing)

    if not grouped:
        logger.warning(
            f"No confirmed CompetitorListings found for "
            f"marketplace={marketplace!r}. Nothing to monitor."
        )

    total_listings = sum(len(v["listings"]) for v in grouped.values())
    logger.info(
        f"Loaded {total_listings} confirmed listing(s) across "
        f"{len(grouped)} tracked product(s) for marketplace={marketplace!r}."
    )
    return grouped


# ─── ScrapeJob lifecycle helpers ────────────────────────────────────────────

async def create_scrape_job(session, listing: CompetitorListing) -> ScrapeJob:
    """
    Creates a ScrapeJob row for one listing, at the moment we're about
    to scrape it. status starts as "running" — updated to "done" or
    "failed" by finalize_scrape_job once the outcome is known.

    Platform-agnostic: only ever reads listing.id / listing.url, never
    anything platform-specific.

    scheduled_at and started_at are set to the same timestamp for now
    — there is no separate scheduling/queueing layer yet, so "when
    this was scheduled" and "when it actually started" are the same
    moment. First field worth revisiting if a real scheduler is built.
    """
    now = datetime.utcnow()
    job = ScrapeJob(
        competitor_listing_id=listing.id,
        target_identifier=listing.url,
        status="running",
        scheduled_at=now,
        started_at=now,
        attempt_number=1,
    )
    session.add(job)
    await session.flush()
    return job


async def finalize_scrape_job(
    session,
    job: ScrapeJob,
    *,
    success: bool,
    items_updated: int = 0,
    alerts_triggered: int = 0,
    error_detail: Optional[str] = None,
) -> None:
    """
    Updates a ScrapeJob row once its outcome is known — success or
    failure at any point. Platform-agnostic: only touches ScrapeJob
    columns.

    Failed scrapes get a row too, not just successful ones — this is
    what makes scrape_jobs useful as an observability table ("how
    often does this specific listing fail to scrape") rather than just
    a log of successes.

    items_found is always 1 — each ScrapeJob is scoped to exactly one
    CompetitorListing. items_updated is 1 only if a new PriceSnapshot
    was actually inserted (not on a "skipped, unchanged" result).
    """
    now = datetime.utcnow()
    job.status = "done" if success else "failed"
    job.completed_at = now
    job.items_found = 1
    job.items_updated = items_updated
    job.alerts_triggered = alerts_triggered
    job.duration_secs = (now - job.started_at).total_seconds()
    if error_detail:
        job.error_detail = error_detail
        job.failure_reason = error_detail[:500]
    session.add(job)
    await session.flush()


async def ensure_search_keyword(tracked_product_id: str, title: str) -> str:
    """
    Lazy fallback for tracked products that reached the scraper with no
    search_keyword (created before this feature existed, or the
    Gemini call at creation time failed). Generates one now and
    persists it in its own short-lived session, so this only happens
    once per product, not on every discovery run.

    generalize_title() is a blocking call — run in a thread so it
    doesn't stall the event loop, same reasoning as the API layer's
    run_in_threadpool usage, just asyncio's own equivalent since this
    file isn't a FastAPI context.
    """
    keyword = await asyncio.to_thread(generalize_title, title)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                update(TrackedProduct)
                .where(TrackedProduct.id == uuid.UUID(tracked_product_id))
                .values(search_keyword=keyword)
            )

    return keyword