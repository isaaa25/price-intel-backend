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

from app.dependencies import get_db, get_current_user
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import create_product, get_products, get_product_kpis, get_product_by_id, get_product_competitors, get_portfolio_health, delete_product


router = APIRouter()


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

@router.get("/{product_id}/kpis")
async def product_kpis(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_product_kpis(db, product_id)


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


@router.get("/{product_id}/competitors")
async def list_competitors(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_product_competitors(db, product_id)


@router.get("/portfolio/health")
async def portfolio_health(
    store_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_portfolio_health(db, current_user.id, store_id=store_id)
