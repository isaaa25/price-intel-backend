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
2. DASHBOARD PAGE       — portfolio health, needs action, active opportunities, active price wars, market movement
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
    scraped price, stock status and timestamp.
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
             ORDER BY ps.scraped_at DESC LIMIT 1) AS last_scraped_at,
            (SELECT ps.stock_status FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS stock_status
        FROM competitor_listings cl
        WHERE cl.tracked_product_id = :pid AND cl.is_active = true
        ORDER BY latest_price ASC NULLS LAST
    """), {"pid": str(product_id)})


async def fetch_competitor_candidates_rows(db: AsyncSession, product_id):
    """
    All UNCONFIRMED (confirmed_by_user=False) active competitor listings
    for one product. These are discovered-by-scraper candidates waiting
    for the user to Accept or Reject.
    Used by: get_competitor_candidates() in services/product_service.py
    Powers: Competitors.jsx "Pending Review" section
    """
    return await db.execute(text("""
        SELECT
            cl.id, cl.url, cl.platform, cl.name, cl.image_url,
            cl.is_active, cl.discovered_by, cl.confirmed_by_user,
            (SELECT ps.price FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS latest_price,
            (SELECT ps.scraped_at FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS last_scraped_at,
            (SELECT ps.stock_status FROM price_snapshots ps
             WHERE ps.competitor_listing_id = cl.id
             ORDER BY ps.scraped_at DESC LIMIT 1) AS stock_status
        FROM competitor_listings cl
        WHERE cl.tracked_product_id = :pid
          AND cl.confirmed_by_user = false
          AND cl.is_active = true
        ORDER BY cl.created_at DESC
    """), {"pid": str(product_id)})


# ══════════════════════════════════════════════════════════════
# 2. DASHBOARD PAGE
# ══════════════════════════════════════════════════════════════
# Powers: Dashboard.jsx "Portfolio Health" and "Needs Action" cards
# Powers: Dashboard.jsx "Active Opportunities", "Active Price Wars",
# "Market Movement" cards. All three return None/empty gracefully
# when there isn't enough data yet — they will start returning real
# numbers automatically once scraping builds up history, with no
# code changes needed.

async def fetch_portfolio_rows(db: AsyncSession, user_id, store_id=None):
    """
    Own price (snapshot-first, own_cost fallback) + cheapest active
    competitor price, for every active product in a user's store(s).
    Used by: get_portfolio_health() in services/product_service.py
    Powers: Dashboard.jsx "Portfolio Health" and "Needs Action" cards
    """
    store_filter = ""
    params = {"uid": str(user_id)}
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    return await db.execute(text(f"""
        SELECT
            tp.id,
            COALESCE(
                (SELECT tps.price FROM tracked_product_snapshots tps
                 WHERE tps.tracked_product_id = tp.id
                 ORDER BY tps.scraped_at DESC LIMIT 1),
                tp.own_cost
            ) AS own_price,
            (SELECT MIN(ps.price) FROM price_snapshots ps
             JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
             WHERE cl.tracked_product_id = tp.id AND cl.is_active = true) AS cheapest_competitor_price
        FROM tracked_products tp
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid
          AND tp.is_active = true
          {store_filter}
    """), params)


async def fetch_opportunities_rows(db: AsyncSession, user_id, store_id=None):
    """
    Products where at least one active competitor's LATEST snapshot
    shows them out of stock — an opportunity to capture the sale or
    raise price without losing competitiveness.
    Used by: get_active_opportunities() in services/product_service.py
    """
    store_filter = ""
    params = {"uid": str(user_id)}
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    return await db.execute(text(f"""
        SELECT DISTINCT tp.id
        FROM tracked_products tp
        JOIN user_stores us ON us.id = tp.store_id
        JOIN competitor_listings cl ON cl.tracked_product_id = tp.id AND cl.is_active = true
        WHERE us.user_id = :uid
          AND tp.is_active = true
          {store_filter}
          AND (
            SELECT ps.stock_status FROM price_snapshots ps
            WHERE ps.competitor_listing_id = cl.id
            ORDER BY ps.scraped_at DESC LIMIT 1
          ) IN ('out_of_stock', 'unavailable', 'sold_out')
    """), params)


async def fetch_price_wars_rows(db: AsyncSession, user_id, store_id=None):
    """
    Products where a competitor's price changed more than once in the
    last 48 hours — signals aggressive repricing activity ("a price
    war"). Needs at least 2 snapshots per competitor within the
    window to detect any change at all.
    Used by: get_active_price_wars() in services/product_service.py
    """
    store_filter = ""
    params = {"uid": str(user_id)}
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    return await db.execute(text(f"""
        SELECT tp.id, COUNT(DISTINCT ps.price) AS distinct_prices_48h
        FROM tracked_products tp
        JOIN user_stores us ON us.id = tp.store_id
        JOIN competitor_listings cl ON cl.tracked_product_id = tp.id AND cl.is_active = true
        JOIN price_snapshots ps ON ps.competitor_listing_id = cl.id
        WHERE us.user_id = :uid
          AND tp.is_active = true
          {store_filter}
          AND ps.scraped_at >= NOW() - INTERVAL '48 hours'
        GROUP BY tp.id
        HAVING COUNT(DISTINCT ps.price) >= 2
    """), params)


async def fetch_market_movement_rows(db: AsyncSession, user_id, store_id=None, hours_window: int = 24):
    """
    Average competitor price in the last N hours vs the N hours
    before that, across a user's whole catalog.
    Used by: get_market_movement() in services/product_service.py
    """
    store_filter = ""
    params = {"uid": str(user_id), "hours": hours_window}
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    recent = await db.execute(text(f"""
        SELECT AVG(ps.price) AS avg_price
        FROM price_snapshots ps
        JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
        JOIN tracked_products tp ON tp.id = cl.tracked_product_id
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid AND tp.is_active = true {store_filter}
          AND ps.scraped_at >= NOW() - make_interval(hours => :hours)
    """), params)

    prior = await db.execute(text(f"""
        SELECT AVG(ps.price) AS avg_price
        FROM price_snapshots ps
        JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
        JOIN tracked_products tp ON tp.id = cl.tracked_product_id
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid AND tp.is_active = true {store_filter}
          AND ps.scraped_at >= NOW() - make_interval(hours => :hours * 2)
          AND ps.scraped_at < NOW() - make_interval(hours => :hours)
    """), params)

    return recent.fetchone(), prior.fetchone()


async def fetch_product_market_movement_rows(
    db: AsyncSession,
    user_id,
    product_id,
    store_id=None,
    timeframe: str = "3d",
):
    """
    Product-specific competitor price movement over time.
    Calculates:
      1. Active competitor count for this product.
      2. Time-bucketed series of average competitor prices within the active window.
      3. Window averages (recent vs prior) for period-over-period percentage change calculation.
    Scoped strictly to the user's store and the selected product's active competitors.
    Used by: get_product_market_movement() in services/product_service.py
    """
    store_filter = ""
    params = {
        "uid": str(user_id),
        "pid": str(product_id),
    }
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    if timeframe == "1d":
        recent_clause = "ps.scraped_at >= NOW() - INTERVAL '24 hours'"
        prior_clause = "ps.scraped_at >= NOW() - INTERVAL '48 hours' AND ps.scraped_at < NOW() - INTERVAL '24 hours'"
        interval_sql = "INTERVAL '24 hours'"
        bucket_trunc = "hour"
    elif timeframe == "30d":
        recent_clause = "ps.scraped_at >= DATE_TRUNC('day', NOW()) - INTERVAL '29 days'"
        prior_clause = "ps.scraped_at >= DATE_TRUNC('day', NOW()) - INTERVAL '59 days' AND ps.scraped_at < DATE_TRUNC('day', NOW()) - INTERVAL '29 days'"
        interval_sql = "INTERVAL '30 days'"
        bucket_trunc = "day"
    else:  # default '3d'
        recent_clause = "ps.scraped_at >= DATE_TRUNC('day', NOW()) - INTERVAL '2 days'"
        prior_clause = "ps.scraped_at >= DATE_TRUNC('day', NOW()) - INTERVAL '5 days' AND ps.scraped_at < DATE_TRUNC('day', NOW()) - INTERVAL '2 days'"
        interval_sql = "INTERVAL '3 days'"
        bucket_trunc = "day"

    # 1. Count active competitor listings for this product
    comp_res = await db.execute(text(f"""
        SELECT COUNT(cl.id) AS competitor_count
        FROM competitor_listings cl
        JOIN tracked_products tp ON tp.id = cl.tracked_product_id
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid
          AND tp.id = :pid
          AND tp.is_active = true
          AND cl.is_active = true
          {store_filter}
    """), params)
    competitor_count = comp_res.scalar() or 0

    # 2. Aggregated time series buckets
    series_res = await db.execute(text(f"""
        SELECT 
            DATE_TRUNC('{bucket_trunc}', ps.scraped_at) AS bucket_time,
            ROUND(AVG(ps.price)::numeric, 2) AS avg_price,
            COUNT(ps.id) AS snapshot_count
        FROM price_snapshots ps
        JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
        JOIN tracked_products tp ON tp.id = cl.tracked_product_id
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid
          AND tp.id = :pid
          AND tp.is_active = true
          AND cl.is_active = true
          {store_filter}
          AND ps.price IS NOT NULL
          AND ps.price > 0
          AND ps.scraped_at >= NOW() - {interval_sql}
        GROUP BY 1
        ORDER BY 1 ASC
    """), params)
    series_rows = series_res.fetchall()

    # 3. Window comparison for percentage change
    window_res = await db.execute(text(f"""
        SELECT 
            AVG(CASE WHEN {recent_clause} THEN ps.price END) AS recent_avg,
            AVG(CASE WHEN {prior_clause} THEN ps.price END) AS prior_avg
        FROM price_snapshots ps
        JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
        JOIN tracked_products tp ON tp.id = cl.tracked_product_id
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid
          AND tp.id = :pid
          AND tp.is_active = true
          AND cl.is_active = true
          {store_filter}
          AND ps.price IS NOT NULL
          AND ps.price > 0
    """), params)
    window_row = window_res.fetchone()

    return competitor_count, series_rows, window_row


#needs attention
async def fetch_attention_items(db: AsyncSession, user_id, store_id=None):
    """
    Per-product actionable signals for the "What Needs Your Attention"
    dashboard section. Returns one row per active product with enough
    data to classify it as: overpriced, opportunity (competitor OOS),
    watch (small gap), or no data.
    Used by: get_attention_items() in services/product_service.py
    Powers: Dashboard.jsx "What Needs Your Attention" section
    """
    store_filter = ""
    params = {"uid": str(user_id)}
    if store_id is not None:
        store_filter = "AND tp.store_id = :sid"
        params["sid"] = str(store_id)

    return await db.execute(text(f"""
        SELECT
            tp.id,
            tp.title,
            tp.own_url,
            COALESCE(
                (SELECT tps.price FROM tracked_product_snapshots tps
                 WHERE tps.tracked_product_id = tp.id
                 ORDER BY tps.scraped_at DESC LIMIT 1),
                tp.own_cost
            ) AS own_price,
            (SELECT MIN(ps.price)
             FROM price_snapshots ps
             JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
             WHERE cl.tracked_product_id = tp.id AND cl.is_active = true
            ) AS cheapest_competitor_price,
            (SELECT COUNT(DISTINCT cl.id)
             FROM competitor_listings cl
             WHERE cl.tracked_product_id = tp.id AND cl.is_active = true
            ) AS num_competitors,
            (SELECT COUNT(*)
             FROM price_snapshots ps
             JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
             WHERE cl.tracked_product_id = tp.id
               AND ps.stock_status IN ('out_of_stock', 'unavailable', 'sold_out')
               AND ps.scraped_at = (
                   SELECT MAX(ps2.scraped_at)
                   FROM price_snapshots ps2
                   WHERE ps2.competitor_listing_id = ps.competitor_listing_id
               )
            ) AS oos_competitors
        FROM tracked_products tp
        JOIN user_stores us ON us.id = tp.store_id
        WHERE us.user_id = :uid
          AND tp.is_active = true
          {store_filter}
        ORDER BY
            CASE
                WHEN own_cost IS NULL THEN 99
                WHEN (SELECT MIN(ps.price) FROM price_snapshots ps
                      JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
                      WHERE cl.tracked_product_id = tp.id AND cl.is_active = true) IS NULL THEN 50
                ELSE 1
            END ASC,
            (COALESCE(
                (SELECT tps.price FROM tracked_product_snapshots tps
                 WHERE tps.tracked_product_id = tp.id
                 ORDER BY tps.scraped_at DESC LIMIT 1),
                tp.own_cost
            ) - (SELECT MIN(ps.price) FROM price_snapshots ps
                 JOIN competitor_listings cl ON cl.id = ps.competitor_listing_id
                 WHERE cl.tracked_product_id = tp.id AND cl.is_active = true)) DESC NULLS LAST
        LIMIT 6
    """), params)