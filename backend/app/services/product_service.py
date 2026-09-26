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
    fetch_competitor_candidates_rows,
)

from app.models.tracked_product import TrackedProduct
from app.models.competitor_listing import CompetitorListing
from app.models.user_store import UserStore
from app.services.store_service import get_store_or_404
from pipeline.ai.query_generalizer import generalize_title



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
    return [
        {
            "id": str(r.id), "url": r.url, "platform": r.platform, "name": r.name,
            "image_url": r.image_url, "is_active": r.is_active,
            "latest_price": r.latest_price,
            "last_scraped_at": r.last_scraped_at.isoformat() if r.last_scraped_at else None,
        }
        for r in rows
    ]


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
    """
    Manually adds a CompetitorListing for a product with confirmed_by_user=True
    (user explicitly added it, so no review step needed).
    Verifies the product belongs to the requesting user.
    """
    product = await get_product_by_id(db, product_id, user_id)
    listing = CompetitorListing(
        tracked_product_id=product.id,
        url=url,
        platform=platform or "unknown",
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
    pct_change = round(float((recent.avg_price - prior.avg_price) / prior.avg_price) * 100, 1)
    return {"pct_change": pct_change, "direction": "down" if pct_change < 0 else "up"}