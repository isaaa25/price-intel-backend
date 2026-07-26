"""
main.py — Price Intel orchestrator

WHAT CHANGED FROM THE OLD main.py:
    Old: imported from pipeline.models (old 5-table schema)
         used sync SessionLocal
         Seller table drove store monitoring

    New: imports from app.models (Price Intel schema)
         uses AsyncSessionLocal (matches async loader)
         TrackedProduct table drives all scraping

FLOW PER RUN:
    1. Load all active TrackedProducts from price_intel database
    2. For each TrackedProduct, run Noon search using product title
    3. Clean each result → inject user_id + tracked_product_id
    4. Save via loader → MarketplaceSeller → CompetitorListing
                       → PriceSnapshot → Alert
    5. Log run stats

TRANSACTION BOUNDARY:
    One async transaction per TrackedProduct.
    async with session.begin() auto-commits on success,
    auto-rolls-back on any exception.
    The loader never calls commit() or rollback().
"""

import asyncio
import argparse
import logging
import time
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.tracked_product import TrackedProduct
from app.models.user_store import UserStore
from app.models.competitor_listing import CompetitorListing
from app.models.scrape_job import ScrapeJob

from pipeline.cleaner import clean_product
from pipeline.loader import save_product
from pipeline.loader import save_monitoring_snapshot

from scraper.platforms.noon.proxy_manager import ProxyManager
from scraper.platforms.noon.session_manager import SessionManager
from scraper.platforms.noon.search_scraper import scrape_search
from scraper.platforms.noon.product_scraper import scrape_product_page
from scraper.platforms.noon.utils import (
    random_delay,
    extract_sku_from_url,
    extract_offer,
    extract_signals,
)

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")


# ─── Counter helpers ──────────────────────────────────────────────────────────

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
    status = result.get("status")
    if status == "rejected":
        counters["products_rejected"] += 1
        counters["errors"] += 1
    elif status == "skipped":
        counters["products_skipped"] += 1
    elif status == "saved":
        counters["products_saved"] += 1
        counters["alerts_triggered"] += result.get("alerts", 0)


# ─── Load tracked products ────────────────────────────────────────────────────

async def load_tracked_products() -> list[dict]:
    """
    Loads all active TrackedProducts from the database.

    Returns a list of dicts (not ORM objects) so they stay usable
    after the session closes. Each dict includes the user_id resolved
    through the UserStore relationship.

    This runs in its own session that closes immediately after the query.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TrackedProduct, UserStore)
            .join(UserStore, TrackedProduct.store_id == UserStore.id)
            .where(TrackedProduct.is_active == True)
            .where(UserStore.is_active == True)
            .where(UserStore.marketplace == "noon")
        )
        rows = result.all()

    if not rows:
        logger.warning(
            "No active TrackedProducts found for marketplace='noon'. "
            "Add a product via the database first."
        )
        return []

    products = []
    for tracked, store in rows:
        products.append({
            "tracked_product_id": str(tracked.id),
            "user_id":            str(store.user_id),
            "title":              tracked.title,
            "country":            store.country,   # "UAE", "SAU" etc.
            "marketplace":        store.marketplace,
        })

    logger.info(f"Loaded {len(products)} active tracked product(s).")
    return products


# ─── Load confirmed listings ───────────────────────────────────────────────

async def load_confirmed_listings(session) -> dict:
    """
    Loads all confirmed, active CompetitorListings, grouped by
    tracked_product_id, within the GIVEN session (not a short-lived
    throwaway session like load_tracked_products uses).
 
    Deliberately shares the caller's session rather than detaching into
    plain dicts and closing: Step 4's save_monitoring_snapshot mutates
    listing.consecutive_unchanged, volatility_score, last_price_change_at,
    and listing.marketplace_seller.external_store_id directly on the ORM
    objects. Keeping them attached to the same session that will commit
    those mutations is simpler and correct for now; if monitoring needs
    to scale to multiple concurrent workers later, this is the first
    place to revisit (would need to go back to detach-then-reattach, or
    per-worker session partitioning).
 
    marketplace_seller is eager-loaded via selectinload so
    listing.marketplace_seller.external_store_id is available without
    triggering a lazy-load — required since matching against
    offer["partner_code"] happens after the scrape, and a lazy-load at
    that point would still work (session is open) but eager-loading here
    is one clean query instead of N+1 individual lookups.
 
    Returns:
      {
        tracked_product_id (str): {
            "user_id": str,
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
        .where(UserStore.marketplace == "noon")
        .options(selectinload(CompetitorListing.marketplace_seller))
    )
    rows = result.all()
 
    grouped: dict = {}
    for listing, tracked, store in rows:
        tracked_product_id = str(tracked.id)
        if tracked_product_id not in grouped:
            grouped[tracked_product_id] = {
                "user_id": str(store.user_id),
                "listings": [],
            }
        grouped[tracked_product_id]["listings"].append(listing)
 
    if not grouped:
        logger.warning(
            "No confirmed CompetitorListings found for marketplace='noon'. "
            "Nothing to monitor."
        )
 
    total_listings = sum(len(v["listings"]) for v in grouped.values())
    logger.info(
        f"Loaded {total_listings} confirmed listing(s) across "
        f"{len(grouped)} tracked product(s)."
    )
    return grouped
async def _create_scrape_job(session, listing: CompetitorListing) -> ScrapeJob:
    """
    Creates a ScrapeJob row for one listing, at the moment we're about to
    scrape it. status starts as "running" — updated to "done" or "failed"
    by _finalize_scrape_job once the outcome is known.
 
    scheduled_at and started_at are set to the same timestamp for now —
    there is no separate scheduling/queueing layer yet, so "when this was
    scheduled" and "when it actually started" are the same moment. This
    is the first field worth revisiting if a real scheduler is built later.
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
 
 
async def _finalize_scrape_job(
    session,
    job: ScrapeJob,
    *,
    success: bool,
    items_updated: int = 0,
    alerts_triggered: int = 0,
    error_detail: str | None = None,
) -> None:
    """
    Updates a ScrapeJob row once its outcome is known — whether that's a
    successful save/skip, or a failure at any point (scrape_product_page
    returning None, an exception during save_monitoring_snapshot, etc.).
 
    Failed scrapes get a row too, not just successful ones — this is
    deliberate: it's what makes scrape_jobs useful as an observability
    table ("how often does this specific listing fail to scrape") rather
    than just a log of successes, per our earlier discussion about
    keeping this table instead of discarding it.
 
    items_found is always 1 here — each ScrapeJob is scoped to exactly
    one CompetitorListing (the model's competitor_listing_id is singular
    and NOT NULL), even when several listings shared one underlying API
    call because they sell the same SKU. items_updated is 1 only if a
    new PriceSnapshot was actually inserted (not on a "skipped, unchanged"
    result), matching how items_updated is documented on the model
    ("products whose price or status actually changed").
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
        job.failure_reason = error_detail[:500]  # failure_reason has no explicit limit in the model but keep it short/scannable
    session.add(job)
    await session.flush()
 

# ─── Discovery mode ───────────────────────────────────────────────────────────

async def run_discovery(session_manager: SessionManager) -> None:
    """
    For each TrackedProduct, searches Noon using the product title,
    then saves all competitor listings found.

    One async DB transaction per TrackedProduct.
    If one product fails, others are unaffected.
    """
    tracked_products = await load_tracked_products()

    if not tracked_products:
        return

    for tracked in tracked_products:
        title              = tracked["title"]
        tracked_product_id = tracked["tracked_product_id"]
        user_id            = tracked["user_id"]
        country            = tracked["country"]
        marketplace        = tracked["marketplace"]

        logger.info(
            f"─── Searching: '{title}' "
            f"(tracked_product_id={tracked_product_id[:8]}...) "
            + "─" * 20
        )
        start_time = time.time()
        counters   = _empty_counters()

        try:
            # ── Step 1: Scrape Noon ───────────────────────────────────────
            raw_products = await scrape_search(
                session_manager = session_manager,
                keyword         = title,
                pages           = settings.pages_per_keyword,
                sort_by         = "recommended",
            )

            counters["products_found"] = len(raw_products)
            logger.info(f"  Found {len(raw_products)} listings for '{title}'.")

            if not raw_products:
                continue

            # ── Step 2: Clean → inject IDs → save ────────────────────────
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    for raw in raw_products:
                        # Clean: validate and normalise scraper output
                        clean = clean_product(
                            raw,
                            marketplace = marketplace,
                            country     = country,
                        )

                        # Inject context IDs — cleaner never knows these
                        clean["user_id"]            = user_id
                        clean["tracked_product_id"] = tracked_product_id
                        clean["scrape_job_id"]      = None

                        # Save to database
                        result = await save_product(session, clean)
                        _update_counters(counters, result)

            # ── Step 3: Log ───────────────────────────────────────────────
            duration = round(time.time() - start_time, 2)
            logger.info(
                f"  Done | "
                f"saved={counters['products_saved']} | "
                f"skipped={counters['products_skipped']} | "
                f"rejected={counters['products_rejected']} | "
                f"alerts={counters['alerts_triggered']} | "
                f"{duration}s"
            )

        except Exception as exc:
            duration = round(time.time() - start_time, 2)
            logger.error(
                f"  Failed: '{title}' | {exc} | {duration}s",
                exc_info=True,
            )
            # session.begin() already rolled back automatically on exception
            # Other tracked products continue unaffected

        # Polite delay between products
        if tracked != tracked_products[-1]:
            await random_delay()

# ─── Store monitoring mode ──────────────────────────────────────────────────
 
async def run_store_monitoring(session_manager: SessionManager) -> None:
    """
    Scrapes only confirmed competitor listings directly by URL — no
    keyword search, goes straight to each SKU's product-page API. Faster
    than discovery mode and the only mode that writes PriceSnapshot rows
    for listings the user has explicitly confirmed as real competitors.
 
    FLOW PER TRACKED PRODUCT:
        1. Load confirmed listings for this tracked product
        2. Dedupe by extracted SKU — several confirmed listings can share
           one SKU (multiple sellers of the exact same product), in which
           case one API call covers all of them
        3. For each unique SKU: scrape once, then loop every listing that
           shares that SKU, matching each to its offer via
           offer["partner_code"] == listing.marketplace_seller.external_store_id
        4. Unmatched listings (confirmed, but not found in this scrape —
           e.g. seller stopped selling, or external_store_id never got
           backfilled) are logged and skipped, not treated as errors
        5. Each matched listing gets its own ScrapeJob row (created before
           the write, finalized after — success or failure) and its own
           save_monitoring_snapshot() call
 
    TRANSACTION BOUNDARY:
        One async transaction per TrackedProduct — same pattern as
        run_discovery. If one tracked product's monitoring run fails
        partway through, other tracked products are unaffected. Within
        a tracked product, all listing updates for that run share one
        transaction (commits together, rolls back together) — this
        matches the existing poisoned-transaction protection rather than
        introducing a new granularity.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            confirmed_by_product = await load_confirmed_listings(session)
 
        if not confirmed_by_product:
            return
 
        for tracked_product_id, data in confirmed_by_product.items():
            user_id = data["user_id"]
            listings = data["listings"]
 
            logger.info(
                f"─── Monitoring: {len(listings)} confirmed listing(s) "
                f"(tracked_product_id={tracked_product_id[:8]}...) "
                + "─" * 20
            )
            start_time = time.time()
            counters = _empty_counters()
 
            # ── Group confirmed listings by extracted SKU ─────────────────
            unique_skus: dict[str, list[CompetitorListing]] = {}
            for listing in listings:
                sku = extract_sku_from_url(listing.url)
                if sku is None:
                    logger.warning(
                        f"  Could not extract SKU from listing url, "
                        f"skipping: {listing.url[:80]}"
                    )
                    continue
                unique_skus.setdefault(sku, []).append(listing)
 
            try:
                async with session.begin():
                    for sku, listings_sharing_sku in unique_skus.items():
                        representative = listings_sharing_sku[0]
 
                        scrape_result = await scrape_product_page(
                            session_manager, representative.url
                        )
 
                        if scrape_result is None:
                            # Whole SKU failed to scrape — log a failed
                            # ScrapeJob for every listing that would have
                            # been checked, so monitoring history stays
                            # complete even on failure.
                            logger.warning(
                                f"  Scrape failed for SKU {sku} "
                                f"({len(listings_sharing_sku)} listing(s) affected)."
                            )
                            for listing in listings_sharing_sku:
                                job = await _create_scrape_job(session, listing)
                                await _finalize_scrape_job(
                                    session, job,
                                    success=False,
                                    error_detail="scrape_product_page returned None "
                                                  "(network error, block, or malformed response)",
                                )
                                counters["errors"] += 1
                            continue
 
                        offers, product_rating = scrape_result
 
                        for listing in listings_sharing_sku:
                            seller = listing.marketplace_seller
                            external_id = seller.external_store_id if seller else None
 
                            matched_offer = None
                            for offer in offers:
                                if external_id and offer.get("partner_code") == external_id:
                                    matched_offer = offer
                                    break
 
                            if matched_offer is None:
                                logger.info(
                                    f"  Confirmed listing not found in scrape "
                                    f"(seller may have stopped selling, or "
                                    f"external_store_id not yet backfilled): "
                                    f"listing={listing.id}"
                                )
                                job = await _create_scrape_job(session, listing)
                                await _finalize_scrape_job(
                                    session, job,
                                    success=False,
                                    error_detail="No matching offer found for this "
                                                  "listing's seller in the scraped response",
                                )
                                counters["errors"] += 1
                                continue
 
                            offer_data = extract_offer(matched_offer, product_rating)
                            signal_data = extract_signals(matched_offer)
 
                            job = await _create_scrape_job(session, listing)
 
                            try:
                                result = await save_monitoring_snapshot(
                                    session=session,
                                    listing=listing,
                                    offer_data=offer_data,
                                    signal_data=signal_data,
                                    partner_code=matched_offer.get("partner_code"),
                                    scrape_job_id=job.id,
                                    user_id=uuid.UUID(user_id),
                                )
                                await _finalize_scrape_job(
                                    session, job,
                                    success=True,
                                    items_updated=1 if result["snapshot"] else 0,
                                    alerts_triggered=result["alerts"],
                                )
                                _update_counters(counters, result)
 
                            except Exception as exc:
                                await _finalize_scrape_job(
                                    session, job,
                                    success=False,
                                    error_detail=str(exc),
                                )
                                # Re-raise: this listing's failure rolls back
                                # the whole tracked-product transaction, same
                                # as run_discovery's existing behavior on any
                                # unhandled exception inside session.begin().
                                raise
 
                        await random_delay()
 
                duration = round(time.time() - start_time, 2)
                logger.info(
                    f"  Done | "
                    f"saved={counters['products_saved']} | "
                    f"skipped={counters['products_skipped']} | "
                    f"errors={counters['errors']} | "
                    f"alerts={counters['alerts_triggered']} | "
                    f"{duration}s"
                )
 
            except Exception as exc:
                duration = round(time.time() - start_time, 2)
                logger.error(
                    f"  Failed: tracked_product_id={tracked_product_id[:8]}... "
                    f"| {exc} | {duration}s",
                    exc_info=True,
                )
                # session.begin() already rolled back automatically
 
            if tracked_product_id != list(confirmed_by_product.keys())[-1]:
                await random_delay()


# ─── Entry point ──────────────────────────────────────────────────────────────

async def main(mode: str) -> None:
    logger.info(f"Price Intel starting | mode={mode}")

    # ── Stealth session layer ─────────────────────────────────────────────
    proxy_manager   = ProxyManager()
    session_manager = SessionManager(proxy_manager)

    logger.info("Initialising Noon session...")
    await session_manager.initialise()

    status = session_manager.get_status()
    logger.info(
        f"Session ready | "
        f"age={status.get('bootstrap_age_h')}h | "
        f"jwt_ttl={status.get('jwt_expires_in_s')}s"
    )

    # ── Run requested mode ────────────────────────────────────────────────
    if mode == "discovery":
        await run_discovery(session_manager)

    elif mode == "full":
        await run_discovery(session_manager)
    elif mode == 'monitor':
        await run_store_monitoring(session_manager)
        # store monitoring mode comes after you verify discovery works

    logger.info(f"Price Intel finished | mode={mode}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="main.py")
    parser.add_argument(
        "--mode",
        choices=["discovery", "full","monitor"],
        default="monitor",
    )
    args = parser.parse_args()
    asyncio.run(main(args.mode))