"""
scraper/platforms/noon/search.py

Scrapes Noon search results using the persistent curl_cffi Session
owned by BrowserbaseCookieProvider.

WHAT CHANGED:
  - SessionManager → BrowserbaseCookieProvider (same public surface:
    get_session / get_headers / get_proxy / log_request / handle_block).
  - Cookie harvest is done by Browserbase on the Noon homepage; API
    calls reuse the seeded curl_cffi Session.
  - No ensure_valid() — session is assumed good until handle_block().
  - One long-lived Session so cookies (including nguestv2 via Set-Cookie)
    carry forward across pages.

WHAT DID NOT CHANGE:
  extract_product(), SORT_OPTIONS, dedup logic, pagination logic,
  consecutive-empty-page detection.
"""

import logging
from typing import Optional
from urllib.parse import quote_plus

from app.config import settings
from scraper.platforms.noon.cookies import BrowserbaseCookieProvider
from scraper.platforms.noon.utils import (
    random_delay,
    build_product_url,
    safe_float,
    safe_int,
    extract_partner_id,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

API_SEARCH_BASE = (
    "https://www.noon.com"
    "/_vs/nc/mp-customer-catalog-api"
    "/api/v3/u/search/"
)

WEB_SEARCH_BASE = "https://www.noon.com/uae-en/search/"


# ─────────────────────────────────────────────────────────────────────────────
# SORT OPTIONS
# ─────────────────────────────────────────────────────────────────────────────

SORT_OPTIONS = {
    "recommended": None,
    "price_asc":   {"by": "price",        "dir": "asc"},
    "price_desc":  {"by": "price",        "dir": "desc"},
    "new_arrivals":{"by": "new_arrivals", "dir": "desc"},
    "best_rated":  {"by": "best_rating",  "dir": "desc"},
}


# ─────────────────────────────────────────────────────────────────────────────
# URL BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_api_url(keyword: str, page: int, sort_by: str) -> str:
    encoded = quote_plus(keyword)
    url     = f"{API_SEARCH_BASE}?q={encoded}&page={page}"

    sort = SORT_OPTIONS.get(sort_by)
    if sort:
        url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"

    return url


def build_referer_url(keyword: str, page: int, sort_by: str, locale: str = "uae-en") -> str:
    encoded = quote_plus(keyword)
    clean_locale = (locale or "uae-en").strip().strip("/")
    base = f"https://www.noon.com/{clean_locale}/search/"
    url = f"{base}?q={encoded}&page={page}"

    sort = SORT_OPTIONS.get(sort_by)
    if sort:
        url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"

    return url


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCT EXTRACTOR  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def extract_product(
    hit:         dict,
    index:       int,
    page_number: int,
    keyword:     str,
    locale:      str = "uae-en",
) -> Optional[dict]:
    try:
        noon_sku = hit.get("sku")
        url_slug = hit.get("url")

        if not noon_sku or not url_slug:
            logger.warning(
                f"Skipping hit with missing SKU or URL: "
                f"{hit.get('name', 'unknown')}"
            )
            return None

        sale_price_raw = safe_float(hit.get("sale_price"))
        mrp_raw        = safe_float(hit.get("price"))
        current_price  = sale_price_raw if sale_price_raw is not None else mrp_raw

        if current_price is None:
            logger.warning(f"Skipping product with no price: {noon_sku}")
            return None

        if sale_price_raw is not None and mrp_raw is not None and mrp_raw > sale_price_raw:
            original_price = mrp_raw
        else:
            original_price = None

        if original_price is not None and original_price == current_price:
            original_price = None

        is_buyable   = hit.get("is_buyable", False)
        stock_status = "in_stock" if is_buyable else "out_of_stock"

        product_rating = hit.get("product_rating")
        rating         = None
        review_count   = 0

        if product_rating is not None:
            rating       = safe_float(product_rating.get("value"))
            review_count = safe_int(product_rating.get("count")) or 0

        search_position = ((page_number - 1) * 50) + index + 1

        logo_url   = hit.get("assets", {}).get("logo", "")
        partner_id = extract_partner_id(logo_url)

        return {
            "noon_sku":        noon_sku,
            "name":            hit.get("name", "").strip(),
            "brand":           hit.get("brand", "").strip() or None,
            "url_slug":        url_slug,
            "product_url":     build_product_url(url_slug, noon_sku, locale=locale),
            "image_url":       hit.get("image_url"),
            "store_name":      hit.get("store_name", "unknown").strip() or "unknown",
            "partner_id":      partner_id,
            "current_price":   current_price,
            "original_price":  original_price,
            "stock_status":    stock_status,
            "rating":          rating,
            "review_count":    review_count,
            "is_ad":           bool(hit.get("is_ad", False)),
            "search_position": search_position,
            "search_keyword":  keyword,
        }

    except Exception as exc:
        logger.error(
            f"Unexpected error extracting product: {exc} "
            f"| sku: {hit.get('sku', 'unknown')}"
        )
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SINGLE PAGE SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_page(
    session_manager: BrowserbaseCookieProvider,
    keyword:         str,
    page_number:     int,
    sort_by:         str,
    total_pages:     int,
    locale:          str = "uae-en",
) -> tuple[list[dict], Optional[int]]:
    """
    Scrapes a single search results page via the persistent Session.

    Flow:
      1. Build URLs
      2. Get session / headers / proxy from BrowserbaseCookieProvider
      3. GET on the persistent session (no ensure_valid() — the
         session is assumed good until handle_block() says otherwise)
      4. Response handling — 200/403/error cases
      5. Extract products
      6. log_request()
    """
    api_url = build_api_url(keyword, page_number, sort_by)
    referer = build_referer_url(keyword, page_number, sort_by, locale=locale)

    logger.info(
        f"[{keyword}] Page {page_number}/{total_pages} "
        f"| sort: {sort_by} | url: {api_url}"
    )

    session = session_manager.get_session()
    headers = session_manager.get_headers(referer)
    proxy   = session_manager.get_proxy()

    try:
        resp = await session.get(
            api_url,
            headers=headers,
            proxy=proxy,
            timeout=30,
        )
    except Exception as exc:
        logger.error(
            f"[{keyword}] Network error on page {page_number}: {exc}"
        )
        return [], None

    if resp.status_code == 403:
        logger.warning(
            f"[{keyword}] HTTP 403 on page {page_number}. "
            f"Triggering handle_block()."
        )
        await session_manager.handle_block(
            reason=f"403 on search:{keyword} page={page_number}"
        )
        return [], None

    if resp.status_code != 200:
        logger.error(
            f"[{keyword}] Unexpected HTTP {resp.status_code} "
            f"on page {page_number}."
        )
        return [], None

    try:
        data = resp.json()
    except Exception as exc:
        logger.error(
            f"[{keyword}] Failed to parse JSON on page {page_number}: {exc}"
        )
        return [], None

    nb_pages = data.get("nbPages")
    nb_hits  = data.get("nbHits", 0)
    hits     = data.get("hits", [])

    if nb_hits == 0:
        logger.warning(
            f"[{keyword}] Page {page_number} returned 200 but nbHits=0. "
            f"Possible soft block or no results for this keyword."
        )
        return [], nb_pages

    if not hits:
        logger.warning(
            f"[{keyword}] nbHits={nb_hits} but hits array empty "
            f"on page {page_number}. Unexpected API response."
        )
        return [], nb_pages

    products = []
    for index, hit in enumerate(hits):
        product = extract_product(hit, index, page_number, keyword, locale=locale)
        if product is not None:
            products.append(product)

    logger.info(
        f"[{keyword}] Page {page_number}: "
        f"{len(products)}/{len(hits)} products extracted."
    )

    session_manager.log_request()

    return products, nb_pages


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SEARCH SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_search(
    session_manager: BrowserbaseCookieProvider,
    keyword:         str,
    pages:           int  = None,
    sort_by:         str  = "recommended",
    locale:          str  = "uae-en",
) -> list[dict]:
    """
    Scrapes multiple pages of Noon search results for a keyword.
    Logic unchanged — dedup, pagination, consecutive-empty detection
    identical. Only the session provider underneath changed.
    """
    if pages is None:
        pages = settings.PAGES_PER_KEYWORD

    if sort_by not in SORT_OPTIONS:
        logger.warning(
            f"[{keyword}] Unknown sort_by '{sort_by}'. "
            f"Falling back to 'recommended'."
        )
        sort_by = "recommended"

    all_products:      list[dict] = []
    seen_skus:         set[str]   = set()
    consecutive_empty: int        = 0

    for page_number in range(1, pages + 1):

        products, nb_pages = await scrape_page(
            session_manager=session_manager,
            keyword=keyword,
            page_number=page_number,
            sort_by=sort_by,
            total_pages=pages,
            locale=locale,
        )

        if not products:
            consecutive_empty += 1
            if consecutive_empty >= 2:
                logger.warning(
                    f"[{keyword}] Two consecutive empty pages. "
                    f"Triggering handle_block() and returning partial data."
                )
                await session_manager.handle_block(
                    reason=f"two consecutive empty pages on search:{keyword}"
                )
                break
        else:
            consecutive_empty = 0

        for product in products:
            sku = product["noon_sku"]
            if sku in seen_skus:
                logger.debug(f"[{keyword}] Duplicate SKU skipped: {sku}")
                continue
            seen_skus.add(sku)
            all_products.append(product)

        if nb_pages is not None and page_number >= nb_pages:
            logger.info(
                f"[{keyword}] Reached last available page "
                f"({page_number}/{nb_pages}). Stopping early."
            )
            break

        if page_number < pages:
            await random_delay()

    logger.info(
        f"[{keyword}] Scrape complete. "
        f"Total unique products: {len(all_products)}."
    )

    return all_products