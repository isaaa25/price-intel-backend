"""
main.py — Price Intel orchestrator

WHAT CHANGED FROM THE PREVIOUS main.py:
    - Added Daraz alongside Noon. The two platforms do not share a
      scraping call signature (Noon: browser-session based, multi-
      seller offers per detail call; Daraz: mtop-token based, single-
      seller per detail call, no fan-out) so this file does NOT force
      them behind one generic interface. Instead: the outer structure
      (transaction boundaries, counters, ScrapeJob bookkeeping, own-
      product snapshot call) stays platform-agnostic and shared: all
      platform-specific behavior is pushed into a small number of
      named adapter functions at the two points where the platforms
      genuinely diverge — the scrape call itself, and monitoring
      fan-out/save.
    - Added own-product snapshot integration (save_own_snapshot),
      called once per tracked product per monitoring run, right after
      that product's confirmed competitor listings are processed —
      same run, so "our price" and "competitor prices" are captured
      simultaneously.
    - load_tracked_products() / load_confirmed_listings() no longer
      hardcode marketplace == "noon" — they load across all active
      marketplaces and group by platform, so Daraz tracked products
      and listings are no longer invisible to the orchestrator.

FLOW PER RUN (discovery mode):
    1. Load all active TrackedProducts (both platforms) from the DB
    2. For each TrackedProduct, run that platform's search using the
       product title
    3. Clean each result with that platform's cleaner -> inject
       user_id + tracked_product_id
    4. Save via loader -> MarketplaceSeller -> CompetitorListing
                        -> PriceSnapshot -> Alert
    5. Log run stats

FLOW PER RUN (monitor mode):
    1. Load all confirmed, active CompetitorListings (both platforms),
       grouped by tracked_product_id, including own_url per tracked
       product
    2. Per tracked product: run that platform's monitoring adapter
       over its confirmed listings
    3. Immediately after: scrape and save that tracked product's own
       listing (own_url) via save_own_snapshot
    4. Log run stats

TRANSACTION BOUNDARY:
    One async transaction per TrackedProduct, same as before.
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

from pipeline.cleaner import (
    clean_product,
    clean_daraz_hit,
    clean_own_snapshot_noon,
    clean_own_snapshot_daraz,
)
from pipeline.loader import (
    save_product,
    save_monitoring_snapshot,
    save_daraz_monitoring_snapshot,
    save_own_snapshot,
)

# ── Noon platform imports ───────────────────────────────────────────────────
from scraper.platforms.noon.proxy_manager import ProxyManager
from scraper.platforms.noon.session_manager import SessionManager
from scraper.platforms.noon.search_scraper import scrape_search as noon_scrape_search
from scraper.platforms.noon.product_scraper import scrape_product_page as noon_scrape_product_page
from scraper.platforms.noon.utils import (
    random_delay,
    extract_sku_from_url as noon_extract_sku_from_url,
    extract_offer,
    extract_signals,
)

# ── Daraz platform imports ──────────────────────────────────────────────────
from scraper.platforms.daraz.mtop_client import MtopClient
from scraper.platforms.daraz.search_scraper import scrape_search as daraz_scrape_search
from scraper.platforms.daraz.product_scraper import scrape_product_page as daraz_scrape_product_page

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")


# ─── Small Daraz country -> domain map ─────────────────────────────────────
# Deliberately kept here, not imported from elsewhere — small enough
# that a local constant is clearer than adding cross-file coupling for
# four lookup entries. Mirrors the country codes already used in
# pipeline/cleaner.py's DARAZ_COUNTRY_CURRENCY, so UserStore.country
# values ("PK", "BD", "NP", "MM") resolve consistently across both
# files without needing to keep two different key schemes in sync.
DARAZ_COUNTRY_DOMAIN = {
    "PK": "www.daraz.pk",
    "BD": "www.daraz.com.bd",
    "NP": "www.daraz.com.np",
    "MM": "www.daraz.com.mm",
}


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
    status = result.get("status")
    if status == "rejected":
        counters["products_rejected"] += 1
        counters["errors"] += 1
    elif status == "skipped":
        counters["products_skipped"] += 1
    elif status == "saved":
        counters["products_saved"] += 1
        counters["alerts_triggered"] += result.get("alerts", 0)


# ─── Load tracked products (all active platforms) ──────────────────────────

async def load_tracked_products() -> list[dict]:
    """
    Loads all active TrackedProducts from the database, across every
    active marketplace — no longer filtered to "noon" only.

    Returns a list of dicts (not ORM objects) so they stay usable
    after the session closes. Each dict includes the platform
    ("noon" / "daraz") the caller needs to pick the right scraper and
    cleaner for.

    This runs in its own session that closes immediately after the query.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TrackedProduct, UserStore)
            .join(UserStore, TrackedProduct.store_id == UserStore.id)
            .where(TrackedProduct.is_active == True)
            .where(UserStore.is_active == True)
        )
        rows = result.all()

    if not rows:
        logger.warning(
            "No active TrackedProducts found across any marketplace. "
            "Add a product via the database first."
        )
        return []

    products = []
    for tracked, store in rows:
        products.append({
            "tracked_product_id": str(tracked.id),
            "user_id":            str(store.user_id),
            "title":              tracked.title,
            "own_url":            tracked.own_url,
            "country":            store.country,        # "UAE", "PK", etc.
            "marketplace":        store.marketplace,     # "noon" | "daraz"
        })

    logger.info(f"Loaded {len(products)} active tracked product(s) across all platforms.")
    return products


# ─── Load confirmed listings (all active platforms) ────────────────────────

async def load_confirmed_listings(session) -> dict:
    """
    Loads all confirmed, active CompetitorListings, grouped by
    tracked_product_id, within the GIVEN session — no longer filtered
    to marketplace == "noon".

    Each group now also carries the tracked product's own_url, country,
    and marketplace, so the monitoring loop can dispatch to the right
    platform adapter AND run the own-product snapshot step without a
    second query.

    Deliberately shares the caller's session rather than detaching into
    plain dicts and closing — see original docstring reasoning:
    save_monitoring_snapshot (Noon path) mutates listing.
    consecutive_unchanged, volatility_score, last_price_change_at, and
    listing.marketplace_seller.external_store_id directly on the ORM
    objects, so keeping them attached to the same session that will
    commit those mutations is simplest and correct for now.

    marketplace_seller is eager-loaded via selectinload — required for
    the Noon path's partner_code matching; harmless/unused on the
    Daraz path, which gets seller_external_id directly from every
    scrape instead.

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
            "No confirmed CompetitorListings found across any marketplace. "
            "Nothing to monitor."
        )

    total_listings = sum(len(v["listings"]) for v in grouped.values())
    logger.info(
        f"Loaded {total_listings} confirmed listing(s) across "
        f"{len(grouped)} tracked product(s), all platforms."
    )
    return grouped


async def _create_scrape_job(session, listing: CompetitorListing) -> ScrapeJob:
    """
    Creates a ScrapeJob row for one listing, at the moment we're about to
    scrape it. status starts as "running" — updated to "done" or "failed"
    by _finalize_scrape_job once the outcome is known. Unchanged from
    before — platform-agnostic already, since it only ever reads
    listing.id / listing.url.
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
    Updates a ScrapeJob row once its outcome is known. Unchanged from
    before — platform-agnostic already.
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


# ─── Platform scrape adapters (discovery) ───────────────────────────────────
# The one real branch point for search. Everything above and below this
# call in run_discovery stays platform-agnostic.

async def _scrape_search_for_platform(
    platform: str,
    clients: dict,
    keyword: str,
    country: str,
) -> list[dict]:
    """
    Dispatches a keyword search to the right platform's scraper and
    returns that platform's own raw hit list — NOT yet cleaned. The
    caller picks the matching cleaner (clean_product vs
    clean_daraz_hit) based on the same platform string.
    """
    if platform == "noon":
        return await noon_scrape_search(
            session_manager=clients["noon"]["session_manager"],
            keyword=keyword,
            pages=settings.pages_per_keyword,
            sort_by="recommended",
        )

    elif platform == "daraz":
        domain = DARAZ_COUNTRY_DOMAIN.get(country)
        if domain is None:
            logger.error(
                f"[Daraz] No domain mapping for country={country!r}. "
                f"Skipping search for '{keyword}'."
            )
            return []
        return await daraz_scrape_search(domain=domain, keyword=keyword)

    else:
        logger.error(f"Unknown platform '{platform}' — skipping search for '{keyword}'.")
        return []


def _clean_for_platform(platform: str, raw: dict, marketplace: str, country: str) -> dict:
    """
    Dispatches one raw hit to the right cleaner. Both cleaners produce
    the identical marketplace_seller/listing/snapshot shape, so
    save_product() downstream never needs to know which platform
    produced the dict.
    """
    if platform == "noon":
        return clean_product(raw, marketplace=marketplace, country=country)
    elif platform == "daraz":
        return clean_daraz_hit(raw, marketplace=marketplace, country=country)
    else:
        raise ValueError(f"Unknown platform '{platform}'")


# ─── Discovery mode ──────────────────────────────────────────────────────────

async def run_discovery(clients: dict) -> None:
    """
    For each TrackedProduct, searches its own platform using the
    product title, then saves all competitor listings found.

    One async DB transaction per TrackedProduct. If one product fails,
    others are unaffected. Platform dispatch happens only inside
    _scrape_search_for_platform / _clean_for_platform — this function's
    own structure is identical for both platforms.
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
            f"─── Searching ({marketplace}): '{title}' "
            f"(tracked_product_id={tracked_product_id[:8]}...) "
            + "─" * 20
        )
        start_time = time.time()
        counters   = _empty_counters()

        try:
            raw_products = await _scrape_search_for_platform(
                platform=marketplace,
                clients=clients,
                keyword=title,
                country=country,
            )

            counters["products_found"] = len(raw_products)
            logger.info(f"  Found {len(raw_products)} listings for '{title}'.")

            if not raw_products:
                continue

            async with AsyncSessionLocal() as session:
                async with session.begin():
                    for raw in raw_products:
                        clean = _clean_for_platform(marketplace, raw, marketplace, country)

                        clean["user_id"]            = user_id
                        clean["tracked_product_id"] = tracked_product_id
                        clean["scrape_job_id"]      = None

                        result = await save_product(session, clean)
                        _update_counters(counters, result)

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

        if tracked != tracked_products[-1]:
            await random_delay()


# ─── Monitoring adapters — Noon ─────────────────────────────────────────────

async def _monitor_noon_listings(
    session,
    listings: list[CompetitorListing],
    noon_clients: dict,
    user_id: str,
    counters: dict,
) -> None:
    """
    Noon's monitoring path — unchanged logic from the previous version,
    just extracted into its own function. Groups confirmed listings by
    SKU (several sellers can share one SKU, and Noon's product-page API
    returns every seller's offer for that SKU in one call), scrapes
    once per unique SKU, then matches each listing to its offer via
    partner_code == marketplace_seller.external_store_id.
    """
    session_manager = noon_clients["session_manager"]

    unique_skus: dict[str, list[CompetitorListing]] = {}
    for listing in listings:
        sku = noon_extract_sku_from_url(listing.url)
        if sku is None:
            logger.warning(
                f"  [Noon] Could not extract SKU from listing url, "
                f"skipping: {listing.url[:80]}"
            )
            continue
        unique_skus.setdefault(sku, []).append(listing)

    for sku, listings_sharing_sku in unique_skus.items():
        representative = listings_sharing_sku[0]

        scrape_result = await noon_scrape_product_page(session_manager, representative.url)

        if scrape_result is None:
            logger.warning(
                f"  [Noon] Scrape failed for SKU {sku} "
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
                    f"  [Noon] Confirmed listing not found in scrape "
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
                raise

        await random_delay()


# ─── Monitoring adapters — Daraz ─────────────────────────────────────────────

async def _monitor_daraz_listings(
    session,
    listings: list[CompetitorListing],
    daraz_clients: dict,
    user_id: str,
    counters: dict,
) -> None:
    """
    Daraz's monitoring path — structurally simpler than Noon's, by
    design of the platform itself: every confirmed listing needs its
    own separate detail-page call (no SKU fan-out, no multi-seller
    offers array to match against — see product_scraper.py's module
    docstring). One listing -> one scrape -> one save, every time.

    Uses save_daraz_monitoring_snapshot (not save_monitoring_snapshot)
    since Daraz's scraped shape carries no nudges/signal data and needs
    no partner_code matching/backfill step — the seller's external ID
    comes back directly on every call.
    """
    mtop_client = daraz_clients["mtop_client"]

    for listing in listings:
        job = await _create_scrape_job(session, listing)

        try:
            offer_data = await daraz_scrape_product_page(
                mtop_client=mtop_client,
                listing_url=listing.url,
                platform_sku=listing.platform_sku,
            )

            if offer_data is None:
                logger.warning(
                    f"  [Daraz] Scrape failed for listing={listing.id} "
                    f"url={listing.url[:80]}"
                )
                await _finalize_scrape_job(
                    session, job,
                    success=False,
                    error_detail="scrape_product_page returned None "
                                  "(network error, token handshake failure, "
                                  "or target variant not found)",
                )
                counters["errors"] += 1
                continue

            result = await save_daraz_monitoring_snapshot(
                session=session,
                listing=listing,
                offer_data=offer_data,
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
            raise

        await random_delay()


# ─── Own-product snapshot step ───────────────────────────────────────────────

async def _run_own_snapshot(
    session,
    tracked_product_id: str,
    own_url: str,
    marketplace: str,
    country: str,
    clients: dict,
    counters: dict,
) -> None:
    """
    Scrapes and saves the tracked product's OWN listing (own_url),
    right after its confirmed competitor listings have been processed
    — same run, so "our price" and "competitor prices" represent a
    genuinely simultaneous comparison (per the original design
    discussion).

    Dispatches to the right platform's detail scraper and own-snapshot
    cleaner, same branch pattern as everywhere else in this file.
    Failures here are logged and swallowed, not re-raised — a failed
    own-product scrape should not roll back the competitor-listing
    writes that already succeeded in this same transaction, since
    they're independent facts about the world.
    """
    if not own_url:
        logger.debug(
            f"  [OwnSnapshot] tracked_product={tracked_product_id[:8]}... "
            f"has no own_url set, skipping."
        )
        return

    try:
        if marketplace == "noon":
            raw = await noon_scrape_product_page(
                clients["noon"]["session_manager"], own_url
            )
            if raw is None:
                logger.warning(
                    f"  [OwnSnapshot][Noon] scrape failed for "
                    f"tracked_product={tracked_product_id[:8]}..."
                )
                return
            offers, _rating = raw
            # own_url is a single-seller listing from the user's own
            # perspective — take the first/only offer Noon's page
            # returns for it rather than running partner_code matching,
            # which has no meaning here (there is no "confirmed seller"
            # to match against; it's simply our own page).
            if not offers:
                logger.warning(
                    f"  [OwnSnapshot][Noon] no offer data returned for "
                    f"tracked_product={tracked_product_id[:8]}..."
                )
                return
            clean = clean_own_snapshot_noon(offers[0], country=country)

        elif marketplace == "daraz":
            mtop_client = clients["daraz"]["mtop_client"]
            raw = await daraz_scrape_product_page(
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

        else:
            logger.error(
                f"  [OwnSnapshot] Unknown platform '{marketplace}' for "
                f"tracked_product={tracked_product_id[:8]}..."
            )
            return

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
            f"  [OwnSnapshot] Failed for tracked_product="
            f"{tracked_product_id[:8]}... | {exc}",
            exc_info=True,
        )
        # Swallowed deliberately — see docstring. Competitor writes in
        # this same transaction should still commit.


# ─── Store monitoring mode ───────────────────────────────────────────────────

async def run_store_monitoring(clients: dict) -> None:
    """
    Scrapes only confirmed competitor listings directly by URL — no
    keyword search. Platform dispatch happens at the per-tracked-
    product level: each tracked product's confirmed listings are all
    on the same marketplace (by construction — a CompetitorListing
    belongs to one TrackedProduct, which belongs to one UserStore,
    which has exactly one marketplace), so one _monitor_noon_listings
    or _monitor_daraz_listings call handles that product's whole
    listing set.

    Immediately after competitor listings are processed for a tracked
    product, its own_url is scraped and saved via _run_own_snapshot,
    inside the same transaction.

    TRANSACTION BOUNDARY: unchanged — one async transaction per
    TrackedProduct.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            confirmed_by_product = await load_confirmed_listings(session)

        if not confirmed_by_product:
            return

        for tracked_product_id, data in confirmed_by_product.items():
            user_id     = data["user_id"]
            own_url     = data["own_url"]
            country     = data["country"]
            marketplace = data["marketplace"]
            listings    = data["listings"]

            logger.info(
                f"─── Monitoring ({marketplace}): {len(listings)} confirmed "
                f"listing(s) (tracked_product_id={tracked_product_id[:8]}...) "
                + "─" * 20
            )
            start_time = time.time()
            counters = _empty_counters()

            try:
                async with session.begin():
                    if marketplace == "noon":
                        await _monitor_noon_listings(
                            session, listings, clients["noon"], user_id, counters
                        )
                    elif marketplace == "daraz":
                        await _monitor_daraz_listings(
                            session, listings, clients["daraz"], user_id, counters
                        )
                    else:
                        logger.error(
                            f"  Unknown marketplace '{marketplace}' for "
                            f"tracked_product_id={tracked_product_id[:8]}... skipping."
                        )

                    # ── Own-product snapshot, same transaction ──────────
                    await _run_own_snapshot(
                        session=session,
                        tracked_product_id=tracked_product_id,
                        own_url=own_url,
                        marketplace=marketplace,
                        country=country,
                        clients=clients,
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

            if tracked_product_id != list(confirmed_by_product.keys())[-1]:
                await random_delay()


# ─── Entry point ──────────────────────────────────────────────────────────────

async def main(mode: str) -> None:
    logger.info(f"Price Intel starting | mode={mode}")

    # ── Noon stealth session layer ────────────────────────────────────────
    proxy_manager   = ProxyManager()
    noon_session_manager = SessionManager(proxy_manager)

    logger.info("Initialising Noon session...")
    await noon_session_manager.initialise()

    status = noon_session_manager.get_status()
    logger.info(
        f"Noon session ready | "
        f"age={status.get('bootstrap_age_h')}h | "
        f"jwt_ttl={status.get('jwt_expires_in_s')}s"
    )

    # ── Daraz mtop client ────────────────────────────────────────────────
    daraz_mtop_client = MtopClient()
    logger.info("Initialising Daraz mtop client...")
    await daraz_mtop_client.initialise()
    logger.info("Daraz mtop client ready.")

    clients = {
        "noon":  {"session_manager": noon_session_manager, "proxy_manager": proxy_manager},
        "daraz": {"mtop_client": daraz_mtop_client},
    }

    try:
        if mode == "discovery":
            await run_discovery(clients)

        elif mode == "full":
            await run_discovery(clients)

        elif mode == "monitor":
            await run_store_monitoring(clients)

    finally:
        await daraz_mtop_client.close()

    logger.info(f"Price Intel finished | mode={mode}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="main.py")
    parser.add_argument(
        "--mode",
        choices=["discovery", "full", "monitor"],
        default="monitor",
    )
    args = parser.parse_args()
    asyncio.run(main(args.mode))