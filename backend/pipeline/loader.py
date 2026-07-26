"""
pipeline/loader.py

Writes cleaned scraper output into the Price Intel PostgreSQL database.

═══════════════════════════════════════════════════════════════════════════════
CONTRACT — what this file expects to receive
═══════════════════════════════════════════════════════════════════════════════

Every call to save_product() receives a single "clean dict" produced by
pipeline/cleaner.py. The exact shape is documented on save_product() below.

═══════════════════════════════════════════════════════════════════════════════
SESSION — how database writes are managed
═══════════════════════════════════════════════════════════════════════════════

This file is fully async. It matches app/database.py which uses AsyncSession.

The caller (main.py / orchestrator) owns the session lifecycle:

    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        async with session.begin():          # auto-commits on success
            result = await save_product(session, clean)
            # if save_product raises, session.begin() auto-rolls back

This loader never calls session.commit() or session.rollback().
It calls session.flush() to get database-assigned UUIDs mid-transaction.

═══════════════════════════════════════════════════════════════════════════════
FLOW per product
═══════════════════════════════════════════════════════════════════════════════

    validity check
    → upsert MarketplaceSeller
    → upsert CompetitorListing
    → fetch latest PriceSnapshot  (for change detection)
    → insert PriceSnapshot        (only if price or stock changed)
    → create Alerts               (only if threshold crossed)
    → return stats dict

"""

import logging
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketplace_seller import MarketplaceSeller
from app.models.competitor_listing import CompetitorListing
from app.models.price_snapshot import PriceSnapshot
from app.models.alert import Alert
from app.models.listing_signal import ListingSignal
from app.models.tracked_product_snapshot import TrackedProductSnapshot

logger = logging.getLogger(__name__)

# ─── Fallback threshold ───────────────────────────────────────────────────────
# Used when PRICE_CHANGE_THRESHOLD_PCT is not set in config.
# 3% means: only alert if price moves by 3% or more.
_DEFAULT_THRESHOLD_PCT = Decimal("3.0")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — MarketplaceSeller
# ══════════════════════════════════════════════════════════════════════════════

async def upsert_marketplace_seller(
    session:     AsyncSession,
    seller_data: dict,
) -> uuid.UUID:
    """
    Gets or creates a MarketplaceSeller row.

    MarketplaceSeller is a GLOBAL catalog — not per-user.
    "Sharaf DG on Noon UAE" is one row shared by all PriceIntel users
    who happen to monitor Sharaf DG. This is correct and intentional.

    Unique identity comes from the database constraint:
        uq_marketplace_seller on (marketplace, country, external_store_id)

    Two code paths:

    Path A — external_store_id is known (the normal case for Noon and Daraz):
        Use pg_insert + ON CONFLICT DO UPDATE against the unique constraint.
        One round-trip. Atomic. Safe for concurrent workers.

    Path B — external_store_id is None (edge case):
        Some platforms do not expose a stable seller ID.
        Fall back to SELECT by (marketplace, country, store_name).
        If not found, INSERT with NULL external_store_id.
        Two round-trips. Single-threaded safe only.

    Returns the MarketplaceSeller UUID.

    Raises:
        RuntimeError — if INSERT returns no row (should never happen).
    """
    marketplace       = seller_data["marketplace"]
    country           = seller_data["country"]
    external_store_id = seller_data.get("external_store_id")
    store_name        = seller_data["store_name"]
    store_slug        = seller_data.get("store_slug")

    # ── Path A ────────────────────────────────────────────────────────────────
    if external_store_id:
        stmt = (
            pg_insert(MarketplaceSeller)
            .values(
                marketplace       = marketplace,
                country           = country,
                external_store_id = external_store_id,
                store_name        = store_name,
                store_slug        = store_slug,
            )
            .on_conflict_do_update(
                constraint = "uq_marketplace_seller",
                set_ = {
                    # The unique key fields never change.
                    # We only update human-readable fields that CAN change
                    # (a seller might rename their store).
                    "store_name": store_name,
                    "store_slug": store_slug,
                },
            )
            .returning(MarketplaceSeller.id)
        )
        result = await session.execute(stmt)
        row = result.fetchone()

        if row is None:
            raise RuntimeError(
                f"upsert_marketplace_seller returned no row. "
                f"marketplace={marketplace} country={country} "
                f"external_store_id={external_store_id}"
            )

        return row[0]

    # ── Path B ────────────────────────────────────────────────────────────────
    result = await session.execute(
        select(MarketplaceSeller.id).where(
            MarketplaceSeller.marketplace == marketplace,
            MarketplaceSeller.country     == country,
            MarketplaceSeller.store_name  == store_name,
        )
    )
    existing = result.fetchone()

    if existing:
        return existing[0]

    new_seller = MarketplaceSeller(
        marketplace       = marketplace,
        country           = country,
        external_store_id = None,
        store_name        = store_name,
        store_slug        = store_slug,
    )
    session.add(new_seller)
    await session.flush()

    logger.info(
        f"[NewSeller] {marketplace}/{country}/{store_name} "
        f"(no external_store_id)"
    )

    return new_seller.id


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — CompetitorListing
# ══════════════════════════════════════════════════════════════════════════════

async def upsert_competitor_listing(
    session:               AsyncSession,
    listing_data:          dict,
    tracked_product_id:    uuid.UUID,
    marketplace_seller_id: uuid.UUID,
) -> tuple[uuid.UUID, bool]:
    """
    Gets or creates a CompetitorListing row.

    Unique identity: (tracked_product_id, url)
    One competitor can only have one listing per URL per tracked product.

    This uses SELECT-then-INSERT because there is currently no
    database-level unique constraint on (tracked_product_id, url).
    This is safe for single-threaded scraping.
    When concurrent workers are added, add:

        UniqueConstraint("tracked_product_id", "url", name="uq_competitor_listing")

    to competitor_listing.py and switch to pg_insert + on_conflict_do_update.

    On existing listing:
        Updates marketplace_seller_id, name, platform_sku, category,
        image_url, and last_seen_at.
        Uses COALESCE so a NULL in the scrape result never overwrites
        a good value that was stored in a previous run.

    On new listing:
        Inserts with is_active=True, confirmed_by_user=False.
        The user confirms via the dashboard later.

    Returns (competitor_listing_id, is_new).
    """
    url = listing_data["url"]

    # ── SELECT ────────────────────────────────────────────────────────────────
    result = await session.execute(
        select(CompetitorListing.id).where(
            CompetitorListing.tracked_product_id == tracked_product_id,
            CompetitorListing.url                == url,
        )
    )
    existing = result.fetchone()

    # ── Existing — UPDATE mutable fields ─────────────────────────────────────
    if existing:
        listing_id = existing[0]

        # Raw SQL UPDATE with COALESCE.
        # COALESCE(:name, name) means:
        #   if the scraper returned a name → use the new name
        #   if the scraper returned None   → keep whatever was in the DB
        # This prevents good data from being overwritten by None.
        await session.execute(
            text("""
                UPDATE competitor_listings SET
                    marketplace_seller_id = :seller_id,
                    name                  = COALESCE(:name, name),
                    platform_sku          = COALESCE(:sku, platform_sku),
                    category              = COALESCE(:category, category),
                    image_url             = COALESCE(:image_url, image_url),
                    last_seen_at          = :now_naive,
                    is_active             = true,
                    updated_at            = :now_tz
                WHERE id = :id
            """),
            {
                "seller_id": str(marketplace_seller_id),
                "name":      listing_data.get("name"),
                "sku":       listing_data.get("platform_sku"),
                "category":  listing_data.get("category"),
                "image_url": listing_data.get("image_url"),
                "now_naive":       datetime.utcnow(),
                "now_tz":          datetime.now(timezone.utc),
                "id":        str(listing_id),
            }
        )

        return listing_id, False

    # ── New — INSERT ──────────────────────────────────────────────────────────
    new_listing = CompetitorListing(
        tracked_product_id      = tracked_product_id,
        marketplace_seller_id   = marketplace_seller_id,
        url                     = url,
        platform                = listing_data.get("platform", "unknown"),
        discovered_by           = listing_data.get("discovered_by", "manual"),
        render_type             = listing_data.get("render_type", "unknown"),
        discovered_api_endpoint = listing_data.get("discovered_api_endpoint"),
        name                    = listing_data.get("name"),
        platform_sku            = listing_data.get("platform_sku"),
        category                = listing_data.get("category"),
        image_url               = listing_data.get("image_url"),
        last_seen_at            = datetime.utcnow(),
        is_active               = True,
        confirmed_by_user       = False,
    )
    session.add(new_listing)
    await session.flush()  # assigns new_listing.id

    logger.info(
        f"[NewListing] tracked_product={tracked_product_id} | "
        f"seller={marketplace_seller_id} | url={url[:80]}"
    )

    return new_listing.id, True


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Fetch latest snapshot (for change detection)
# ══════════════════════════════════════════════════════════════════════════════

async def get_latest_snapshot(
    session:               AsyncSession,
    competitor_listing_id: uuid.UUID,
) -> Optional[PriceSnapshot]:
    """
    Returns the most recent PriceSnapshot for this competitor listing.

    Returns None if this listing has never been scraped before.
    None is the signal for "always insert" in _has_changed().
    """
    result = await session.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.competitor_listing_id == competitor_listing_id)
        .order_by(PriceSnapshot.scraped_at.desc())
        .limit(1)
    )
    return result.scalars().first()


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Change detection (pure logic, no DB calls)
# ══════════════════════════════════════════════════════════════════════════════

def _has_changed(
    previous:      Optional[PriceSnapshot],
    snapshot_data: dict,
) -> bool:
    """
    Decides whether a new PriceSnapshot row should be inserted.

    This is PURE LOGIC — no database calls.

    Rules:
        previous is None            → True  (first ever scrape for this listing)
        price changed               → True
        stock_status changed        → True
        everything else the same    → False (skip the insert)

    Why we skip unchanged snapshots:
        Without this check, every daily scrape would insert a row even
        when nothing changed. 40 products × 365 days = 14,600 rows per year
        of pure noise with no information value. With this check, rows only
        appear when something actually happened — price history charts show
        meaningful events, not flat lines with duplicate points.

    Why rating/review_count/search_position do NOT trigger inserts:
        These change constantly in small increments. A product's review
        count goes from 1,203 to 1,204 overnight. This is not an event
        worth recording as a snapshot row. These fields are captured on
        every snapshot that IS inserted (due to price/stock change) so
        the data is still there — just not causing insert spam.
    """
    if previous is None:
        return True

    try:
        current_price  = Decimal(str(snapshot_data["price"]))
        previous_price = Decimal(str(previous.price))
    except (InvalidOperation, TypeError):
        # Price could not be parsed — insert to be safe rather than silently skip.
        logger.warning("_has_changed: could not parse price. Inserting snapshot.")
        return True

    price_changed = current_price != previous_price
    stock_changed = (previous.stock_status or "unknown") != snapshot_data.get("stock_status", "unknown")

    return price_changed or stock_changed


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Insert PriceSnapshot
# ══════════════════════════════════════════════════════════════════════════════

async def insert_snapshot(
    session:               AsyncSession,
    snapshot_data:         dict,
    competitor_listing_id: uuid.UUID,
    scrape_job_id:         Optional[uuid.UUID],
) -> uuid.UUID:
    """
    Inserts one new PriceSnapshot row.

    ALWAYS inserts — never updates.
    Price history is immutable. Rows are never deleted or modified.
    A row represents "at this moment in time, this is what we saw."

    scrape_job_id links this snapshot back to the ScrapeJob that
    produced it. Optional because some snapshots may be inserted
    outside a scheduled job (manual trigger, backfill, etc.).

    Prices are stored as Decimal to avoid floating-point rounding.
    Decimal("4299.00") == Decimal("4299.00") always.
    4299.0 == 4299.00 is not guaranteed with IEEE 754 floats.

    Returns the new snapshot's UUID (needed by check_and_create_alerts
    to link the alert back to the snapshot that triggered it).
    """

    def _to_decimal(val) -> Optional[Decimal]:
        """Convert any price-like value to Decimal, or None if not present."""
        if val is None:
            return None
        try:
            return Decimal(str(val))
        except (InvalidOperation, TypeError):
            return None

    snapshot = PriceSnapshot(
        competitor_listing_id = competitor_listing_id,
        scrape_job_id         = scrape_job_id,
        price                 = Decimal(str(snapshot_data["price"])),
        currency              = snapshot_data["currency"],
        original_price        = _to_decimal(snapshot_data.get("original_price")),
        discount_pct          = _to_decimal(snapshot_data.get("discount_pct")),
        stock_status          = snapshot_data.get("stock_status", "unknown"),
        rating                = snapshot_data.get("rating"),
        review_count          = snapshot_data.get("review_count"),
        search_position       = snapshot_data.get("search_position"),
        seller_name           = snapshot_data.get("seller_name"),
        seller_id             = snapshot_data.get("seller_id"),
        product_title         = snapshot_data.get("product_title"),
        scraped_at            = (
            snapshot_data.get("scraped_at") or datetime.utcnow(
        )),
        )

    session.add(snapshot)
    await session.flush()  # snapshot.id is now assigned by PostgreSQL

    return snapshot.id

"""

save_own_snapshot() writes into tracked_product_snapshots, keyed on
tracked_product_id — a completely different target table and FK shape from
both save_product() (competitor discovery -> price_snapshots) and
save_monitoring_snapshot() (competitor monitoring -> price_snapshots +
listing_signals). There is no CompetitorListing, no MarketplaceSeller, and
no ListingSignal involved anywhere in this path — a tracked product is the
user's own listing, not a competitor's, so none of that machinery applies.
 
It DOES reuse _has_changed() unchanged, since that function only ever reads
.price and .stock_status off whatever object is passed in — both
PriceSnapshot and TrackedProductSnapshot expose those same two attributes,
so no duplication or generalization was actually needed there.
 
It deliberately does NOT call check_and_create_alerts() in this version.
Per the design discussion: a "self_out_of_stock" alert type is a real,
easy future extension (same Branch-2 stock-transition logic, just keyed to
tracked_product_id instead of competitor_listing_id) but is out of scope
for this first pass. The hook is marked below rather than silently
omitted.
"""
 
 
# ══════════════════════════════════════════════════════════════════════════════
# Fetch latest own-product snapshot (for change detection)
# ══════════════════════════════════════════════════════════════════════════════
 
async def get_latest_own_snapshot(
    session: AsyncSession,
    tracked_product_id: uuid.UUID,
) -> Optional[TrackedProductSnapshot]:
    """
    Returns the most recent TrackedProductSnapshot for this tracked
    product. Mirrors get_latest_snapshot() exactly, just against the
    own-product table instead of price_snapshots.
 
    Returns None if this tracked product has never had a snapshot
    recorded before (first-ever scrape, or a brand-new tracked
    product with no manual entry yet either) — same "None means
    always insert" signal _has_changed() already expects.
    """
    result = await session.execute(
        select(TrackedProductSnapshot)
        .where(TrackedProductSnapshot.tracked_product_id == tracked_product_id)
        .order_by(TrackedProductSnapshot.scraped_at.desc())
        .limit(1)
    )
    return result.scalars().first()
 
 
# ══════════════════════════════════════════════════════════════════════════════
# Insert TrackedProductSnapshot
# ══════════════════════════════════════════════════════════════════════════════
 
async def insert_own_snapshot(
    session: AsyncSession,
    snapshot_data: dict,
    tracked_product_id: uuid.UUID,
    scrape_job_id: Optional[uuid.UUID],
) -> uuid.UUID:
    """
    Inserts one new TrackedProductSnapshot row. Always inserts, never
    updates — same append-only philosophy as insert_snapshot().
 
    source is hardcoded to "scraped" here, not read from
    snapshot_data — every row reaching this function came from the
    scraping pipeline (per the design decision: own_url is scraped on
    the same cadence as competitor monitoring). "manual" rows are a
    completely separate write path (the dashboard's own price-entry
    endpoint), which will call its own insert against this same table
    directly, not through this function.
 
    currency is required from snapshot_data with no silent fallback —
    same reasoning as the fix already made in insert_snapshot(): the
    column default of 'PKR' would silently mislabel a UAE/Noon own-
    product price if ever relied upon, so a missing currency should
    fail loud rather than mislabel money.
    """
    def _to_decimal(val) -> Optional[Decimal]:
        if val is None:
            return None
        try:
            return Decimal(str(val))
        except (InvalidOperation, TypeError):
            return None
 
    snapshot = TrackedProductSnapshot(
        tracked_product_id=tracked_product_id,
        scrape_job_id=scrape_job_id,
        price=Decimal(str(snapshot_data["price"])),
        original_price=_to_decimal(snapshot_data.get("original_price")),
        currency=snapshot_data["currency"],
        stock_status=snapshot_data.get("stock_status", "unknown"),
        rating=snapshot_data.get("rating"),
        review_count=snapshot_data.get("review_count"),
        source="scraped",
        scraped_at=snapshot_data.get("scraped_at") or datetime.now(timezone.utc),
    )
 
    session.add(snapshot)
    await session.flush()
 
    return snapshot.id
 

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Alert detection
# ══════════════════════════════════════════════════════════════════════════════

async def check_and_create_alerts(
    session:               AsyncSession,
    user_id:               uuid.UUID,
    competitor_listing_id: uuid.UUID,
    price_snapshot_id:     uuid.UUID,
    snapshot_data:         dict,
    previous:              PriceSnapshot,
    threshold_pct:         Decimal,
) -> int:
    """
    Compares the new snapshot against the previous one.
    Creates Alert rows for changes that cross significance thresholds.

    Two completely independent alert branches.
    They can both fire in the same call (price dropped AND went out of stock).

    ─────────────────────────────────────────────────────────────────────────
    Branch 1 — Price alerts  (threshold-based)
    ─────────────────────────────────────────────────────────────────────────
    Formula: change_pct = (previous_price - current_price) / previous_price × 100

    Positive result = price went DOWN  → "price_drop"
    Negative result = price went UP    → "price_increase"

    Only fires if abs(change_pct) >= threshold_pct.
    Default threshold: 3%. Configurable via PRICE_CHANGE_THRESHOLD_PCT in .env.

    ─────────────────────────────────────────────────────────────────────────
    Branch 2 — Stock alerts  (no threshold — always fire)
    ─────────────────────────────────────────────────────────────────────────
    Losing stock visibility is always significant — no threshold needed.

    in_stock/limited → out_of_stock : "out_of_stock"
    out_of_stock     → in_stock/limited : "back_in_stock"
    Other transitions (e.g. limited → in_stock) are intentionally ignored.

    ─────────────────────────────────────────────────────────────────────────
    payload column
    ─────────────────────────────────────────────────────────────────────────
    The Alert model has a JSONB payload column for "the business story."
    We store the raw numbers there so the dashboard can render natural
    language like "Sharaf DG dropped iPhone 15 Pro Max from AED 4,299
    to AED 3,799 — a 11.6% drop."

    All Decimal values are cast to str before going into payload
    because JSON does not have a Decimal type.

    Returns count of alerts created (0, 1, or 2).
    """
    # previous is guaranteed non-None by the caller (save_product checks first)
    alerts_created = 0

    try:
        current_price  = Decimal(str(snapshot_data["price"]))
        previous_price = Decimal(str(previous.price))
    except (InvalidOperation, TypeError):
        logger.warning(
            f"[AlertCheck] Could not parse prices for listing "
            f"{competitor_listing_id}. Skipping alert check."
        )
        return 0

    current_stock  = snapshot_data.get("stock_status", "unknown")
    previous_stock = previous.stock_status or "unknown"
    currency       = snapshot_data["currency"]

    # ── Branch 1: Price alert ─────────────────────────────────────────────────
    if previous_price > 0:
        change_pct = (
            (previous_price - current_price) / previous_price * Decimal("100")
        ).quantize(Decimal("0.01"))

        if abs(change_pct) >= threshold_pct:
            alert_type = "price_drop" if change_pct > 0 else "price_increase"

            alert = Alert(
                user_id               = user_id,
                competitor_listing_id = competitor_listing_id,
                price_snapshot_id     = price_snapshot_id,
                alert_type            = alert_type,
                previous_value        = previous_price,
                current_value         = current_price,
                change_pct            = change_pct,
                threshold_used        = threshold_pct,
                is_read               = False,
                payload = {
                    "previous_price": str(previous_price),
                    "current_price":  str(current_price),
                    "change_pct":     str(change_pct),
                    "currency":       currency,
                },
            )
            session.add(alert)
            alerts_created += 1

            logger.info(
                f"[Alert] {alert_type} | listing={competitor_listing_id} | "
                f"{previous_price} → {current_price} ({change_pct}%) | "
                f"currency={currency}"
            )

    # ── Branch 2: Stock alert ─────────────────────────────────────────────────
    went_oos      = (current_stock == "out_of_stock"
                     and previous_stock in ("in_stock", "limited"))
    came_back     = (current_stock in ("in_stock", "limited")
                     and previous_stock == "out_of_stock")

    if went_oos or came_back:
        stock_alert_type = "out_of_stock" if went_oos else "back_in_stock"

        alert = Alert(
            user_id               = user_id,
            competitor_listing_id = competitor_listing_id,
            price_snapshot_id     = price_snapshot_id,
            alert_type            = stock_alert_type,
            previous_value        = None,
            current_value         = None,
            change_pct            = None,
            threshold_used        = None,
            is_read               = False,
            payload = {
                "previous_status": previous_stock,
                "current_status":  current_stock,
            },
        )
        session.add(alert)
        alerts_created += 1

        logger.info(
            f"[Alert] {stock_alert_type} | listing={competitor_listing_id} | "
            f"{previous_stock} → {current_stock}"
        )

    return alerts_created


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

async def save_product(session: AsyncSession, clean: dict) -> dict:
    """
    Full pipeline for one scraped product.
    The scraper orchestrator calls this once per product per scrape run.

    ─────────────────────────────────────────────────────────────────────────
    EXPECTED SHAPE OF clean
    ─────────────────────────────────────────────────────────────────────────

    {
        # Set by the orchestrator before scraping — never by the scraper itself
        "valid":               bool,          # False = cleaner rejected it
        "user_id":             str,           # UUID of the PriceIntel user
        "tracked_product_id":  str,           # UUID of the TrackedProduct
        "scrape_job_id":       str | None,    # UUID of the ScrapeJob, if any

        # Set by the scraper
        "marketplace_seller": {
            "marketplace":       str,         # "noon" | "daraz"
            "country":           str,         # "UAE" | "SAU" | "PAK"
            "external_store_id": str | None,  # "p-40123456"
            "store_name":        str,         # "Sharaf DG"
            "store_slug":        str | None,
        },

        "listing": {
            "url":                     str,   # Full product URL (the unique key)
            "platform":                str,   # "noon" | "daraz"
            "platform_sku":            str | None,
            "name":                    str | None,
            "category":                str | None,
            "image_url":               str | None,
            "render_type":             str,   # "api_driven" | "server_rendered" | "unknown"
            "discovered_by":           str,   # "search_scraper" | "store_scraper"
            "discovered_api_endpoint": str | None,
        },

        "snapshot": {
            "price":           str | Decimal,  # Required. Use string to avoid float issues.
            "currency":        str,            # "AED" | "PKR"
            "original_price":  str | None,
            "discount_pct":    str | None,
            "stock_status":    str,            # "in_stock" | "out_of_stock" | "limited" | "pre_order" | "unknown"
            "rating":          float | None,
            "review_count":    int | None,
            "search_position": int | None,
            "seller_name":     str | None,
            "seller_id":       str | None,
            "product_title":   str | None,
            "scraped_at":      datetime | None,
        }
    }

    ─────────────────────────────────────────────────────────────────────────
    RETURN VALUE
    ─────────────────────────────────────────────────────────────────────────

    {
        "status":   "rejected" | "skipped" | "saved",
        "is_new":   bool,   # True if this CompetitorListing was just created
        "snapshot": bool,   # True if a PriceSnapshot row was inserted
        "alerts":   int,    # Count of Alert rows created (0, 1, or 2)
    }

    The orchestrator aggregates these dicts across all products in a run
    and uses the totals to update the ScrapeJob row.

    ─────────────────────────────────────────────────────────────────────────
    ERROR HANDLING
    ─────────────────────────────────────────────────────────────────────────

    Any unhandled exception is logged and re-raised.
    The caller's session.begin() context manager catches the exception
    and rolls back the entire batch transaction automatically.
    No partial writes reach the database.
    """

    # ── Gate: validity check ──────────────────────────────────────────────────
    if not clean.get("valid"):
        logger.debug(
            f"[Rejected] url={clean.get('listing', {}).get('url', 'unknown')[:80]}"
        )
        return {"status": "rejected", "is_new": False, "snapshot": False, "alerts": 0}

    # ── Parse context IDs ─────────────────────────────────────────────────────
    # These come from the orchestrator, not the scraper.
    # If either is missing or malformed, reject immediately.
    try:
        user_id            = uuid.UUID(str(clean["user_id"]))
        tracked_product_id = uuid.UUID(str(clean["tracked_product_id"]))
    except (KeyError, ValueError, AttributeError) as e:
        logger.error(
            f"[Rejected] Missing or invalid user_id / tracked_product_id: {e}"
        )
        return {"status": "rejected", "is_new": False, "snapshot": False, "alerts": 0}

    scrape_job_id: Optional[uuid.UUID] = None
    if clean.get("scrape_job_id"):
        try:
            scrape_job_id = uuid.UUID(str(clean["scrape_job_id"]))
        except (ValueError, AttributeError):
            pass  # scrape_job_id is optional — don't fail the whole product

    try:
        # ── Step 1: Upsert MarketplaceSeller ──────────────────────────────────
        marketplace_seller_id = await upsert_marketplace_seller(
            session     = session,
            seller_data = clean["marketplace_seller"],
        )

        # ── Step 2: Upsert CompetitorListing ──────────────────────────────────
        competitor_listing_id, is_new = await upsert_competitor_listing(
            session                = session,
            listing_data           = clean["listing"],
            tracked_product_id     = tracked_product_id,
            marketplace_seller_id  = marketplace_seller_id,
        )

        # ── Step 3: Fetch previous snapshot ───────────────────────────────────
        previous = await get_latest_snapshot(session, competitor_listing_id)

        # ── Step 4: Change detection ───────────────────────────────────────────
        if not _has_changed(previous, clean["snapshot"]):
            logger.debug(
                f"[Skipped] No price/stock change | listing={competitor_listing_id}"
            )
            return {
                "status":   "skipped",
                "is_new":   is_new,
                "snapshot": False,
                "alerts":   0,
            }

        # ── Step 5: Insert PriceSnapshot ──────────────────────────────────────
        snapshot_id = await insert_snapshot(
            session               = session,
            snapshot_data         = clean["snapshot"],
            competitor_listing_id = competitor_listing_id,
            scrape_job_id         = scrape_job_id,
        )

        # ── Step 6: Alert detection ────────────────────────────────────────────
        # Resolve the alert threshold from config, fall back to 3% if not set.
        try:
            from app.config import settings as _settings
            threshold = Decimal(str(_settings.PRICE_CHANGE_THRESHOLD_PCT))
        except (AttributeError, ImportError, InvalidOperation):
            threshold = _DEFAULT_THRESHOLD_PCT

        alerts_created = 0
        if previous is not None:
            # previous is None only on the very first scrape for this listing.
            # No previous snapshot → nothing to compare → no alert possible.
            alerts_created = await check_and_create_alerts(
                session               = session,
                user_id               = user_id,
                competitor_listing_id = competitor_listing_id,
                price_snapshot_id     = snapshot_id,
                snapshot_data         = clean["snapshot"],
                previous              = previous,
                threshold_pct         = threshold,
            )

        logger.debug(
            f"[Saved] listing={competitor_listing_id} | "
            f"is_new={is_new} | alerts={alerts_created}"
        )

        return {
            "status":   "saved",
            "is_new":   is_new,
            "snapshot": True,
            "alerts":   alerts_created,
        }

    except Exception as e:
        logger.error(
            f"[Error] save_product failed | "
            f"url={clean.get('listing', {}).get('url', 'unknown')[:80]} | "
            f"error={e}",
            exc_info=True,   # logs full traceback
        )
        raise  # let session.begin() roll back the transaction



"""
Step 4 additions to pipeline/loader.py — the monitoring write path.

Add these imports at the top of loader.py, alongside the existing ones:

    from app.models.listing_signal import ListingSignal
    from app.models.competitor_listing import CompetitorListing  # already imported

These new functions go at the end of loader.py, after check_and_create_alerts
and before save_product (or after save_product — doesn't matter functionally,
but grouping it as its own clearly-labeled section keeps the discovery path
(save_product) and the monitoring path (save_monitoring_snapshot) visually
separate in the file, since they serve different callers and must never be
confused with each other).

═══════════════════════════════════════════════════════════════════════════════
WHY THIS IS A SEPARATE ENTRY POINT FROM save_product()
═══════════════════════════════════════════════════════════════════════════════

save_product() is the discovery/search path — it upserts (creates-or-updates)
MarketplaceSeller and CompetitorListing rows, because search results describe
products/sellers that may not exist in the database yet.

Monitoring is different: it only ever operates on CompetitorListings that
are ALREADY confirmed and already exist. It must never create a new
CompetitorListing row — an unmatched offer from the product-page API belongs
to a seller who isn't one of the user's confirmed competitors, and silently
inserting them as a real listing would corrupt the confirmed set. That case
is intentionally dropped by the caller before this function is ever invoked
(see the orchestration layer, built separately) — by the time
save_monitoring_snapshot() is called, `listing` is guaranteed to already be
a real, confirmed CompetitorListing row.

This function reuses get_latest_snapshot(), _has_changed(), insert_snapshot(),
and check_and_create_alerts() completely unchanged from the discovery path
above — there is exactly one definition of "did the price change" and one
definition of "does this cross an alert threshold" in the whole codebase,
used by both paths.
"""

# ══════════════════════════════════════════════════════════════════════════════
# Volatility scoring (pure logic, no DB calls)
# ══════════════════════════════════════════════════════════════════════════════

# Exponential moving average of "did this listing's price/stock change on
# the last scrape." A competitor who reprices often trends toward 1.0; a
# stable one trends toward 0.0. Chosen over a rolling-count window because
# it needs no extra storage (no "last N results" array to maintain), it
# naturally weights recent behavior more than old behavior with zero extra
# bookkeeping, and it converges to a stable read within roughly 10-15
# scrapes — fast enough to be useful, slow enough not to be noisy from one
# outlier scrape.
_VOLATILITY_DECAY = 0.9  # weight given to the existing score
_VOLATILITY_STEP = 0.1   # weight given to this scrape's outcome (must sum to 1.0 with decay)


def _update_volatility_score(previous_score: float, changed: bool) -> float:
    """
    previous_score : listing.volatility_score before this scrape.
    changed         : whether _has_changed() returned True this run.

    Returns the new volatility_score, rounded to 4 decimal places
    (matches the Float column — rounding here keeps values stable and
    avoids accumulating float noise over thousands of updates).
    """
    outcome = 1.0 if changed else 0.0
    new_score = (previous_score * _VOLATILITY_DECAY) + (outcome * _VOLATILITY_STEP)
    return round(new_score, 4)


# ══════════════════════════════════════════════════════════════════════════════
# Seller backfill
# ══════════════════════════════════════════════════════════════════════════════

async def backfill_seller_external_id_if_missing(
    session: AsyncSession,
    listing: CompetitorListing,
    partner_code: Optional[str],
) -> None:
    """
    If this listing's marketplace_seller has no external_store_id yet,
    and this scrape's offer carried a partner_code, backfill it now.

    Only ever fills a NULL — never overwrites an existing value. A
    seller's external_store_id should never legitimately change once
    set; if it appears to, that's a data question worth investigating
    manually, not something to silently overwrite here.

    No-op (returns immediately) if:
      - listing has no marketplace_seller relationship loaded/set, or
      - marketplace_seller.external_store_id is already populated, or
      - partner_code is None (offer didn't carry one — shouldn't happen
        given partner_code is confirmed always-present in real API
        responses, but defensive rather than assuming).
    """
    seller = listing.marketplace_seller
    if seller is None:
        return
    if seller.external_store_id:
        return
    if not partner_code:
        return

    seller.external_store_id = partner_code
    session.add(seller)
    await session.flush()


# ══════════════════════════════════════════════════════════════════════════════
# ListingSignal insert
# ══════════════════════════════════════════════════════════════════════════════

async def insert_listing_signal(
    session: AsyncSession,
    signal_data: dict,
    competitor_listing_id: uuid.UUID,
    price_snapshot_id: uuid.UUID,
    detected_at: datetime,
) -> uuid.UUID:
    """
    Inserts one ListingSignal row, always paired 1:1 with the
    PriceSnapshot row that was just inserted for the same scrape.

    detected_at is passed explicitly as the SAME value as the parent
    snapshot's scraped_at — deliberately not left to its own
    server_default, so the two rows never drift apart in time even by
    a few seconds, keeping any future time-series join between them
    exact.

    signal_data is the dict returned by utils.extract_signals(offer) —
    keys: nudges, warranty, partner_rating, positive_seller_rating.

    Only called when a new PriceSnapshot was actually inserted (i.e.
    _has_changed() returned True) — there is no ListingSignal row for
    scrapes that were skipped as unchanged, matching the same
    "only record events, not every poll" philosophy as price_snapshots
    itself.
    """
    signal = ListingSignal(
        competitor_listing_id=competitor_listing_id,
        price_snapshot_id=price_snapshot_id,
        nudges=signal_data.get("nudges", []),
        warranty=signal_data.get("warranty"),
        partner_rating=signal_data.get("partner_rating"),
        positive_seller_rating=signal_data.get("positive_seller_rating"),
        detected_at=detected_at,
    )
    session.add(signal)
    await session.flush()

    return signal.id


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — monitoring write path
# ══════════════════════════════════════════════════════════════════════════════

async def save_monitoring_snapshot(
    session: AsyncSession,
    listing: CompetitorListing,
    offer_data: dict,
    signal_data: dict,
    partner_code: Optional[str],
    scrape_job_id: Optional[uuid.UUID],
    user_id: uuid.UUID,
) -> dict:
    """
    Full write path for one matched offer against one confirmed,
    already-existing CompetitorListing. Called once per matched offer
    by the monitoring orchestration loop (built separately).

    ─────────────────────────────────────────────────────────────────────────
    EXPECTED SHAPE OF offer_data
    ─────────────────────────────────────────────────────────────────────────
    The dict returned by utils.extract_offer(offer, product_rating) — keys:
    seller_name, seller_id, product_title, price, original_price,
    discount_pct, stock_status, stock_count, rating, review_count,
    is_lowest_price_nudge, low_stock_nudge_value, delivery_estimate.

    NOTE: offer_data does not include "currency" or "scraped_at" — those
    are set explicitly below, never left to a column default (currency
    defaults to 'PKR' at the DB level, which would silently mislabel
    every UAE snapshot if relied upon).

    ─────────────────────────────────────────────────────────────────────────
    EXPECTED SHAPE OF signal_data
    ─────────────────────────────────────────────────────────────────────────
    The dict returned by utils.extract_signals(offer) — keys: nudges,
    warranty, partner_rating, positive_seller_rating.

    ─────────────────────────────────────────────────────────────────────────
    FLOW
    ─────────────────────────────────────────────────────────────────────────
        fetch previous snapshot (get_latest_snapshot — unchanged)
        → change detection (_has_changed — unchanged)
        → if unchanged: bump consecutive_unchanged, return early
        → insert PriceSnapshot (insert_snapshot — unchanged)
        → insert ListingSignal (new, this file)
        → backfill seller external_store_id if missing (new, this file)
        → reset consecutive_unchanged, update last_price_change_at,
          update volatility_score (new, this file)
        → check_and_create_alerts (unchanged) — only if a previous
          snapshot existed, same guard as save_product uses

    ─────────────────────────────────────────────────────────────────────────
    RETURN VALUE
    ─────────────────────────────────────────────────────────────────────────
    {
        "status":   "skipped" | "saved",
        "snapshot": bool,   # True if a PriceSnapshot row was inserted
        "alerts":   int,    # Count of Alert rows created (0, 1, or 2)
    }

    Mirrors save_product()'s return shape (minus "is_new" and "rejected",
    which don't apply here — this function is never called on invalid
    data, and never creates new listings) so orchestration-level
    aggregation code can treat both paths similarly if useful later.

    ─────────────────────────────────────────────────────────────────────────
    ERROR HANDLING
    ─────────────────────────────────────────────────────────────────────────
    Any unhandled exception is logged and re-raised, identical to
    save_product() — the caller's transaction boundary (commit per
    unique SKU processed, per the existing poisoned-transaction
    pattern) rolls back on any exception. No partial writes reach the
    database for this listing's update.
    """
    try:
        # ── Step 1: Fetch previous snapshot ───────────────────────────────
        previous = await get_latest_snapshot(session, listing.id)

        # ── Step 2: Change detection (identical function, both paths) ────
        if not _has_changed(previous, offer_data):
            listing.consecutive_unchanged = (listing.consecutive_unchanged or 0) + 1
            session.add(listing)
            await session.flush()

            logger.debug(
                f"[Monitoring][Skipped] No price/stock change | "
                f"listing={listing.id}"
            )
            return {"status": "skipped", "snapshot": False, "alerts": 0}

        # ── Step 3: Explicit scraped_at / currency, never left to defaults ─
        scraped_at = datetime.utcnow()
        snapshot_data = {
            **offer_data,
            "currency": "AED",  # UAE-only for now, per current scope
            "scraped_at": scraped_at,
        }

        # ── Step 4: Insert PriceSnapshot (identical function, both paths) ─
        snapshot_id = await insert_snapshot(
            session=session,
            snapshot_data=snapshot_data,
            competitor_listing_id=listing.id,
            scrape_job_id=scrape_job_id,
        )

        # ── Step 5: Insert ListingSignal, same scraped_at as the snapshot ─
        await insert_listing_signal(
            session=session,
            signal_data=signal_data,
            competitor_listing_id=listing.id,
            price_snapshot_id=snapshot_id,
            detected_at=scraped_at,
        )

        # ── Step 6: Backfill seller external_store_id if missing ─────────
        await backfill_seller_external_id_if_missing(
            session=session,
            listing=listing,
            partner_code=partner_code,
        )

        # ── Step 7: Adaptive scheduling update ────────────────────────────
        listing.consecutive_unchanged = 0
        listing.last_price_change_at = scraped_at
        listing.volatility_score = _update_volatility_score(
            listing.volatility_score, changed=True
        )
        session.add(listing)
        await session.flush()

        # ── Step 8: Alert detection (identical function, both paths) ─────
        try:
            from app.config import settings as _settings
            threshold = Decimal(str(_settings.PRICE_CHANGE_THRESHOLD_PCT))
        except (AttributeError, ImportError):
            threshold = _DEFAULT_THRESHOLD_PCT

        alerts_created = 0
        if previous is not None:
            alerts_created = await check_and_create_alerts(
                session=session,
                user_id=user_id,
                competitor_listing_id=listing.id,
                price_snapshot_id=snapshot_id,
                snapshot_data=snapshot_data,
                previous=previous,
                threshold_pct=threshold,
            )

        logger.debug(
            f"[Monitoring][Saved] listing={listing.id} | alerts={alerts_created}"
        )

        return {"status": "saved", "snapshot": True, "alerts": alerts_created}

    except Exception as e:
        logger.error(
            f"[Monitoring][Error] save_monitoring_snapshot failed | "
            f"listing={listing.id} | error={e}",
            exc_info=True,
        )
        raise


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — own-product monitoring write path
# ══════════════════════════════════════════════════════════════════════════════
 
async def save_own_snapshot(
    session: AsyncSession,
    tracked_product_id: uuid.UUID,
    clean: dict,
    scrape_job_id: Optional[uuid.UUID],
) -> dict:
    """
    Full write path for one scraped own-product detail page. Called
    once per tracked product per monitoring run, right after that
    product's confirmed competitor listings have been processed —
    per the orchestration decision: own price and competitor prices
    are captured in the same run so they represent a genuinely
    simultaneous comparison.
 
    ─────────────────────────────────────────────────────────────────
    EXPECTED SHAPE OF clean
    ─────────────────────────────────────────────────────────────────
    The dict returned by clean_own_snapshot_noon() / _daraz() in
    cleaner.py:
        {
            "valid": bool,
            "own_snapshot": {
                "price": str | None,
                "original_price": str | None,
                "currency": str,
                "stock_status": str,
                "rating": float | None,
                "review_count": int | None,
                "scraped_at": datetime,
            },
        }
 
    ─────────────────────────────────────────────────────────────────
    FLOW
    ─────────────────────────────────────────────────────────────────
        validity check
        -> fetch latest TrackedProductSnapshot (change detection)
        -> if unchanged: skip, return early
        -> insert TrackedProductSnapshot
        -> [future hook] self_out_of_stock alert check goes here
 
    ─────────────────────────────────────────────────────────────────
    RETURN VALUE
    ─────────────────────────────────────────────────────────────────
    {
        "status":   "rejected" | "skipped" | "saved",
        "snapshot": bool,
    }
 
    Mirrors the shape of save_product()/save_monitoring_snapshot()'s
    returns (minus "is_new" and "alerts", which don't apply here yet)
    so orchestration-level aggregation can treat all three similarly.
 
    ─────────────────────────────────────────────────────────────────
    ERROR HANDLING
    ─────────────────────────────────────────────────────────────────
    Same pattern as the other two entry points: log and re-raise, let
    the caller's session.begin() roll back the whole batch.
    """
    if not clean.get("valid"):
        logger.debug(
            f"[OwnSnapshot][Rejected] tracked_product={tracked_product_id} "
            f"| unparseable/non-positive price"
        )
        return {"status": "rejected", "snapshot": False}
 
    own_snapshot_data = clean["own_snapshot"]
 
    try:
        previous = await get_latest_own_snapshot(session, tracked_product_id)
 
        if not _has_changed(previous, own_snapshot_data):
            logger.debug(
                f"[OwnSnapshot][Skipped] No price/stock change | "
                f"tracked_product={tracked_product_id}"
            )
            return {"status": "skipped", "snapshot": False}
 
        await insert_own_snapshot(
            session=session,
            snapshot_data=own_snapshot_data,
            tracked_product_id=tracked_product_id,
            scrape_job_id=scrape_job_id,
        )
 
        # ── Future hook ────────────────────────────────────────────────
        # A "self_out_of_stock" / "self_back_in_stock" alert type would
        # go here, reusing check_and_create_alerts()'s Branch 2 stock-
        # transition logic keyed to tracked_product_id instead of
        # competitor_listing_id. Deliberately not implemented in this
        # pass — flagged, not silently dropped.
 
        logger.debug(f"[OwnSnapshot][Saved] tracked_product={tracked_product_id}")
 
        return {"status": "saved", "snapshot": True}
 
    except Exception as e:
        logger.error(
            f"[OwnSnapshot][Error] save_own_snapshot failed | "
            f"tracked_product={tracked_product_id} | error={e}",
            exc_info=True,
        )
        raise

    # ══════════════════════════════════════════════════════════════════════════════
# save_daraz_monitoring_snapshot — Daraz monitoring write path
# ══════════════════════════════════════════════════════════════════════════════
#
# Add this to pipeline/loader.py, in the same "monitoring write path"
# section as save_monitoring_snapshot (Noon's version) — grouped
# together since both serve the same kind of caller (the monitoring
# orchestration loop, one per platform) but are NOT interchangeable.
#
# ─────────────────────────────────────────────────────────────────────────
# WHY THIS IS ITS OWN FUNCTION, NOT A signal_data=None VARIANT OF
# save_monitoring_snapshot
# ─────────────────────────────────────────────────────────────────────────
# save_monitoring_snapshot's whole middle section exists to solve a
# problem Daraz doesn't have: matching one of several sellers' offers
# on a shared product page via partner_code, then splitting that
# match into offer_data + signal_data (nudges/warranty/partner_rating)
# via two separate extraction passes. Daraz's extract_product_detail
# already returns ONE seller's ONE variant's complete data in a single
# flat dict — there is no matching step, and no separate signals dict
# to insert into ListingSignal.
#
# Making save_monitoring_snapshot accept signal_data=None to "handle"
# Daraz would leave dead matching-shaped code paths for a case that
# structurally can't occur here, per the same reasoning that drove
# splitting the monitoring orchestration loop itself into
# _monitor_noon_listings / _monitor_daraz_listings — the platforms
# don't just need different inputs, they need a different sequence of
# steps.
#
# ─────────────────────────────────────────────────────────────────────────
# WHAT IS STILL REUSED, UNCHANGED
# ─────────────────────────────────────────────────────────────────────────
# get_latest_snapshot, _has_changed, insert_snapshot,
# check_and_create_alerts, backfill_seller_external_id_if_missing, and
# _update_volatility_score are all reused exactly as-is. None of them
# contain anything Noon-specific — they operate on PriceSnapshot /
# CompetitorListing columns and generic dicts, which Daraz's cleaned
# data populates identically to Noon's. Only the ListingSignal insert
# and the offer-matching step are absent here.
#
# Add this import at the top of loader.py if not already present:
#     (no new imports needed — everything used here is already
#      imported for save_monitoring_snapshot)


async def save_daraz_monitoring_snapshot(
    session: AsyncSession,
    listing: CompetitorListing,
    offer_data: dict,
    currency: str,
    scrape_job_id: Optional[uuid.UUID],
    user_id: uuid.UUID,
) -> dict:
    """
    Full write path for one scraped Daraz product-detail result against
    one confirmed, already-existing CompetitorListing. Called once per
    confirmed listing by the Daraz monitoring orchestration loop — one
    listing always means exactly one scrape and one call here, unlike
    Noon's SKU-shared fan-out.

    ─────────────────────────────────────────────────────────────────
    EXPECTED SHAPE OF offer_data
    ─────────────────────────────────────────────────────────────────
    The dict returned by scraper/platforms/daraz/utils.py's
    extract_product_detail() (via product_scraper.scrape_product_page):
        item_id, sku_id, platform_sku, product_title, seller_name,
        seller_external_id, seller_positive_rating_pct, price,
        original_price, discount_pct, stock_status, stock_message,
        warranty, rating, review_count.

    Note the key is "seller_external_id", not "seller_id" — mapped
    explicitly below rather than renamed upstream, so
    extract_product_detail's output stays a faithful, unmodified
    mirror of what Daraz's API actually calls it.

    currency is passed in explicitly by the caller (resolved from
    DARAZ_COUNTRY_CURRENCY against the tracked product's store
    country), never defaulted here — offer_data carries no currency
    field of its own, and PriceSnapshot's column default ('PKR') would
    silently mislabel non-Pakistan snapshots if ever relied upon
    instead. Same reasoning as the currency fix already made elsewhere
    in this file.

    ─────────────────────────────────────────────────────────────────
    FLOW
    ─────────────────────────────────────────────────────────────────
        fetch previous snapshot (get_latest_snapshot — unchanged)
        -> change detection (_has_changed — unchanged)
        -> if unchanged: bump consecutive_unchanged, return early
        -> insert PriceSnapshot (insert_snapshot — unchanged)
        -> backfill seller external_store_id if missing (unchanged
           helper — a no-op here in practice, since Daraz always
           returns seller_external_id directly on every call, but kept
           for consistency in case a listing's marketplace_seller
           somehow still lacks one)
        -> reset consecutive_unchanged, update last_price_change_at,
           update volatility_score (unchanged helper)
        -> check_and_create_alerts (unchanged) — only if a previous
           snapshot existed, same guard as every other entry point

    No ListingSignal insert — see module-level rationale above.

    ─────────────────────────────────────────────────────────────────
    RETURN VALUE
    ─────────────────────────────────────────────────────────────────
    {
        "status":   "skipped" | "saved",
        "snapshot": bool,
        "alerts":   int,
    }
    Identical shape to save_monitoring_snapshot's return, so
    orchestration-level counters (_update_counters) work unmodified
    across both platforms.

    ─────────────────────────────────────────────────────────────────
    ERROR HANDLING
    ─────────────────────────────────────────────────────────────────
    Logged and re-raised, identical pattern to every other entry point
    in this file — the caller's transaction boundary rolls back on any
    exception.
    """
    try:
        # ── Step 1: Fetch previous snapshot (identical function) ──────────
        previous = await get_latest_snapshot(session, listing.id)

        # ── Step 2: Build snapshot_data — map Daraz's field names onto
        #    the generic shape insert_snapshot / _has_changed expect ─────
        snapshot_data = {
            "price": offer_data.get("price"),
            "currency": currency,
            "original_price": offer_data.get("original_price"),
            "discount_pct": offer_data.get("discount_pct"),
            "stock_status": offer_data.get("stock_status", "unknown"),
            "rating": offer_data.get("rating"),
            "review_count": offer_data.get("review_count"),
            "search_position": None,  # Daraz detail calls carry no rank
            "seller_name": offer_data.get("seller_name"),
            "seller_id": offer_data.get("seller_external_id"),
            "product_title": offer_data.get("product_title"),
            "scraped_at": datetime.utcnow(),
        }

        # ── Step 3: Change detection (identical function, all paths) ──────
        if not _has_changed(previous, snapshot_data):
            listing.consecutive_unchanged = (listing.consecutive_unchanged or 0) + 1
            session.add(listing)
            await session.flush()

            logger.debug(
                f"[DarazMonitoring][Skipped] No price/stock change | "
                f"listing={listing.id}"
            )
            return {"status": "skipped", "snapshot": False, "alerts": 0}

        # ── Step 4: Insert PriceSnapshot (identical function) ─────────────
        snapshot_id = await insert_snapshot(
            session=session,
            snapshot_data=snapshot_data,
            competitor_listing_id=listing.id,
            scrape_job_id=scrape_job_id,
        )

        # ── Step 5: Backfill seller external_store_id if missing ──────────
        await backfill_seller_external_id_if_missing(
            session=session,
            listing=listing,
            partner_code=offer_data.get("seller_external_id"),
        )

        # ── Step 6: Adaptive scheduling update (identical helper) ─────────
        listing.consecutive_unchanged = 0
        listing.last_price_change_at = snapshot_data["scraped_at"]
        listing.volatility_score = _update_volatility_score(
            listing.volatility_score, changed=True
        )
        session.add(listing)
        await session.flush()

        # ── Step 7: Alert detection (identical function) ──────────────────
        try:
            from app.config import settings as _settings
            threshold = Decimal(str(_settings.PRICE_CHANGE_THRESHOLD_PCT))
        except (AttributeError, ImportError, InvalidOperation):
            threshold = _DEFAULT_THRESHOLD_PCT

        alerts_created = 0
        if previous is not None:
            alerts_created = await check_and_create_alerts(
                session=session,
                user_id=user_id,
                competitor_listing_id=listing.id,
                price_snapshot_id=snapshot_id,
                snapshot_data=snapshot_data,
                previous=previous,
                threshold_pct=threshold,
            )

        logger.debug(
            f"[DarazMonitoring][Saved] listing={listing.id} | "
            f"alerts={alerts_created}"
        )

        return {"status": "saved", "snapshot": True, "alerts": alerts_created}

    except Exception as e:
        logger.error(
            f"[DarazMonitoring][Error] save_daraz_monitoring_snapshot failed | "
            f"listing={listing.id} | error={e}",
            exc_info=True,
        )
        raise