import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("""
                SELECT ps.price, cl.tracked_product_id
                FROM price_snapshots ps
                JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
                WHERE cl.tracked_product_id = :pid AND cl.is_active = true
                ORDER BY ps.price ASC
            """),
            {"pid": "e267acd8-8a30-4c88-a6c2-972241b5d2d9"}
        )
        rows = result.fetchall()
        for r in rows:
            print(r)

asyncio.run(main())