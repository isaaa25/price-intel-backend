"""
main_noon.py — Price Intel orchestrator, NOON ONLY

Split out from the previous merged main.py so Noon's scheduling,
imports, and debugging surface never have to touch Daraz's code at
all, and vice versa (see main_daraz.py). This file is deliberately
close to the original, pre-Daraz main.py in shape — the only genuinely
new piece of business logic is the own-product snapshot step
(_run_own_snapshot_noon), added at the end of run_store_monitoring's
per-tracked-product loop.

Shared, platform-agnostic plumbing (counters, ScrapeJob lifecycle,
the two DB-loading queries) now lives in pipeline/orchestration_common
and is imported, not redefined here.

FLOW PER RUN (discovery mode):
    1. Load all active TrackedProducts for marketplace="noon"
    2. For each, run Noon search using the product title
    3. Clean each result via clean_product -> inject user_id +
       tracked_product_id
    4. Save via loader -> MarketplaceSeller -> CompetitorListing
                        -> PriceSnapshot -> Alert
    5. Log run stats

FLOW PER RUN (monitor mode):
    1. Load all confirmed, active CompetitorListings for
       marketplace="noon", grouped by tracked_product_id, including
       own_url per tracked product
    2. Per tracked product: group confirmed listings by SKU, scrape
       each unique SKU once, match listings to offers via
       partner_code == marketplace_seller.external_store_id, save via
       save_monitoring_snapshot
    3. Immediately after: scrape and save that tracked product's own
       listing (own_url) via save_own_snapshot
    4. Log run stats

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

from app.config import settings
from app.database import AsyncSessionLocal

from pipeline.cleaner import clean_product, clean_own_snapshot_noon
from pipeline.loader import save_product, save_monitoring_snapshot, save_own_snapshot
from pipeline.orchestration_common import (
    _empty_counters,
    _update_counters,
    load_tracked_products,
    load_confirmed_listings,
    create_scrape_job,
    finalize_scrape_job,
)

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
logger = logging.getLogger("main_noon")

MARKETPLACE = "noon"


# ─── Own-product snapshot step (Noon-only) ──────────────────────────────────

async def _run_own_snapshot_noon(
    session,
    tracked_product_id: str,
    own_url: str,
    country: str,
    session_manager: SessionManager,
    counters: dict,
) -> None:
    """
    Scrapes and saves the tracked product's OWN listing (own_url) on
    Noon, right after its confirmed competitor listings have been
    processed — same run, so "our price" and "competitor prices"
    represent a genuinely simultaneous comparison.

    ASSUMPTION FLAGGED: this assumes scrape_product_page(session_manager,
    own_url) returns the same (offers, rating) shape it does for
    competitor URLs, and takes offers[0] as "our" listing — there is no
    partner_code to match against here, since own_url has no
    "confirmed seller" concept, it's simply our own page. This has not
    been verified against Noon's actual detail-scraper source; if the
    real shape differs, fix this function's unpacking accordingly.

    Failures here are logged and swallowed, not re-raised — a failed
    own-product scrape should not roll back the competitor-listing
    writes that already succeeded in this same transaction, since
    they're independent facts about the world.
    """
    if not own_url:
        logger.debug(
            f"  [OwnSnapshot][Noon] tracked_product={tracked_product_id[:8]}... "
            f"has no own_url set, skipping."
        )
        return

    try:
        raw = await scrape_product_page(session_manager, own_url)
        if raw is None:
            logger.warning(
                f"  [OwnSnapshot][Noon] scrape failed for "
                f"tracked_product={tracked_product_id[:8]}..."
            )
            return

        offers, _rating = raw
        if not offers:
            logger.warning(
                f"  [OwnSnapshot][Noon] no offer data returned for "
                f"tracked_product={tracked_product_id[:8]}..."
            )
            return

        clean = clean_own_snapshot_noon(offers[0], country=country)

        result = await save_own_snapshot(
            session=session,
            tracked_product_id=uuid.UUID(tracked_product_id),
            clean=clean,
            scrape_job_id=None,
        )
        if result["status"] == "saved":
            counters["products_saved"] += 1
        elif result["status"] == "skipped":
            counters["products_skipped"] += 1
        elif result["status"] == "rejected":
            counters["products_rejected"] += 1

    except Exception as exc:
        logger.error(
            f"  [OwnSnapshot][Noon] Failed for tracked_product="
            f"{tracked_product_id[:8]}... | {exc}",
            exc_info=True,
        )
        # Swallowed deliberately — see docstring.


# ─── Discovery mode ───────────────────────────────────────────────────────────

async def run_discovery(session_manager: SessionManager) -> None:
    """
    For each TrackedProduct, searches Noon using the product title,
    then saves all competitor listings found.

    One async DB transaction per TrackedProduct.
    If one product fails, others are unaffected.
    """
    tracked_products = await load_tracked_products(marketplace=MARKETPLACE)

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
                        clean = clean_product(
                            raw,
                            marketplace = marketplace,
                            country     = country,
                        )

                        clean["user_id"]            = user_id
                        clean["tracked_product_id"] = tracked_product_id
                        clean["scrape_job_id"]      = None

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
    keyword search, goes straight to each SKU's product-page API.
    Faster than discovery mode and the only mode that writes
    PriceSnapshot rows for listings the user has explicitly confirmed
    as real competitors.

    FLOW PER TRACKED PRODUCT:
        1. Load confirmed listings for this tracked product
        2. Dedupe by extracted SKU — several confirmed listings can
           share one SKU (multiple sellers of the exact same product),
           in which case one API call covers all of them
        3. For each unique SKU: scrape once, then loop every listing
           that shares that SKU, matching each to its offer via
           offer["partner_code"] == listing.marketplace_seller.external_store_id
        4. Unmatched listings (confirmed, but not found in this scrape
           — e.g. seller stopped selling, or external_store_id never
           got backfilled) are logged and skipped, not treated as
           errors
        5. Each matched listing gets its own ScrapeJob row (created
           before the write, finalized after — success or failure) and
           its own save_monitoring_snapshot() call
        6. After all confirmed listings for this tracked product are
           processed, its own listing (own_url) is scraped and saved
           via _run_own_snapshot_noon, in the same transaction

    TRANSACTION BOUNDARY:
        One async transaction per TrackedProduct — same pattern as
        run_discovery. If one tracked product's monitoring run fails
        partway through, other tracked products are unaffected. Within
        a tracked product, all listing updates for that run share one
        transaction (commits together, rolls back together).
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            confirmed_by_product = await load_confirmed_listings(
                session, marketplace=MARKETPLACE
            )

        if not confirmed_by_product:
            return

        for tracked_product_id, data in confirmed_by_product.items():
            user_id  = data["user_id"]
            own_url  = data["own_url"]
            country  = data["country"]
            listings = data["listings"]

            logger.info(
                f"─── Monitoring: {len(listings)} confirmed listing(s) "
                f"(tracked_product_id={tracked_product_id[:8]}...) "
                + "─" * 20
            )
            start_time = time.time()
            counters = _empty_counters()

            # ── Group confirmed listings by extracted SKU ─────────────────
            unique_skus: dict[str, list] = {}
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
                            logger.warning(
                                f"  Scrape failed for SKU {sku} "
                                f"({len(listings_sharing_sku)} listing(s) affected)."
                            )
                            for listing in listings_sharing_sku:
                                job = await create_scrape_job(session, listing)
                                await finalize_scrape_job(
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
                                job = await create_scrape_job(session, listing)
                                await finalize_scrape_job(
                                    session, job,
                                    success=False,
                                    error_detail="No matching offer found for this "
                                                  "listing's seller in the scraped response",
                                )
                                counters["errors"] += 1
                                continue

                            offer_data = extract_offer(matched_offer, product_rating)
                            signal_data = extract_signals(matched_offer)

                            job = await create_scrape_job(session, listing)

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
                                await finalize_scrape_job(
                                    session, job,
                                    success=True,
                                    items_updated=1 if result["snapshot"] else 0,
                                    alerts_triggered=result["alerts"],
                                )
                                _update_counters(counters, result)

                            except Exception as exc:
                                await finalize_scrape_job(
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

                    # ── Own-product snapshot, same transaction ────────────
                    await _run_own_snapshot_noon(
                        session=session,
                        tracked_product_id=tracked_product_id,
                        own_url=own_url,
                        country=country,
                        session_manager=session_manager,
                        counters=counters,
                    )

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
    logger.info(f"Price Intel (Noon) starting | mode={mode}")

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

    elif mode == "monitor":
        await run_store_monitoring(session_manager)

    logger.info(f"Price Intel (Noon) finished | mode={mode}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="main_noon.py")
    parser.add_argument(
        "--mode",
        choices=["discovery", "full", "monitor"],
        default="monitor",
    )
    args = parser.parse_args()
    asyncio.run(main(args.mode))