"""
app/queries.py

CENTRAL QUERY FILE — every raw SQL query used across the app lives
here, organized by page/feature section below. This is the ONLY file
you need to open to add or change a query.

Rule: this file contains ONLY database fetch functions (SQL +
execute). Business logic (fallback decisions, calculations,
validation) stays in services/*.py, which imports from here.

──────────────────────────────────────────────────────────────────
TABLE OF CONTENTS
──────────────────────────────────────────────────────────────────
1. PRODUCTS PAGE       — product KPIs, competitor listings
   (future sections: DASHBOARD PAGE, COMPETITORS PAGE, ALERTS PAGE,
   etc. — add a new numbered section below as each page gets built)
──────────────────────────────────────────────────────────────────
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ══════════════════════════════════════════════════════════════
# 1. PRODUCTS PAGE
# ══════════════════════════════════════════════════════════════
# Powers: Products.jsx (list + KPI columns), ProductDetail.jsx
# (My Price / Cheapest Competitor / Competitor Listings table)

async def fetch_product_kpi_row(db: AsyncSession, product_id):
    """
    Own price (snapshot-first, own_cost fallback) vs cheapest active
    competitor, for ONE product.
    Used by: get_product_kpis() in services/product_service.py
    Powers: Products.jsx table columns, ProductDetail.jsx KPI cards
    """
    return await db.execute(text("""
        SELECT
            tp.id, tp.own_cost,
            (SELECT tps.price FROM tracked_product_snapshots tps
             WHERE tps.tracked_product_id = tp.id
             ORDER BY tps.scraped_at DESC LIMIT 1) AS latest_snapshot_price,
            (SELECT MIN(ps.price) FROM price_snapshots ps
             JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
             WHERE cl.tracked_product_id = tp.id AND cl.is_active = true) AS cheapest_competitor_price,
            (SELECT COUNT(DISTINCT cl.id) FROM competitor_listings cl
             WHERE cl.tracked_product_id = tp.id AND cl.is_active = true) AS num_competitors
        FROM tracked_products tp
        WHERE tp.id = :pid
    """), {"pid": str(product_id)})


async def fetch_product_competitors_rows(db: AsyncSession, product_id):
    """
    All active competitor listings for one product, with latest
    scraped price and timestamp.
    Used by: get_product_competitors() in services/product_service.py
    Powers: ProductDetail.jsx "Competitor Listings" table,
            Competitors.jsx (fetched per-product across the page)
    """
    return await db.execute(text("""
        SELECT
            cl.id, cl.url, cl.platform, cl.name, cl.image_url,
            cl.is_active, cl.last_seen_at,
            (SELECT ps.price FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS latest_price,
            (SELECT ps.scraped_at FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS last_scraped_at
        FROM competitor_listings cl
        WHERE cl.tracked_product_id = :pid AND cl.is_active = true
        ORDER BY latest_price ASC NULLS LAST
    """), {"pid": str(product_id)})