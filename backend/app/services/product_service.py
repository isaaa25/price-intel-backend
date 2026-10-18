"""
app/services/product_service.py

FIX vs. previous version: rewritten for AsyncSession, matching
store_service.py's async correction and the flush()-not-commit()
convention documented in auth_service.py.

SECOND FIX: generalize_title() (pipeline/ai/query_generalizer.py) is a
synchronous, blocking network call to the Gemini API — calling it
directly inside an async def function would block the event loop for
however long that HTTP call takes, exactly the same problem your
Phase 1 doc documents for bcrypt hashing. Wrapped with
run_in_threadpool for the same reason bcrypt was.
"""

from typing import List, Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from app.queries import (
    fetch_product_kpi_row, fetch_product_competitors_rows, fetch_portfolio_rows,
    fetch_opportunities_rows, fetch_price_wars_rows, fetch_market_movement_rows,
    fetch_product_market_movement_rows, fetch_competitor_candidates_rows, fetch_attention_items, fetch_alerts_rows, mark_alerts_read_by_user,
    fetch_price_trend_rows,
)
from fastapi import HTTPException

from app.models.tracked_product import TrackedProduct
from app.models.competitor_listing import CompetitorListing
from app.models.user_store import UserStore
from app.services.store_service import get_store_or_404
from pipeline.ai.query_generalizer import generalize_title
from pipeline.discovery_daraz import discover_competitors_for_product
from fastapi import HTTPException, status
from pipeline.marketplace_url import (
    validate_product_url,
    MarketplaceUrlError,
)



async def create_product(db: AsyncSession, user_id, product_data) -> TrackedProduct:
    """
    Creates a new TrackedProduct under the given store, after
    validating the store belongs to the requesting user and is active.

    ─────────────────────────────────────────────────────────────────
    WHY search_keyword IS GENERATED AFTER INSERT, NOT BEFORE
    ─────────────────────────────────────────────────────────────────
    If the Gemini call fails or is slow, the product still gets
    created immediately — search_keyword just stays NULL, and
    run_discovery's lazy fallback path (main_noon.py / main_daraz.py)
    picks up the slack later. A user adding a product should never be
    blocked or see a 500 because an external AI API had a bad moment.
    Product creation succeeding is the more important guarantee than
    search_keyword being populated synchronously.

    generalize_title() itself never raises (falls back to returning
    the original title on any failure) — so in practice this is
    almost always a single clean flow, with the try/except here as a
    second layer of defense specifically around the flush step, not
    the AI call itself.
    """
    store = await get_store_or_404(db, product_data.store_id, user_id)

    try:
        validate_product_url(
            product_data.own_url,
            expected_marketplace=store.marketplace,
            expected_country=store.country,
        )
    except MarketplaceUrlError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    product = TrackedProduct(
        store_id=store.id,
        title=product_data.title,
        own_url=product_data.own_url,
        own_cost=product_data.own_cost,
        category=product_data.category,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)

    # ── Generate and persist search_keyword ────────────────────────────
    # run_in_threadpool: generalize_title() makes a blocking Gemini API
    # call — running it directly here would stall the event loop for
    # every other concurrent request while waiting on the network,
    # same reasoning as auth_service.py's bcrypt/run_in_threadpool fix.
    try:
        keyword = await run_in_threadpool(generalize_title, product.title)
        product.search_keyword = keyword
        db.add(product)
        await db.flush()
        await db.refresh(product)
    except Exception:
        # Product creation has already succeeded (flushed) above — this
        # failure only means search_keyword stays NULL, which the
        # scraper side's lazy fallback will fill in on the first
        # discovery run. Not re-raised: the user's product-add request
        # should still return 200/201.
        pass

    return product


async def get_products(db: AsyncSession, user_id, store_id: Optional[uuid.UUID] = None) -> List[TrackedProduct]:
    """
    Returns TrackedProduct rows that belong to the requesting user,
    optionally filtered by a specific store_id.
    """
    stmt = (
        select(TrackedProduct)
        .join(UserStore, TrackedProduct.store_id == UserStore.id)
        .where(UserStore.user_id == user_id)
    )
    if store_id is not None:
        stmt = stmt.where(TrackedProduct.store_id == store_id)
    stmt = stmt.order_by(TrackedProduct.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())

    """ added store_id to filter the products by store^ """

    # query added for extracting products data from db- query added in queries.py file.
async def get_product_kpis(db: AsyncSession, product_id) -> Optional[dict]:
    result = await fetch_product_kpi_row(db, product_id)
    row = result.fetchone()
    if row is None:
        return None
    own_price = row.latest_snapshot_price if row.latest_snapshot_price is not None else row.own_cost
    return {
        "own_price": own_price,
        "cheapest_competitor": row.cheapest_competitor_price,
        "num_competitors": row.num_competitors,
        "is_cheapest": (
            own_price is not None and row.cheapest_competitor_price is not None
            and own_price <= row.cheapest_competitor_price
        ),
    }

async def discover_competitors(db: AsyncSession, product_id, user_id) -> list[dict]:
    """
    On-demand discovery for one product. Verifies ownership, then runs
    the Daraz discovery pipeline and returns pending candidates.
    """
    # Ownership check (raises 404 if not owned)
    await get_product_by_id(db, product_id, user_id)
    try:
        return await discover_competitors_for_product(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

async def get_product_by_id(db: AsyncSession, product_id, user_id) -> TrackedProduct:
    """
    Returns a single TrackedProduct, verifying it belongs to the requesting user.
    Raises 404 if not found or not owned by the user.
    """
    from fastapi import HTTPException
    stmt = (
        select(TrackedProduct)
        .join(UserStore, TrackedProduct.store_id == UserStore.id)
        .where(TrackedProduct.id == product_id)
        .where(UserStore.user_id == user_id)
    )
    result = await db.execute(stmt)
    product = result.scalars().first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


async def update_product(db: AsyncSession, product_id, user_id, update_data) -> TrackedProduct:
    """
    Updates a TrackedProduct's details (title, own_cost, category, own_url, search_keyword, is_active).
    Verifies that the product belongs to the requesting user.
    If title is changed and no new search_keyword is provided, regenerates search_keyword.
    """
    product = await get_product_by_id(db, product_id, user_id)

    title_changed = (
        update_data.title is not None and update_data.title.strip() != "" and update_data.title != product.title
    )

    if update_data.title is not None and update_data.title.strip() != "":
        product.title = update_data.title.strip()
    if update_data.own_cost is not None:
        product.own_cost = update_data.own_cost
    if update_data.category is not None:
        product.category = update_data.category.strip() or None
    if update_data.own_url is not None and update_data.own_url.strip() != "":
        product.own_url = update_data.own_url.strip()
    if update_data.search_keyword is not None:
        product.search_keyword = update_data.search_keyword.strip() or None
    if update_data.is_active is not None:
        product.is_active = update_data.is_active

    db.add(product)
    await db.flush()
    await db.refresh(product)

    if title_changed and update_data.search_keyword is None:
        try:
            keyword = await run_in_threadpool(generalize_title, product.title)
            product.search_keyword = keyword
            db.add(product)
            await db.flush()
            await db.refresh(product)
        except Exception:
            pass

    return product


async def delete_product(db: AsyncSession, product_id, user_id) -> None:
    """
    Deletes a TrackedProduct by id, scoped to the requesting user.
    Cascading competitor listings and snapshots are deleted automatically.
    """
    product = await get_product_by_id(db, product_id, user_id)
    await db.delete(product)
    await db.flush()


async def get_product_competitors(db: AsyncSession, product_id) -> list[dict]:
    result = await fetch_product_competitors_rows(db, product_id)
    rows = result.fetchall()
    competitors = []

    for r in rows:
        latest = float(r.latest_price) if r.latest_price is not None else None
        own = float(r.own_cost) if hasattr(r, "own_cost") and r.own_cost is not None else None
        changes = int(r.price_changes_30d) if hasattr(r, "price_changes_30d") and r.price_changes_30d is not None else 0
        volatility = float(r.volatility_score) if hasattr(r, "volatility_score") and r.volatility_score is not None else 0.0

        # ── 1. Calculate Repricing Velocity ──
        if changes >= 3 or volatility >= 0.5:
            velocity = "High"
        elif changes == 2 or volatility >= 0.2:
            velocity = "Moderate"
        elif changes == 1:
            velocity = "Low"
        else:
            velocity = "Static"

        # ── 2. Calculate Behavior Type ──
        if latest is not None and own is not None and own > 0:
            diff_pct = ((latest - own) / own) * 100

            if diff_pct <= -10:
                behavior = "Aggressive Undercutter" if velocity in ("High", "Moderate") else "Discount Seller"
            elif -10 < diff_pct <= -2:
                behavior = "Undercutter"
            elif -2 <= diff_pct <= 2:
                behavior = "Price Matcher"
            elif diff_pct > 10:
                behavior = "Premium Seller"
            else:
                behavior = "Above Market"
        else:
            behavior = "Passive Seller" if velocity == "Static" else "Standard Seller"

        competitors.append({
            "id": str(r.id),
            "url": r.url,
            "platform": r.platform,
            "name": r.name,
            "image_url": r.image_url,
            "is_active": r.is_active,
            "latest_price": r.latest_price,
            "last_scraped_at": r.last_scraped_at.isoformat() if r.last_scraped_at else None,
            "stock_status": r.stock_status,
            "behavior_type": behavior,
            "repricing_velocity": velocity,
        })

    return competitors


async def get_competitor_candidates(db: AsyncSession, product_id) -> list[dict]:
    """
    Returns unconfirmed (pending review) competitor listings for a product.
    Powers the 'Pending Review' section on Competitors.jsx.
    """
    result = await fetch_competitor_candidates_rows(db, product_id)
    rows = result.fetchall()
    return [
        {
            "id": str(r.id), "url": r.url, "platform": r.platform, "name": r.name,
            "image_url": r.image_url, "is_active": r.is_active,
            "discovered_by": r.discovered_by, "confirmed_by_user": r.confirmed_by_user,
            "latest_price": r.latest_price,
            "last_scraped_at": r.last_scraped_at.isoformat() if r.last_scraped_at else None,
            "stock_status": r.stock_status,
        }
        for r in rows
    ]


async def confirm_competitor(db: AsyncSession, competitor_id, user_id) -> None:
    """
    Sets confirmed_by_user=True on a CompetitorListing.
    Verifies the listing's product belongs to the requesting user.
    Raises 404 if not found or not owned.
    """
    from fastapi import HTTPException
    from sqlalchemy import update
    stmt = (
        select(CompetitorListing)
        .join(TrackedProduct, CompetitorListing.tracked_product_id == TrackedProduct.id)
        .join(UserStore, TrackedProduct.store_id == UserStore.id)
        .where(CompetitorListing.id == competitor_id)
        .where(UserStore.user_id == user_id)
    )
    result = await db.execute(stmt)
    listing = result.scalars().first()
    if listing is None:
        raise HTTPException(status_code=404, detail="Competitor listing not found")
    listing.confirmed_by_user = True
    db.add(listing)
    await db.flush()


async def reject_competitor(db: AsyncSession, competitor_id, user_id) -> None:
    """
    Sets is_active=False on an unconfirmed CompetitorListing (soft-delete / reject).
    Verifies the listing's product belongs to the requesting user.
    Raises 404 if not found or not owned.
    """
    from fastapi import HTTPException
    stmt = (
        select(CompetitorListing)
        .join(TrackedProduct, CompetitorListing.tracked_product_id == TrackedProduct.id)
        .join(UserStore, TrackedProduct.store_id == UserStore.id)
        .where(CompetitorListing.id == competitor_id)
        .where(UserStore.user_id == user_id)
    )
    result = await db.execute(stmt)
    listing = result.scalars().first()
    if listing is None:
        raise HTTPException(status_code=404, detail="Competitor listing not found")
    listing.is_active = False
    db.add(listing)
    await db.flush()


async def add_competitor_manual(
    db: AsyncSession, product_id, user_id, url: str, platform: str, name: str | None
) -> dict:
    product = await get_product_by_id(db, product_id, user_id)

    # Load store for marketplace + country
    store_result = await db.execute(
        select(UserStore).where(UserStore.id == product.store_id)
    )
    store = store_result.scalar_one_or_none()
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    try:
        parsed = validate_product_url(
            url,
            expected_marketplace=store.marketplace,
            expected_country=store.country,
        )
    except MarketplaceUrlError as exp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exp),
        ) from exp

    listing = CompetitorListing(
        tracked_product_id=product.id,
        url=url.strip(),
        platform=parsed.marketplace,  # from URL, not client
        name=name or None,
        discovered_by="manual",
        confirmed_by_user=True,
        is_active=True,
    )
    db.add(listing)
    await db.flush()
    await db.refresh(listing)
    return {
        "id": str(listing.id),
        "url": listing.url,
        "platform": listing.platform,
        "name": listing.name,
        "confirmed_by_user": listing.confirmed_by_user,
        "is_active": listing.is_active,
    }

#Dashboard KPi's
async def get_portfolio_health(db: AsyncSession, user_id, store_id=None) -> dict:
    """
    Portfolio-wide health: % of active products that are NOT
    overpriced vs their cheapest active competitor, plus a raw count
    of how many need attention.
    """
    result = await fetch_portfolio_rows(db, user_id, store_id=store_id)
    rows = result.fetchall()

    total = len(rows)
    needs_action = sum(
        1 for r in rows
        if r.own_price is not None and r.cheapest_competitor_price is not None
        and r.own_price > r.cheapest_competitor_price
    )
    health_pct = round((total - needs_action) / total * 100) if total > 0 else None

    return {
        "total_products": total,
        "needs_action": needs_action,
        "portfolio_health_pct": health_pct,
    }


async def get_active_opportunities(db: AsyncSession, user_id, store_id=None) -> Optional[int]:
    """Returns None if no stock_status data exists yet (honest gap),
    otherwise the count of products with an out-of-stock competitor."""
    result = await fetch_opportunities_rows(db, user_id, store_id=store_id)
    rows = result.fetchall()
    return len(rows)


async def get_active_price_wars(db: AsyncSession, user_id, store_id=None) -> int:
    """Count of products with 2+ distinct competitor prices in the
    last 48h. Naturally returns 0 until enough snapshot history exists."""
    result = await fetch_price_wars_rows(db, user_id, store_id=store_id)
    rows = result.fetchall()
    return len(rows)


async def get_market_movement(db: AsyncSession, user_id, store_id=None) -> Optional[dict]:
    """Returns None if either window has no data yet (can't compute a
    trend from nothing), otherwise the % change in average competitor
    price between the two windows."""
    recent, prior = await fetch_market_movement_rows(db, user_id, store_id=store_id)
    if recent is None or prior is None or recent.avg_price is None or prior.avg_price is None:
        return None
    if prior.avg_price == 0:
        return None
    raw_pct_change = (
    float((recent.avg_price - prior.avg_price) / prior.avg_price) * 100
    )

    pct_change = round(
        max(-100, min(100, raw_pct_change)),
        1
    )
    return {"pct_change": pct_change, "direction": "down" if pct_change < 0 else "up"}


async def get_product_market_movement(
    db: AsyncSession,
    user_id,
    product_id,
    store_id=None,
    timeframe: str = "3d",
) -> dict:
    """
    Returns product-specific competitor price movement over time.
    Calculates:
      - recent_avg, prior_avg
      - pct_change clamped to [-100, 100]
      - direction ("up", "down", "flat")
      - competitor_count
      - series list of { time, date, raw_time, avg_price, snapshot_count }
    """
    # Verify product ownership and store scope
    product = await get_product_by_id(db, product_id, user_id)
    if store_id is not None and str(product.store_id) != str(store_id):
        raise HTTPException(status_code=404, detail="Product not found in this store")

    valid_timeframes = ("1d", "3d", "30d")
    tf = timeframe.lower() if timeframe and timeframe.lower() in valid_timeframes else "3d"

    comp_count, series_rows, window_row = await fetch_product_market_movement_rows(
        db, user_id, product_id, store_id=store_id, timeframe=tf
    )

    series = []
    for r in series_rows:
        dt = r.bucket_time
        if tf == "1d":
            time_label = dt.strftime("%I %p").lstrip("0") if dt else ""
        else:
            time_label = dt.strftime("%b %d") if dt else ""
        date_label = dt.strftime("%b %d, %Y") if dt else ""

        series.append({
            "time": time_label,
            "date": date_label,
            "raw_time": dt.isoformat() if dt else None,
            "avg_price": round(float(r.avg_price), 2) if r.avg_price is not None else None,
            "snapshot_count": int(r.snapshot_count) if r.snapshot_count else 0,
        })

    recent_avg = float(window_row.recent_avg) if window_row and window_row.recent_avg is not None else None
    prior_avg = float(window_row.prior_avg) if window_row and window_row.prior_avg is not None else None

    # Calculate percentage change safely without zero division
    pct_change = None
    direction = None

    if recent_avg is not None and prior_avg is not None and prior_avg > 0:
        raw_pct = ((recent_avg - prior_avg) / prior_avg) * 100
        pct_change = round(max(-100.0, min(100.0, raw_pct)), 1)
        direction = "up" if pct_change > 0 else ("down" if pct_change < 0 else "flat")

    return {
        "product_id": str(product.id),
        "recent_avg": round(recent_avg, 2) if recent_avg is not None else None,
        "prior_avg": round(prior_avg, 2) if prior_avg is not None else None,
        "pct_change": pct_change,
        "direction": direction,
        "competitor_count": comp_count,
        "timeframe": tf,
        "series": series,
    }


# get attention items for dashboard
async def get_attention_items(db: AsyncSession, user_id, store_id=None) -> list[dict]:
    """
    Classifies each product into a priority level based on real data,
    and generates a human-readable explanation for the dashboard card.
    """
    result = await fetch_attention_items(db, user_id, store_id=store_id)
    rows = result.fetchall()
    items = []

    for r in rows:
        own = float(r.own_price) if r.own_price is not None else None
        cheapest = float(r.cheapest_competitor_price) if r.cheapest_competitor_price is not None else None
        oos = int(r.oos_competitors) if r.oos_competitors else 0
        num_competitors = int(r.num_competitors) if r.num_competitors else 0

        # Classify priority
        if own is None or cheapest is None:
            if num_competitors == 0:
                level = "NO_DATA"
                explanation = "No competitor data available yet for this product."
                action = "View Product"
                action_nav = "/products"
            else:
                level = "WATCH"
                explanation = f"Has {num_competitors} tracked competitor(s) but pricing data is incomplete."
                action = "Monitor"
                action_nav = "/competitors"
        elif oos > 0:
            level = "OPPORTUNITY"
            explanation = f"{oos} competitor{'s are' if oos > 1 else ' is'} out of stock. Maintain your current price to capture improved margin."
            action = "View Opportunity"
            action_nav = "/alerts"
        elif own > cheapest:
            gap = round(own - cheapest)
            pct = round((own - cheapest) / cheapest * 100, 1)
            if pct > 50:
                level = "HIGH"
                explanation = f"You are {gap:,} above the cheapest competitor ({pct}% gap). High risk of losing sales."
                action = "Review Price"
                action_nav = "/products"
            elif pct > 5:
                level = "HIGH"
                explanation = f"You are {gap:,} above the cheapest competitor. Risk of losing sales to lower-priced rivals."
                action = "Review Price"
                action_nav = "/products"
            else:
                level = "WATCH"
                explanation = f"You are only {gap:,} above the cheapest competitor ({pct}% gap). Monitor before adjusting."
                action = "Monitor"
                action_nav = "/competitors"
        else:
            level = "HEALTHY"
            explanation = "Your price is competitive or below the cheapest competitor."
            action = "View Product"
            action_nav = "/products"

        items.append({
            "id": str(r.id),
            "title": r.title,
            "own_url": r.own_url,
            "own_price": own,
            "cheapest_competitor": cheapest,
            "num_competitors": num_competitors,
            "oos_competitors": oos,
            "level": level,
            "explanation": explanation,
            "action": action,
            "action_nav": action_nav,
        })

    return items


# alerts service functions. 
async def get_alerts(db: AsyncSession, user_id, store_id=None) -> list[dict]:
    """
    Returns alerts enriched with product + competitor context,
    with human-readable title/description and category for tab filtering.
    """
    result = await fetch_alerts_rows(db, user_id, store_id=store_id)
    rows = result.fetchall()
    items = []

    for r in rows:
        alert_type = r.alert_type or "unknown"
        competitor = r.competitor_name or r.competitor_platform or "A competitor"
        prev = float(r.previous_value) if r.previous_value is not None else None
        curr = float(r.current_value) if r.current_value is not None else None
        pct = abs(float(r.change_pct)) if r.change_pct is not None else None
        curr_fmt = f"{curr:,.0f}" if curr else ""

        if alert_type in ("price_drop", "price_decrease"):
            title = "Competitor price drop"
            description = f"{competitor} dropped price by {pct}% — now {curr_fmt}." if pct and curr_fmt else f"{competitor} dropped their price."
            category = "price_drop"
            urgency = "urgent" if pct and pct >= 10 else None

        elif alert_type == "price_increase":
            title = "Competitor price increase"
            description = f"{competitor} raised price by {pct}% — now {curr_fmt}." if pct and curr_fmt else f"{competitor} raised their price."
            category = "price_drop"
            urgency = None

        elif alert_type == "stock_out":
            title = "Competitor out of stock"
            description = f"{competitor} went out of stock. Opportunity to capture sales."
            category = "stock_out"
            urgency = "opportunity"

        elif alert_type == "new_competitor":
            title = "New competitor detected"
            description = f"{competitor} is now selling this product on {r.competitor_platform or 'the marketplace'}."
            category = "new_competitor"
            urgency = None

        elif alert_type == "undercut":
            title = "You've been undercut"
            description = f"{competitor} is now selling below your price by {pct}%." if pct else f"{competitor} is now selling below your price."
            category = "undercut"
            urgency = "urgent"

        elif alert_type == "win":
            title = "You're the cheapest"
            description = "You now have the lowest price across all tracked competitors."
            category = "win"
            urgency = "winning"

        elif alert_type == "flash_sale":
            title = "Flash sale detected"
            description = f"{competitor} launched a limited-time flash deal with {pct}% discount." if pct else f"{competitor} launched a flash sale."
            category = "flash_sale"
            urgency = "urgent"

        elif alert_type == "price_war":
            title = "Price war detected"
            description = f"Multiple sellers are aggressively repricing for this product."
            category = "price_war"
            urgency = "urgent"

        else:
            title = alert_type.replace("_", " ").title()
            description = f"Alert triggered for {r.product_title[:50] if r.product_title else 'this product'}."
            category = "other"
            urgency = None

        items.append({
            "id": str(r.id),
            "alert_type": alert_type,
            "category": category,
            "title": title,
            "description": description,
            "product_id": str(r.product_id),
            "product_title": r.product_title,
            "product_url": r.product_url,
            "competitor_name": r.competitor_name,
            "competitor_platform": r.competitor_platform,
            "competitor_url": r.competitor_url,
            "previous_value": prev,
            "current_value": curr,
            "change_pct": pct,
            "is_read": r.is_read,
            "urgency": urgency,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return items


async def mark_all_alerts_read(db: AsyncSession, user_id, store_id=None) -> None:
    await mark_alerts_read_by_user(db, user_id, store_id=store_id)


async def get_price_trend(
    db: AsyncSession,
    user_id,
    store_id: Optional[uuid.UUID] = None,
    product_id: Optional[uuid.UUID] = None,
    timeframe: str = "7d",
) -> dict:
    """
    Executes fetch_price_trend_rows to retrieve real historical price points
    for Cheapest in Market, Market Average, and Your Avg Price.
    Validates ownership, clamps timeframe, structures data for Recharts,
    and derives honest trend insights from real database observations.
    """
    # 1. Product ownership validation if specific product requested
    product_own_cost = None
    if product_id is not None:
        product = await get_product_by_id(db, product_id, user_id)
        if store_id is not None and str(product.store_id) != str(store_id):
            raise HTTPException(status_code=404, detail="Product not found in this store")
        product_own_cost = float(product.own_cost) if product.own_cost is not None else None

    # 2. Timeframe validation
    valid_timeframes = ("1d", "7d", "30d")
    tf = timeframe.lower() if timeframe and timeframe.lower() in valid_timeframes else "7d"

    # 3. Execute query
    result = await fetch_price_trend_rows(
        db, user_id, store_id=store_id, product_id=product_id, timeframe=tf
    )
    rows = result.fetchall()

    # 4. Map rows to series items
    data = []
    market_avg_values = []
    your_avg_values = []

    for r in rows:
        dt = r.bucket_time
        if tf == "1d":
            time_label = dt.strftime("%I %p").lstrip("0") if dt else ""
        elif tf == "7d":
            time_label = dt.strftime("%b %d") if dt else ""
        else:  # "30d"
            time_label = dt.strftime("%b %d") if dt else ""

        date_label = dt.strftime("%b %d, %Y") if dt else ""

        c_val = float(r.cheapest) if r.cheapest is not None else None
        m_val = float(r.market_avg) if r.market_avg is not None else None
        e_val = float(r.most_expensive) if hasattr(r, "most_expensive") and r.most_expensive is not None else None
        y_val = float(r.your_avg) if r.your_avg is not None else None

        if m_val is not None:
            market_avg_values.append(m_val)
        if y_val is not None:
            your_avg_values.append(y_val)

        data.append({
            "time": time_label,
            "date": date_label,
            "raw_time": dt.isoformat() if dt else None,
            "cheapest": c_val,
            "marketAvg": m_val,
            "expensive": e_val,
            "yourAvg": y_val,
        })

    # For a specific product: align known prices across observation points
    if product_id is not None and data:
        last_c = None
        last_m = None
        last_e = None
        last_y = product_own_cost

        for pt in data:
            if pt["cheapest"] is not None:
                last_c = pt["cheapest"]
            elif last_c is not None:
                pt["cheapest"] = last_c

            if pt["marketAvg"] is not None:
                last_m = pt["marketAvg"]
            elif last_m is not None:
                pt["marketAvg"] = last_m

            if pt["expensive"] is not None:
                last_e = pt["expensive"]
            elif last_e is not None:
                pt["expensive"] = last_e

            if pt["yourAvg"] is not None:
                last_y = pt["yourAvg"]
            elif last_y is not None:
                pt["yourAvg"] = last_y

        b_c = None
        b_m = None
        b_e = None
        for pt in reversed(data):
            if pt["cheapest"] is not None:
                b_c = pt["cheapest"]
            elif b_c is not None:
                pt["cheapest"] = b_c

            if pt["marketAvg"] is not None:
                b_m = pt["marketAvg"]
            elif b_m is not None:
                pt["marketAvg"] = b_m

            if pt["expensive"] is not None:
                b_e = pt["expensive"]
            elif b_e is not None:
                pt["expensive"] = b_e

        market_avg_values = [pt["marketAvg"] for pt in data if pt["marketAvg"] is not None]
        your_avg_values = [pt["yourAvg"] for pt in data if pt["yourAvg"] is not None]

    has_data = len(data) >= 2

    # 5. Derive honest insight from real observations
    if len(data) < 2:
        if len(data) == 1:
            insight = "Only 1 historical observation recorded. At least 2 observations are needed to show a price trend."
        else:
            insight = "No historical pricing observations available for the selected period."
    else:
        # Check comparison between your price/average and market average
        if len(your_avg_values) > 0 and len(market_avg_values) > 0:
            avg_y = sum(your_avg_values) / len(your_avg_values)
            avg_m = sum(market_avg_values) / len(market_avg_values)
            if avg_m > 0:
                diff_pct = round(((avg_y - avg_m) / avg_m) * 100, 1)
                term = "Your price is" if product_id is not None else "Your prices averaged"
                if diff_pct < 0:
                    insight = f"{term} {abs(diff_pct)}% below market average across this period."
                elif diff_pct > 0:
                    insight = f"{term} {diff_pct}% above market average across this period."
                else:
                    insight = f"{term} matching market average prices across this period."
            else:
                insight = "Prices remained stable across observed intervals."
        elif len(market_avg_values) >= 2:
            first_m = market_avg_values[0]
            last_m = market_avg_values[-1]
            if first_m > 0:
                m_diff = round(((last_m - first_m) / first_m) * 100, 1)
                if m_diff < 0:
                    insight = f"Market average prices dropped {abs(m_diff)}% across this period."
                elif m_diff > 0:
                    insight = f"Market average prices increased {m_diff}% across this period."
                else:
                    insight = "Market average prices remained flat across this period."
            else:
                insight = "Market pricing observed across active intervals."
        else:
            insight = "Limited historical observations recorded for this timeframe."

    return {
        "timeframe": tf,
        "product_id": str(product_id) if product_id else "all",
        "has_data": has_data,
        "data": data,
        "insight": insight,
    }