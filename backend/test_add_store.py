import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import engine, AsyncSessionLocal
from app.models.user_store import UserStore

async def test_insert():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            store = UserStore(
                user_id=uuid.uuid4(),
                marketplace="daraz",
                country="Pakistan",
                store_name="samsung flagship store",
                store_slug=None,
                external_store_id=None,
                store_url="https://www.daraz.pk/products/samsung-galaxy-a07-4gb64gb-pta-approved-one-year-official-warranty-67-inch-display-13mp-dual-rear-camera-i494793616-s2320743122.html?spm=a2a0e.searchlist.list.0&search=1&w=440&sale=9895&search=1&source=search&spm=a2a0e.searchlist.list.0&stock=1"
            )
            session.add(store)
            try:
                await session.flush()
                print("Insert succeeded with URL length:", len(store.store_url))
            except Exception as e:
                print("Insert failed!")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_insert())
