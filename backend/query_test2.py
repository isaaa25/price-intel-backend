import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT tps.tracked_product_id, tps.price, tps.scraped_at, tps.source
            FROM tracked_product_snapshots tps
            JOIN tracked_products tp ON tp.id = tps.tracked_product_id
            ORDER BY tps.scraped_at DESC
            LIMIT 20
        """))
        rows = result.fetchall()
        if not rows:
            print("No rows found in tracked_product_snapshots at all.")
        for r in rows:
            print(r)

asyncio.run(main())