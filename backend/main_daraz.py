"""
main_daraz.py — Price Intel orchestrator, DARAZ ONLY

Mirrors main_noon.py's shape exactly, with every platform-specific
piece swapped. Deliberately does NOT import anything from
scraper/platforms/noon/* — this file can be scheduled, deployed, and
debugged completely independently of Noon's code.

Shared, platform-agnostic plumbing (counters, ScrapeJob lifecycle, the
two DB-loading queries) lives in pipeline/orchestration_common and is
imported, not redefined here — identical usage to main_noon.py.

KEY STRUCTURAL DIFFERENCE FROM main_noon.py'S MONITORING LOOP:
    Noon's product-page API returns every seller's offer for one SKU
    in a single call, so run_store_monitoring groups confirmed
    listings by SKU and fans one scrape out to several listings via
    partner_code matching. Daraz's product-detail API is scoped to one
    itemId, which IS one specific seller's listing — there is no
    "other sellers of this item" data to fan out from (see
    scraper/platforms/daraz/product_scraper.py's module docstring).
    So here: one confirmed listing -> one scrape -> one save, always,
    no grouping step, no matching step.

FLOW PER RUN (discovery mode):
    1. Load all active TrackedProducts for marketplace="daraz"
    2. For each, run Daraz search using the product title
    3. Clean each result via clean_daraz_hit -> inject user_id +
       tracked_product_id
    4. Save via loader -> MarketplaceSeller -> CompetitorListing
                        -> PriceSnapshot -> Alert
    5. Log run stats

FLOW PER RUN (monitor mode):
    1. Load all confirmed, active CompetitorListings for
       marketplace="daraz", grouped by tracked_product_id, including
       own_url per tracked product
    2. Per tracked product: scrape each confirmed listing individually,
       save via save_daraz_monitoring_snapshot
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

from app.database import AsyncSessionLocal

from pipeline.cleaner import clean_daraz_hit, clean_own_snapshot_daraz
from pipeline.loader import save_product, save_daraz_monitoring_snapshot, save_own_snapshot
from pipeline.orchestration_common import (
    _empty_counters,
    _update_counters,
    load_tracked_products,
    load_confirmed_listings,
    create_scrape_job,
    finalize_scrape_job,
)

from scraper.platforms.daraz.mtop_client import MtopClient
from scraper.platforms.daraz.search_scraper import scrape_search
from scraper.platforms.daraz.product_scraper import scrape_product_page
from pipeline.orchestration_common import ensure_search_keyword

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main_daraz")

MARKETPLACE = "daraz"

# Small, local country -> domain / currency maps — deliberately kept
# here rather than imported from elsewhere, same reasoning as before:
# four entries each, not worth cross-file coupling for. Mirrors the
# same country codes already used in pipeline/cleaner.py's
# DARAZ_COUNTRY_CURRENCY, so UserStore.country values resolve
# consistently across files without keeping two key schemes in sync.
DARAZ_COUNTRY_DOMAIN = {
    "Pakistan": "www.daraz.pk",
    "pk": "www.daraz.pk",
    "BD": "www.daraz.com.bd",
    "NP": "www.daraz.com.np",
    "MM": "www.daraz.com.mm",
}

DARAZ_COUNTRY_CURRENCY = {
    "PK": "PKR",
    "BD": "BDT",
    "NP": "NPR",
    "MM": "MMK",
}


# ─── Small delay helper ─────────────────────────────────────────────────────
# Daraz's scraper modules carry no random_delay of their own (unlike
# Noon's utils.py) — there's no session/block-detection layer here to
# protect, per search_scraper.py's own docstring. A modest polite delay
# between requests is still worth keeping between tracked products /
# listings so we're not hammering Daraz's endpoints back-to-back.
import random


async def _polite_delay(min_s: float = 1.5, max_s: float = 3.5) -> None:
    await asyncio.sleep(random.uniform(min_s, max_s))


# ─── Own-product snapshot step (Daraz-only) ─────────────────────────────────

async def _run_own_snapshot_daraz(
    session,
    tracked_product_id: str,
    own_url: str,
    country: str,
    mtop_client: MtopClient,
    counters: dict,
) -> None:
    """
    Scrapes and saves the tracked product's OWN listing (own_url) on
    Daraz, right after its confirmed competitor listings have been
    processed — same run, so "our price" and "competitor prices"
    represent a genuinely simultaneous comparison.

    platform_sku=None is passed deliberately — own_url is the user's
    own product page, and we always want whatever Daraz considers the
    default/current variant for it, same fallback behavior
    extract_product_detail already documents for a bare item-only URL.

    Failures here are logged and swallowed, not re-raised — a failed
    own-product scrape should not roll back the competitor-listing
    writes that already succeeded in this same transaction, since
    they're independent facts about the world.
    """
    if not own_url:
        logger.debug(
            f"  [OwnSnapshot][Daraz] tracked_product={tracked_product_id[:8]}... "
            f"has no own_url set, skipping."
        )
        return

    try:
        raw = await scrape_product_page(
            mtop_client=mtop_client,
            listing_url=own_url,
            platform_sku=None,
        )
        if raw is None:
            logger.warning(
                f"  [OwnSnapshot][Daraz] scrape failed for "
                f"tracked_product={tracked_product_id[:8]}..."
            )
            return

        clean = clean_own_snapshot_daraz(raw, country=country)

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
            f"  [OwnSnapshot][Daraz] Failed for tracked_product="
            f"{tracked_product_id[:8]}... | {exc}",
            exc_info=True,
        )
        # Swallowed deliberately — see docstring.


# ─── Discovery mode ───────────────────────────────────────────────────────────

async def run_discovery() -> None:
    """
    For each TrackedProduct, searches Daraz using the product title,
    then saves all competitor listings found.

    No client/session object needed here — Daraz's scrape_search opens
    its own short-lived AsyncSession internally and needs no token
    handshake (unsigned endpoint, see search_scraper.py's module
    docstring). Only the detail-page monitoring path needs an
    MtopClient.

    One async DB transaction per TrackedProduct.
    If one product fails, others are unaffected.
    """
    tracked_products = await load_tracked_products(marketplace=MARKETPLACE)

    if not tracked_products:
        return

    for tracked in tracked_products:
        title              = tracked["title"]
        search_keyword     = tracked["search_keyword"] or await ensure_search_keyword(
        tracked["tracked_product_id"], tracked["title"])
        tracked_product_id = tracked["tracked_product_id"]
        user_id            = tracked["user_id"]
        country            = tracked["country"]
        marketplace        = tracked["marketplace"]

        domain = DARAZ_COUNTRY_DOMAIN.get(country)
        if domain is None:
            logger.error(
                f"[Daraz] No domain mapping for country={country!r}. "
                f"Skipping '{title}'."
            )
            continue

        logger.info(
            f"─── Searching: '{title}' "
            f"(tracked_product_id={tracked_product_id[:8]}...) "
            + "─" * 20
        )
        start_time = time.time()
        counters   = _empty_counters()

        try:
            # ── Step 1: Scrape Daraz ──────────────────────────────────────
            raw_products = await scrape_search(domain=domain, keyword=search_keyword)

            counters["products_found"] = len(raw_products)
            logger.info(f"  Found {len(raw_products)} listings for '{title}'.")

            if not raw_products:
                continue

            # ── Step 2: Clean → inject IDs → save ────────────────────────
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    for raw in raw_products:
                        clean = clean_daraz_hit(
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

        if tracked != tracked_products[-1]:
            await _polite_delay()


# ─── Store monitoring mode ──────────────────────────────────────────────────

async def run_store_monitoring(mtop_client: MtopClient) -> None:
    """
    Scrapes only confirmed competitor listings directly by URL. Every
    confirmed listing gets its own separate detail-page call — no
    SKU-dedup/fan-out step, unlike Noon (see module docstring).

    FLOW PER TRACKED PRODUCT:
        1. Load confirmed listings for this tracked product
        2. For each listing: scrape its detail page individually, save
           via save_daraz_monitoring_snapshot
        3. After all confirmed listings are processed, scrape and save
           this tracked product's own listing (own_url) via
           _run_own_snapshot_daraz, in the same transaction

    TRANSACTION BOUNDARY:
        One async transaction per TrackedProduct — same pattern as
        run_discovery and as main_noon.py's monitoring mode.
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

            currency = DARAZ_COUNTRY_CURRENCY.get(country, "PKR")

            logger.info(
                f"─── Monitoring: {len(listings)} confirmed listing(s) "
                f"(tracked_product_id={tracked_product_id[:8]}...) "
                + "─" * 20
            )
            start_time = time.time()
            counters = _empty_counters()

            try:
                async with session.begin():
                    for listing in listings:
                        job = await create_scrape_job(session, listing)

                        try:
                            offer_data = await scrape_product_page(
                                mtop_client=mtop_client,
                                listing_url=listing.url,
                                platform_sku=listing.platform_sku,
                            )

                            if offer_data is None:
                                logger.warning(
                                    f"  Scrape failed for listing={listing.id} "
                                    f"url={listing.url[:80]}"
                                )
                                await finalize_scrape_job(
                                    session, job,
                                    success=False,
                                    error_detail="scrape_product_page returned None "
                                                  "(network error, token handshake "
                                                  "failure, or target variant not found)",
                                )
                                counters["errors"] += 1
                                continue

                            result = await save_daraz_monitoring_snapshot(
                                session=session,
                                listing=listing,
                                offer_data=offer_data,
                                currency=currency,
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
                            # behavior as main_noon.py's monitoring loop.
                            raise

                        await _polite_delay()

                    # ── Own-product snapshot, same transaction ────────────
                    await _run_own_snapshot_daraz(
                        session=session,
                        tracked_product_id=tracked_product_id,
                        own_url=own_url,
                        country=country,
                        mtop_client=mtop_client,
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
                await _polite_delay()


# ─── Entry point ──────────────────────────────────────────────────────────────

async def main(mode: str) -> None:
    logger.info(f"Price Intel (Daraz) starting | mode={mode}")

    # ── Mtop token client — only needed for detail-page scraping, but
    #    built once here regardless of mode for consistency with the
    #    token-reuse reasoning in mtop_client.py's own docstring (one
    #    handshake per run, not per call). Discovery mode simply never
    #    calls it. ──────────────────────────────────────────────────────
    mtop_client = MtopClient()
    logger.info("Initialising Daraz mtop client...")
    await mtop_client.initialise()
    logger.info("Daraz mtop client ready.")

    try:
        if mode == "discovery":
            await run_discovery()

        elif mode == "full":
            await run_discovery()

        elif mode == "monitor":
            await run_store_monitoring(mtop_client)

    finally:
        await mtop_client.close()

    logger.info(f"Price Intel (Daraz) finished | mode={mode}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="main_daraz.py")
    parser.add_argument(
        "--mode",
        choices=["discovery", "full", "monitor"],
        default="monitor",
    )
    args = parser.parse_args()
    asyncio.run(main(args.mode))