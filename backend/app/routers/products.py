"""
app/routers/products.py
"""

""" FIX: same bug as stores.py — add_product must be `async def` and must
`await` create_product, since create_product is now async (see
product_service.py). """

""" Added a option to show the product for particular store selected, store_id is added to show the product of that store not all products from all stores ( even if one store is selected)"""



from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.dependencies import get_db, get_current_user
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import (
    create_product, get_products, get_product_kpis, get_product_by_id,
    get_product_competitors, get_portfolio_health, delete_product,
    get_active_opportunities, get_active_price_wars, get_market_movement,
    get_competitor_candidates, confirm_competitor, reject_competitor, add_competitor_manual,
)


router = APIRouter()


# ── Static collection routes (must come BEFORE /{product_id} to avoid
#    FastAPI treating 'portfolio' / 'competitors' as UUID path params) ──────

@router.get("/", response_model=List[ProductResponse])
async def list_products(
    store_id: Optional[UUID] = Query(default=None, description="Filter products by store ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_products(db, current_user.id, store_id=store_id)


@router.post("/", response_model=ProductResponse)
async def add_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await create_product(db, current_user.id, product)


# ── Portfolio sub-routes — static paths, registered first ─────────────────

@router.get("/portfolio/health")
async def portfolio_health(
    store_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_portfolio_health(db, current_user.id, store_id=store_id)


@router.get("/portfolio/opportunities")
async def portfolio_opportunities(
    store_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return {"active_opportunities": await get_active_opportunities(db, current_user.id, store_id=store_id)}


@router.get("/portfolio/price-wars")
async def portfolio_price_wars(
    store_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return {"active_price_wars": await get_active_price_wars(db, current_user.id, store_id=store_id)}


@router.get("/portfolio/market-movement")
async def portfolio_market_movement(
    store_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await get_market_movement(db, current_user.id, store_id=store_id)
    return result if result is not None else {"pct_change": None, "direction": None}


# ── Competitor PATCH routes — /competitors/{id}/... are static-prefixed ───
#    These live under /products/competitors/{id}/... (not under a product_id)

class ManualCompetitorPayload(BaseModel):
    url: str
    platform: str = "unknown"
    name: str | None = None


@router.patch("/competitors/{competitor_id}/confirm", status_code=204)
async def confirm_competitor_route(
    competitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    await confirm_competitor(db, competitor_id, current_user.id)
    return None


@router.patch("/competitors/{competitor_id}/reject", status_code=204)
async def reject_competitor_route(
    competitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    await reject_competitor(db, competitor_id, current_user.id)
    return None


# ── Per-product routes — parameterised, registered AFTER static prefixes ──

@router.get("/{product_id}/kpis")
async def product_kpis(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_product_kpis(db, product_id)


@router.get("/{product_id}/competitors/candidates")
async def list_competitor_candidates(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_competitor_candidates(db, product_id)


@router.get("/{product_id}/competitors")
async def list_competitors(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_product_competitors(db, product_id)


@router.post("/{product_id}/competitors/manual", status_code=201)
async def add_manual_competitor(
    product_id: UUID,
    payload: ManualCompetitorPayload,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await add_competitor_manual(
        db, product_id, current_user.id,
        payload.url, payload.platform, payload.name
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_product_by_id(db, product_id, current_user.id)


@router.delete("/{product_id}", status_code=204)
async def remove_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    await delete_product(db, product_id, current_user.id)
    return None