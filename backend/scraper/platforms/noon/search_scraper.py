"""
scraper/search_scraper.py

Scrapes Noon search results using direct curl_cffi API calls.

ARCHITECTURE CHANGE FROM v1:
  v1: Patchright browser → navigate to search page → intercept API response
      One full browser page load per API page scraped.
      Memory-heavy, slow, browser overhead on every request.

  v2: curl_cffi → hit API endpoint directly with SessionManager headers
      Browser runs ONCE per session for cookie harvesting (browser.py).
      Every subsequent API call is a lightweight HTTP request.
      No browser involvement in the scraping loop at all.

WHAT DID NOT CHANGE:
  extract_product()   — field mapping from API response. Identical.
  SORT_OPTIONS        — same query parameter values.
  Deduplication logic — SKU-based across pages. Identical.
  Pagination logic    — early stop on nbPages. Identical.
  scrape_search()     — signature changes (context → session_manager)
                        but the loop logic is the same.

SILENT BLOCK DETECTION:
  noon sometimes returns HTTP 200 with an empty hits array when
  a session is flagged. We detect this specifically for keywords
  that should always return results (any real product search).
  Two consecutive empty-hit pages on the same keyword → handle_block().
  A single empty page → warning only (might be a genuine edge case).
"""

import logging
from typing import Optional
from urllib.parse import quote_plus

from curl_cffi.requests import AsyncSession

from app.config import settings
from scraper.platforms.noon.session_manager import SessionManager
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

# The direct API endpoint — what curl_cffi hits
API_SEARCH_BASE = (
    "https://www.noon.com"
    "/_vs/nc/mp-customer-catalog-api"
    "/api/v3/u/search/"
)

# The web page URL — used as referer in API request headers
# Akamai validates that XHR calls originate from real noon pages
WEB_SEARCH_BASE = "https://www.noon.com/uae-en/search/"

# Curl impersonation target — must match what bootstrap browser used
IMPERSONATE_TARGET = "chrome146"


# ─────────────────────────────────────────────────────────────────────────────
# SORT OPTIONS
# ─────────────────────────────────────────────────────────────────────────────

SORT_OPTIONS = {
    "recommended": None,               # Noon default — no sort params
    "price_asc":   {"by": "price",        "dir": "asc"},
    "price_desc":  {"by": "price",        "dir": "desc"},
    "new_arrivals":{"by": "new_arrivals", "dir": "desc"},
    "best_rated":  {"by": "best_rating",  "dir": "desc"},
}


# ─────────────────────────────────────────────────────────────────────────────
# URL BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_api_url(keyword: str, page: int, sort_by: str) -> str:
    """
    Builds the direct API URL for curl_cffi to call.

    This is the endpoint the browser's JS was intercepting in v1.
    We now call it directly.

    Example output:
      https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/search/
      ?q=iphone+15+pro+max&page=2
    """
    encoded = quote_plus(keyword)
    url     = f"{API_SEARCH_BASE}?q={encoded}&page={page}"

    sort = SORT_OPTIONS.get(sort_by)
    if sort:
        # URL-encoded brackets: sort[by] → sort%5Bby%5D
        url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"

    return url


def build_referer_url(keyword: str, page: int, sort_by: str) -> str:
    """
    Builds the web page URL to use as the Referer header.

    The search API is an XHR call initiated from the search results page.
    The Referer must be the web page URL, not the API URL itself.
    Akamai validates this. Sending the API URL as its own referer would
    be immediately flagged as non-browser behaviour.

    Example output:
      https://www.noon.com/uae-en/search/?q=iphone+15+pro+max&page=2
    """
    encoded = quote_plus(keyword)
    url     = f"{WEB_SEARCH_BASE}?q={encoded}&page={page}"

    sort = SORT_OPTIONS.get(sort_by)
    if sort:
        url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"

    return url


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCT EXTRACTOR  (unchanged from v1)
# ─────────────────────────────────────────────────────────────────────────────

def extract_product(
    hit:         dict,
    index:       int,
    page_number: int,
    keyword:     str,
) -> Optional[dict]:
    """
    Extracts and maps a single product hit from the API response.
    Uses safe casting throughout — never raises on bad API data.
    Returns None if the product is missing critical fields.

    This function is unchanged from v1. The API response format
    is identical whether we intercept it from a browser or call it
    directly. extract_product() is purely a data transformation.
    """
    try:
        # ── Core identifiers ──────────────────────────────────
        noon_sku = hit.get("sku")
        url_slug = hit.get("url")

        if not noon_sku or not url_slug:
            logger.warning(
                f"Skipping hit with missing SKU or URL: "
                f"{hit.get('name', 'unknown')}"
            )
            return None

        # ── Pricing ───────────────────────────────────────────
        sale_price_raw = safe_float(hit.get("sale_price"))
        mrp_raw        = safe_float(hit.get("price"))

        # Current price: what the buyer pays right now
        current_price  = sale_price_raw if sale_price_raw is not None else mrp_raw

        # No price at all → genuinely unusable, skip
        if current_price is None:
            logger.warning(f"Skipping product with no price: {noon_sku}")
            return None

        # Original price: only meaningful when there is a genuine discount
        # (sale_price exists AND is strictly less than MRP)
        if sale_price_raw is not None and mrp_raw is not None and mrp_raw > sale_price_raw:
            original_price = mrp_raw
        else:
            original_price = None

        # If original equals current, there is no real discount
        if original_price is not None and original_price == current_price:
            original_price = None

        # ── Stock Status ──────────────────────────────────────
        is_buyable   = hit.get("is_buyable", False)
        stock_status = "in_stock" if is_buyable else "out_of_stock"

        # ── Ratings ───────────────────────────────────────────
        product_rating = hit.get("product_rating")
        rating         = None
        review_count   = 0

        if product_rating is not None:
            rating       = safe_float(product_rating.get("value"))
            review_count = safe_int(product_rating.get("count")) or 0

        # ── Search Position ───────────────────────────────────
        # 1-based, absolute across all pages (page 2 starts at 51 etc.)
        search_position = ((page_number - 1) * 50) + index + 1

        # ── Partner ID ────────────────────────────────────────
        logo_url   = hit.get("assets", {}).get("logo", "")
        partner_id = extract_partner_id(logo_url)

        return {
            "noon_sku":        noon_sku,
            "name":            hit.get("name", "").strip(),
            "brand":           hit.get("brand", "").strip() or None,
            "url_slug":        url_slug,
            "product_url":     build_product_url(url_slug, noon_sku),
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
    session_manager: SessionManager,
    keyword:         str,
    page_number:     int,
    sort_by:         str,
    total_pages:     int,
) -> tuple[list[dict], Optional[int]]:
    """
    Scrapes a single search results page via direct API call.

    Flow:
      1. ensure_valid()     — JWT refresh or rebootstrap if needed
      2. Build URLs         — API URL to call, web URL for Referer
      3. Build headers      — full ordered header set from SessionManager
      4. curl_cffi GET      — direct API hit with Chrome TLS fingerprint
      5. Response handling  — 200/403/error cases
      6. Extract products   — parse hits array
      7. log_request()      — increment counters

    Returns:
      Tuple of (product_list, nb_pages)
      product_list : extracted product dicts, may be empty
      nb_pages     : total pages available from API, or None on error
    """
    # ── Step 1: Ensure session is valid before every request ──────────────
    await session_manager.ensure_valid()

    # ── Step 2: Build URLs ─────────────────────────────────────────────────
    api_url  = build_api_url(keyword, page_number, sort_by)
    referer  = build_referer_url(keyword, page_number, sort_by)

    logger.info(
        f"[{keyword}] Page {page_number}/{total_pages} "
        f"| sort: {sort_by} | url: {api_url}"
    )

    # ── Step 3: Get headers and proxy from session ─────────────────────────
    headers  = session_manager.get_headers(referer)
    proxy    = session_manager.get_proxy()

    # ── Step 4: Execute the API call ───────────────────────────────────────
    try:
        async with AsyncSession(impersonate=IMPERSONATE_TARGET) as curl:
            resp = await curl.get(
                api_url,
                headers=headers,
                proxy=proxy,
                timeout=30,
            )

    except Exception as exc:
        # Network-level failure (connection reset, timeout, etc.)
        # This is different from an HTTP error — log and return empty.
        # SessionManager's ensure_valid() will handle re-bootstrap on
        # next call if the session is the cause.
        logger.error(
            f"[{keyword}] Network error on page {page_number}: {exc}"
        )
        return [], None

    # ── Step 5: Handle HTTP response codes ────────────────────────────────

    if resp.status_code == 403:
        # Hard block — Akamai has explicitly rejected this session.
        # handle_block() marks proxy as cooling and triggers re-bootstrap.
        logger.warning(
            f"[{keyword}] HTTP 403 on page {page_number}. "
            f"Session blocked. Triggering handle_block()."
        )
        await session_manager.handle_block()
        return [], None

    if resp.status_code != 200:
        logger.error(
            f"[{keyword}] Unexpected HTTP {resp.status_code} "
            f"on page {page_number}."
        )
        return [], None

    # ── Step 6: Parse the JSON response ───────────────────────────────────
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

    # ── Step 7: Silent block detection ────────────────────────────────────
    # noon returns HTTP 200 with empty hits when a session is soft-blocked.
    # We distinguish "genuine no results" from "soft block" by checking
    # nbHits. Real product keywords always have nbHits > 0.
    # Single empty page → warning only. Caller tracks consecutive empties.
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

    # ── Step 8: Extract products ───────────────────────────────────────────
    products = []
    for index, hit in enumerate(hits):
        product = extract_product(hit, index, page_number, keyword)
        if product is not None:
            products.append(product)

    logger.info(
        f"[{keyword}] Page {page_number}: "
        f"{len(products)}/{len(hits)} products extracted."
    )

    # ── Step 9: Log the successful request ────────────────────────────────
    session_manager.log_request()

    return products, nb_pages


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SEARCH SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_search(
    session_manager: SessionManager,
    keyword:         str,
    pages:           int  = None,
    sort_by:         str  = "recommended",
) -> list[dict]:
    """
    Scrapes multiple pages of Noon search results for a keyword.

    Signature change from v1:
      v1: scrape_search(context: BrowserContext, keyword, pages, sort_by)
      v2: scrape_search(session_manager: SessionManager, keyword, pages, sort_by)

    Everything else is functionally identical:
      - Same deduplication by noon_sku across pages
      - Same early-stop on nb_pages
      - Same random_delay() between pages
      - Same return type: flat list of raw product dicts

    Consecutive empty page tracking:
      If two consecutive pages return zero products, we treat this as
      a soft block and call handle_block() before returning what we
      collected so far. This prevents wasting requests against a stale
      session while still returning partial data for the pipeline.

    Args:
      session_manager : The active SessionManager instance
      keyword         : Search term e.g. "iphone 15 pro max"
      pages           : Number of pages to scrape (default: PAGES_PER_KEYWORD)
      sort_by         : Key from SORT_OPTIONS

    Returns:
      Flat deduplicated list of raw product dicts for pipeline/cleaner.py
    """
    if pages is None:
        pages = settings.PAGES_PER_KEYWORD

    if sort_by not in SORT_OPTIONS:
        logger.warning(
            f"[{keyword}] Unknown sort_by '{sort_by}'. "
            f"Falling back to 'recommended'."
        )
        sort_by = "recommended"

    all_products:    list[dict] = []
    seen_skus:       set[str]   = set()
    consecutive_empty: int      = 0   # track consecutive zero-hit pages

    for page_number in range(1, pages + 1):

        products, nb_pages = await scrape_page(
            session_manager=session_manager,
            keyword=keyword,
            page_number=page_number,
            sort_by=sort_by,
            total_pages=pages,
        )

        # ── Consecutive empty page tracking ───────────────────────────────
        if not products:
            consecutive_empty += 1
            if consecutive_empty >= 2:
                # Two empty pages in a row on a real keyword = soft block
                logger.warning(
                    f"[{keyword}] Two consecutive empty pages. "
                    f"Triggering handle_block() and returning partial data."
                )
                await session_manager.handle_block()
                break
        else:
            consecutive_empty = 0   # reset on any successful page

        # ── Deduplicate across pages ──────────────────────────────────────
        # Sponsored listings appear on page 1 and again organically later.
        # Deduplication by SKU ensures we count each product once.
        for product in products:
            sku = product["noon_sku"]
            if sku in seen_skus:
                logger.debug(f"[{keyword}] Duplicate SKU skipped: {sku}")
                continue
            seen_skus.add(sku)
            all_products.append(product)

        # ── Early stop on last available page ─────────────────────────────
        if nb_pages is not None and page_number >= nb_pages:
            logger.info(
                f"[{keyword}] Reached last available page "
                f"({page_number}/{nb_pages}). Stopping early."
            )
            break

        # ── Delay between pages ───────────────────────────────────────────
        # Don't delay after the last page — no next request coming.
        if page_number < pages:
            await random_delay()

    logger.info(
        f"[{keyword}] Scrape complete. "
        f"Total unique products: {len(all_products)}."
    )

    return all_products