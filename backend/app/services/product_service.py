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
from app.queries import fetch_product_kpi_row, fetch_product_competitors_rows # import added for queries from queries.py file. 

from app.models.tracked_product import TrackedProduct
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
