import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT
                tp.title,
                COUNT(cl.id) AS num_competitors,
                ROUND(AVG(cl.volatility_score)::numeric, 4) AS avg_volatility,
                MIN(cl.volatility_score) AS min_volatility,
                MAX(cl.volatility_score) AS max_volatility,
                COALESCE(tp.own_cost, 0) AS own_price,
                (SELECT MIN(ps.price) FROM price_snapshots ps
                 JOIN competitor_listings cl2 ON cl2.id = ps.competitor_listing_id
                 WHERE cl2.tracked_product_id = tp.id AND cl2.is_active = true) AS cheapest
            FROM tracked_products tp
            JOIN user_stores us ON us.id = tp.store_id
            LEFT JOIN competitor_listings cl ON cl.tracked_product_id = tp.id AND cl.is_active = true
            WHERE tp.is_active = true
            GROUP BY tp.id, tp.title, tp.own_cost
            ORDER BY avg_volatility DESC NULLS LAST
        """))
        rows = result.fetchall()
        if not rows:
            print("No rows.")
        for r in rows:
            print(f"title={r.title[:35]!r}, competitors={r.num_competitors}, avg_vol={r.avg_volatility}, min={r.min_volatility}, max={r.max_volatility}, own={r.own_price}, cheapest={r.cheapest}")

asyncio.run(main())