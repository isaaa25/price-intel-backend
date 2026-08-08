"""
app/services/store_service.py

FIX vs. previous version: rewritten for AsyncSession. get_db() yields
an async session (per database.py's async engine setup), so every
call here must be awaited, and the sync-only Query API (db.query(...))
is replaced with SQLAlchemy's async-compatible select()/execute()
pattern — the same pattern already used correctly in
app/dependencies.py's get_current_user.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user_store import UserStore


async def create_store(db: AsyncSession, user_id, store_data) -> UserStore:
    """
    Creates a new UserStore row for the given user.

    Does not attempt to enforce the (marketplace, country, store_name)-
    style uniqueness some of your other tables use — user_stores'
    actual unique constraint is (marketplace, external_store_id) per
    uq_user_store, which is DB-enforced already. A duplicate insert
    attempt will raise an IntegrityError from the DB layer; catching
    and translating that into a clean 409 is a reasonable next step
    but not done here yet to keep this function's first version small.
    """
    store = UserStore(
        user_id=user_id,
        marketplace=store_data.marketplace,
        country=store_data.country,
        store_name=store_data.store_name,
        store_slug=store_data.store_slug,
        external_store_id=store_data.external_store_id,
        store_url=store_data.store_url,
    )
    db.add(store)
    await db.flush()
    await db.refresh(store)
    return store


async def get_store_or_404(db: AsyncSession, store_id, user_id) -> UserStore:
    """
    Fetches a UserStore by id, scoped to the requesting user — used by
    product_service.create_product to validate store_id before
    creating a TrackedProduct under it.

    Scoping by user_id here (not just store_id) matters: without it,
    any authenticated user could create a tracked product under
    another user's store by guessing/enumerating a UUID. Raises 404
    rather than 403 for a store that exists but belongs to someone
    else, so as not to leak which store IDs are valid.
    """
    result = await db.execute(
        select(UserStore).where(
            UserStore.id == store_id,
            UserStore.user_id == user_id,
        )
    )
    store = result.scalar_one_or_none()

    if store is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found for this user.",
        )
    if not store.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This store is not active.",
        )
    return store


async def get_stores(db: AsyncSession, user_id) -> list[UserStore]:
    """
    Returns all UserStore rows that belong to the requesting user.
    Ordered by creation date descending (newest first).
    """
    result = await db.execute(
        select(UserStore)
        .where(UserStore.user_id == user_id)
        .order_by(UserStore.created_at.desc())
    )
    return list(result.scalars().all())