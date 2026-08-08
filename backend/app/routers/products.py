"""
app/routers/products.py

FIX: same bug as stores.py — add_product must be `async def` and must
`await` create_product, since create_product is now async (see
product_service.py).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from typing import List

from app.dependencies import get_db, get_current_user
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import create_product, get_products

router = APIRouter()


@router.get("/", response_model=List[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_products(db, current_user.id)


@router.post("/", response_model=ProductResponse)
async def add_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await create_product(db, current_user.id, product)