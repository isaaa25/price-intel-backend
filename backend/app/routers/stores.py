"""
app/routers/stores.py

FIX: add_store must be `async def` and must `await` create_store —
create_store is now an async function (see store_service.py). Calling
an async function from a sync def route just returns an unawaited
coroutine object, which is exactly what FastAPI's response serializer
choked on.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.schemas.store import StoreCreate, StoreResponse
from app.services.store_service import create_store, get_stores

router = APIRouter()


@router.get("/", response_model=List[StoreResponse])
async def list_stores(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await get_stores(db, current_user.id)


@router.post("/", response_model=StoreResponse)
async def add_store(
    store: StoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await create_store(db, current_user.id, store)