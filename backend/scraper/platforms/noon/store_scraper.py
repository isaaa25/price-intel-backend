
# """
# scraper/store_scraper.py

# Scrapes a seller's full store catalogue using direct curl_cffi API calls.

# ARCHITECTURE CHANGE FROM v1:
#   v1: Patchright browser → navigate to store page → intercept API response
#   v2: curl_cffi → hit store API endpoint directly with SessionManager headers

# PURPOSE IN THE SYSTEM:
#   search_scraper discovers which sellers exist and their prices for a keyword.
#   store_scraper goes deeper — it scrapes EVERY product a specific seller lists.

#   This gives the client a complete competitive picture:
#     - "Competitor X has 340 products total, here are all their prices"
#     - "Competitor Y just listed a new product we weren't tracking"
#     - "Competitor Z dropped prices across their whole iPhone range"

#   The client's OWN store is also scraped this way — giving a full
#   inventory snapshot that the dashboard uses for self-vs-market comparison.

# PAGE LIMIT STRATEGY:
#   noon stores range from 10 to 10,000+ products.
#   We use nbHits from page 1 to decide how many pages to scrape:
#     - Small store (≤ STORE_SMALL_THRESHOLD products) → scrape all pages
#     - Large store (> threshold) → cap at STORE_PAGES_LARGE pages
#   This prevents runaway scraping on massive stores while ensuring
#   small competitor stores are fully captured.

# ⚠️  IMPORTANT — VERIFY STORE API URL:
#   The API_STORE_BASE constant below needs verification.
#   Visit any noon store page in your browser with DevTools open.
#   Filter Network by XHR. Look for the call to mp-customer-catalog-api.
#   Copy the base URL and update API_STORE_BASE accordingly.
#   The URL should look like one of:
#     https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/catalog/
#     https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/seller/
# """

# import logging
# import math
# import re
# from typing import Optional
# from urllib.parse import quote_plus

# from curl_cffi.requests import AsyncSession

# from app.config import settings
# from scraper.platforms.noon.session_manager import SessionManager
# from scraper.platforms.noon.utils import (
#     random_delay,
#     build_product_url,
#     safe_float,
#     safe_int,
#     extract_partner_id,
# )

# logger = logging.getLogger(__name__)


# # ─────────────────────────────────────────────────────────────────────────────
# # CONSTANTS
# # ─────────────────────────────────────────────────────────────────────────────

# # ⚠️  VERIFY THIS URL before running store scrapes.
# # Check your browser DevTools Network tab on any noon store page.
# # Look for the XHR call to mp-customer-catalog-api and copy the base path.
# API_STORE_BASE = (
#     "https://www.noon.com"
#     "/_vs/nc/mp-customer-catalog-api"
#     "/api/v3/u/"
# )

# # Web-facing store URL — used as Referer header in API calls
# WEB_STORE_BASE = "https://www.noon.com/uae-en"

# IMPERSONATE_TARGET = "chrome146"

# SORT_OPTIONS = {
#     "recommended": None,
#     "price_asc":   {"by": "price",        "dir": "asc"},
#     "price_desc":  {"by": "price",        "dir": "desc"},
#     "new_arrivals":{"by": "new_arrivals", "dir": "desc"},
#     "best_rated":  {"by": "best_rating",  "dir": "desc"},
# }


# # ─────────────────────────────────────────────────────────────────────────────
# # URL BUILDERS
# # ─────────────────────────────────────────────────────────────────────────────

# def build_store_api_url(partner_id: str, page: int, sort_by: str) -> str:
#     """
#     Builds the direct API URL for the store catalogue.
    
#     """
#     url = f"{API_STORE_BASE}{partner_id}/?page={page}"
#     sort = SORT_OPTIONS.get(sort_by)
#     if sort:
#         url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"
#     return url


# def build_store_referer_url(partner_id: str, page: int) -> str:
#     """
#     Builds the web-facing store URL to use as the Referer header.

#     The store API is an XHR originating from the store web page.
#     Referer must be the web page URL, not the API URL itself.

#     Example:
#       https://www.noon.com/uae-en/p-49644/?page=2
#     """
#     return f"{WEB_STORE_BASE}/{partner_id}/?page={page}"


# def _decide_max_pages(nb_hits: int, sort_by: str) -> int:
#     """
#     Decides how many pages to scrape based on the store's total product count.

#     Called after page 1 reveals nb_hits.

#     Logic:
#       Small store (≤ STORE_SMALL_THRESHOLD products):
#         Scrape ALL pages — we want complete coverage of small competitors.
#         50 products/page → ceil(nb_hits / 50) pages.

#       Large store (> threshold):
#         Cap at STORE_PAGES_LARGE — prevents hour-long scrapes on giant stores.
#         For a store with 2,000 products, we capture the top N pages
#         (sorted by recommended = best sellers first by default).

#     50 products per noon API page is consistent across all observed calls.
#     """
#     products_per_page = 50
#     actual_pages      = math.ceil(nb_hits / products_per_page)

#     if nb_hits <= settings.STORE_SMALL_THRESHOLD:
#         logger.debug(
#             f"Small store ({nb_hits} products) → scraping all {actual_pages} pages."
#         )
#         return actual_pages

#     logger.debug(
#         f"Large store ({nb_hits} products) → "
#         f"capping at {settings.STORE_PAGES_LARGE} pages."
#     )
#     return min(actual_pages, settings.STORE_PAGES_LARGE)


# # ─────────────────────────────────────────────────────────────────────────────
# # KEYWORD RELEVANCE FILTER (unchanged from v1)
# # ─────────────────────────────────────────────────────────────────────────────

# def is_relevant(product_name: str, keywords: list[str]) -> bool:
#     """
#     Checks whether a product is relevant to any of the tracked keywords.
#     Uses word boundary matching to prevent partial-word false positives.

#     Examples:
#       keyword "phone"     → matches "phone case"    ✓
#       keyword "phone"     → no match "headphones"   ✓ (boundary prevents this)
#       keyword "iphone 15" → matches "iPhone 15 Pro Max 256GB" ✓

#     Returns True if any keyword matches. False if none match.
#     If keywords list is empty, returns True (no filter = keep everything).
#     """
#     if not product_name:
#         return False

#     if not keywords:
#         return True    # no filter configured → keep all products

#     name_lower = product_name.lower()

#     return any(
#         re.search(rf"\b{re.escape(kw.lower())}\b", name_lower)
#         for kw in keywords
#     )


# # ─────────────────────────────────────────────────────────────────────────────
# # PRODUCT EXTRACTOR
# # ─────────────────────────────────────────────────────────────────────────────

# def extract_product_from_store(
#     hit:         dict,
#     index:       int,
#     page_number: int,
#     partner_id:  str,
# ) -> Optional[dict]:
#     """
#     Extracts and maps a single product hit from the store API response.

#     Differs from search extract_product in three ways:
#       1. No search_keyword — products come from store browsing, not a search
#       2. No search_position — position in a store page isn't meaningful
#       3. source = "store" — loader uses this to route correctly

#     Pricing fix applied (same as search_scraper):
#       sale_price is null for non-discounted products.
#       Fall back to price field so we never skip valid products.
#     """
#     try:
#         # ── Core identifiers ──────────────────────────────────────────────
#         noon_sku = hit.get("sku")
#         url_slug = hit.get("url")

#         if not noon_sku or not url_slug:
#             logger.warning(
#                 f"[Store:{partner_id}] Skipping hit — missing SKU or URL: "
#                 f"{hit.get('name', 'unknown')}"
#             )
#             return None

#         # ── Pricing (with sale_price → price fallback) ────────────────────
#         # noon API:
#         #   sale_price = current selling price (null when no active discount)
#         #   price      = original MRP / list price (almost always present)
#         #
#         # We use sale_price when available (product is on discount).
#         # Fall back to price when sale_price is null (no discount = use MRP).
#         # Only skip if BOTH are null (product genuinely has no price).
#         sale_price_raw = safe_float(hit.get("sale_price"))
#         mrp_raw        = safe_float(hit.get("price"))

#         current_price  = sale_price_raw if sale_price_raw is not None else mrp_raw

#         if current_price is None:
#             logger.warning(
#                 f"[Store:{partner_id}] Skipping product — no price: {noon_sku}"
#             )
#             return None

#         # Original price shown only when there's a genuine discount
#         if (
#             sale_price_raw is not None
#             and mrp_raw is not None
#             and mrp_raw > sale_price_raw
#         ):
#             original_price = mrp_raw
#         else:
#             original_price = None

#         # ── Stock Status ──────────────────────────────────────────────────
#         stock_status = "in_stock" if hit.get("is_buyable", False) else "out_of_stock"

#         # ── Ratings ───────────────────────────────────────────────────────
#         product_rating = hit.get("product_rating")
#         rating         = None
#         review_count   = 0

#         if product_rating is not None:
#             rating       = safe_float(product_rating.get("value"))
#             review_count = safe_int(product_rating.get("count")) or 0

#         # ── Partner ID cross-check ────────────────────────────────────────
#         # We know partner_id from the store URL we navigated to.
#         # Extract from logo URL as a sanity check — log if mismatch.
#         logo_url          = hit.get("assets", {}).get("logo", "")
#         extracted_partner = extract_partner_id(logo_url)

#         if extracted_partner and extracted_partner != partner_id:
#             logger.warning(
#                 f"[Store:{partner_id}] Partner ID mismatch — "
#                 f"logo says {extracted_partner}. Using URL value."
#             )

#         return {
#             "noon_sku":       noon_sku,
#             "name":           hit.get("name", "").strip(),
#             "brand":          hit.get("brand", "").strip() or None,
#             "url_slug":       url_slug,
#             "product_url":    build_product_url(url_slug, noon_sku),
#             "image_url":      hit.get("image_url"),
#             "store_name":     hit.get("store_name", "unknown").strip() or "unknown",
#             "partner_id":     partner_id,
#             "current_price":  current_price,
#             "original_price": original_price,
#             "stock_status":   stock_status,
#             "rating":         rating,
#             "review_count":   review_count,
#             "is_ad":          bool(hit.get("is_ad", False)),
#             "source":         "store",
#         }

#     except Exception as exc:
#         logger.error(
#             f"[Store:{partner_id}] Error extracting product: {exc} "
#             f"| sku: {hit.get('sku', 'unknown')}"
#         )
#         return None


# # ─────────────────────────────────────────────────────────────────────────────
# # SINGLE STORE PAGE SCRAPER
# # ─────────────────────────────────────────────────────────────────────────────

# async def scrape_store_page(
#     session_manager: SessionManager,
#     partner_id:      str,
#     page_number:     int,
#     total_pages:     int,
#     sort_by:         str = "recommended",
# ) -> tuple[list[dict], Optional[int], Optional[int]]:
#     """
#     Scrapes one page of a seller's store catalogue via direct API call.

#     Returns:
#       (products, nb_pages, nb_hits)
#       products  : extracted product dicts for this page
#       nb_pages  : total pages in this store (from API)
#       nb_hits   : total products in this store (from API, useful on page 1)
#     """
#     await session_manager.ensure_valid()

#     api_url = build_store_api_url(partner_id, page_number, sort_by)
#     referer = build_store_referer_url(partner_id, page_number)

#     logger.info(
#         f"[Store:{partner_id}] Page {page_number}/{total_pages} | "
#         f"sort: {sort_by}"
#     )

#     headers = session_manager.get_headers(referer)
#     proxy   = session_manager.get_proxy()

#     # ── API call ──────────────────────────────────────────────────────────
#     try:
#         async with AsyncSession(impersonate=IMPERSONATE_TARGET) as curl:
#             resp = await curl.get(
#                 api_url,
#                 headers=headers,
#                 proxy=proxy,
#                 timeout=30,
#             )

#     except Exception as exc:
#         logger.error(
#             f"[Store:{partner_id}] Network error on page {page_number}: {exc}"
#         )
#         return [], None, None

#     # ── Response handling ─────────────────────────────────────────────────
#     if resp.status_code == 403:
#         logger.warning(
#             f"[Store:{partner_id}] HTTP 403 — session blocked. "
#             f"Triggering handle_block()."
#         )
#         await session_manager.handle_block()
#         return [], None, None

#     if resp.status_code != 200:
#         logger.error(
#             f"[Store:{partner_id}] Unexpected HTTP {resp.status_code} "
#             f"on page {page_number}."
#         )
#         return [], None, None

#     # ── JSON parsing ──────────────────────────────────────────────────────
#     try:
#         data = resp.json()
#     except Exception as exc:
#         logger.error(
#             f"[Store:{partner_id}] JSON parse error on page {page_number}: {exc}"
#         )
#         return [], None, None

#     nb_pages = data.get("nbPages")
#     nb_hits  = data.get("nbHits", 0)
#     hits     = data.get("hits", [])

#     if nb_hits == 0:
#         logger.warning(
#             f"[Store:{partner_id}] Page {page_number}: nbHits=0. "
#             f"Empty store or soft block."
#         )
#         return [], nb_pages, nb_hits

#     if not hits:
#         logger.warning(
#             f"[Store:{partner_id}] nbHits={nb_hits} but hits empty. "
#             f"Unexpected API response."
#         )
#         return [], nb_pages, nb_hits

#     # ── Extract products ──────────────────────────────────────────────────
#     products = []
#     for index, hit in enumerate(hits):
#         product = extract_product_from_store(hit, index, page_number, partner_id)
#         if product is not None:
#             products.append(product)

#     logger.info(
#         f"[Store:{partner_id}] Page {page_number}: "
#         f"{len(products)}/{len(hits)} products extracted."
#     )

#     session_manager.log_request()

#     return products, nb_pages, nb_hits


# # ─────────────────────────────────────────────────────────────────────────────
# # MAIN STORE SCRAPER
# # ─────────────────────────────────────────────────────────────────────────────

# async def scrape_store(
#     session_manager: SessionManager,
#     partner_id:      str,
#     keywords:        list[str] = None,
#     sort_by:         str = "recommended",
# ) -> list[dict]:
#     """
#     Scrapes a seller's full store and returns relevant products.

#     Signature change from v1:
#       v1: scrape_store(context: BrowserContext, partner_id, keywords, max_pages, sort_by)
#       v2: scrape_store(session_manager: SessionManager, partner_id, keywords, sort_by)

#     max_pages is NO LONGER a parameter. It is decided dynamically after page 1
#     based on nb_hits from the API. This is architecturally correct:
#       - Orchestrator doesn't need to know store size in advance
#       - scrape_store is self-contained in its page limit logic
#       - Small stores get full coverage, large stores get capped automatically

#     keywords parameter:
#       If provided: only products matching at least one keyword are kept.
#       If None or empty: ALL products are kept (full catalogue snapshot).
#       For competitor monitoring: pass the tracked keywords.
#       For client's own store: pass None to capture everything.

#     Args:
#       session_manager : Active SessionManager instance
#       partner_id      : Noon store ID e.g. "p-49644"
#       keywords        : Filter list e.g. ["iphone 15", "iphone 15 pro max"]
#                         None means keep all products.
#       sort_by         : Sort order. "recommended" surfaces best-sellers first
#                         which is ideal for large stores (we capture the most
#                         relevant products within our page cap).

#     Returns:
#       Flat deduplicated list of raw product dicts for pipeline/cleaner.py
#     """
#     if sort_by not in SORT_OPTIONS:
#         logger.warning(
#             f"[Store:{partner_id}] Unknown sort_by '{sort_by}'. "
#             f"Falling back to 'recommended'."
#         )
#         sort_by = "recommended"

#     all_products:     list[dict] = []
#     seen_skus:        set[str]   = set()
#     max_pages:        int        = settings.STORE_PAGES_LARGE  # initial ceiling
#     consecutive_empty: int       = 0

#     for page_number in range(1, max_pages + 1):

#         products, nb_pages, nb_hits = await scrape_store_page(
#             session_manager=session_manager,
#             partner_id=partner_id,
#             page_number=page_number,
#             total_pages=max_pages,
#             sort_by=sort_by,
#         )

#         # ── After page 1: update max_pages from real API data ─────────────
#         # We now know the actual store size and can set the right ceiling.
#         # This replaces the v1 pattern where orchestrator guessed max_pages.
#         if page_number == 1 and nb_hits is not None:
#             max_pages = _decide_max_pages(nb_hits, sort_by)
#             # Also respect the API's own page ceiling
#             if nb_pages is not None:
#                 max_pages = min(max_pages, nb_pages)
#             logger.info(
#                 f"[Store:{partner_id}] Store has {nb_hits} products "
#                 f"across {nb_pages} pages. "
#                 f"Will scrape up to {max_pages} pages."
#             )

#         # ── Consecutive empty page tracking ───────────────────────────────
#         if not products:
#             consecutive_empty += 1
#             if consecutive_empty >= 2:
#                 logger.warning(
#                     f"[Store:{partner_id}] Two consecutive empty pages. "
#                     f"Possible soft block. Returning partial data."
#                 )
#                 await session_manager.handle_block()
#                 break
#         else:
#             consecutive_empty = 0

#         # ── Keyword filter + deduplication ────────────────────────────────
#         relevant_on_page = 0

#         for product in products:
#             sku  = product["noon_sku"]
#             name = product["name"]

#             if sku in seen_skus:
#                 logger.debug(f"[Store:{partner_id}] Duplicate SKU: {sku}")
#                 continue

#             # Keyword filter — skip if keywords provided and no match
#             if keywords and not is_relevant(name, keywords):
#                 logger.debug(f"[Store:{partner_id}] Not relevant: {name[:60]}")
#                 continue

#             seen_skus.add(sku)
#             all_products.append(product)
#             relevant_on_page += 1

#         logger.info(
#             f"[Store:{partner_id}] Page {page_number}: "
#             f"{relevant_on_page} products kept."
#         )

#         # ── Hard stop — no more pages available ───────────────────────────
#         if nb_pages is not None and page_number >= nb_pages:
#             logger.info(
#                 f"[Store:{partner_id}] Last page reached "
#                 f"({page_number}/{nb_pages}). Done."
#             )
#             break

#         if nb_pages is not None and page_number >= max_pages:
#             logger.info(
#                 f"[Store:{partner_id}] Page cap reached ({max_pages}). Done."
#             )
#             break

#         if page_number < max_pages:
#             await random_delay()

#     logger.info(
#         f"[Store:{partner_id}] Complete. "
#         f"Total products collected: {len(all_products)}."
#     )

#     return all_products 
"""
scraper/platforms/noon/store_scraper.py

Scrapes a seller's full store catalogue using direct curl_cffi API calls
and BrowserbaseCookieProvider.

PURPOSE IN THE SYSTEM:
  search discovers which sellers exist and their prices for a keyword.
  store_scraper goes deeper — it scrapes EVERY product a specific seller lists.

PAGE LIMIT STRATEGY:
  - Small store (≤ STORE_SMALL_THRESHOLD) → scrape all pages
  - Large store → cap at STORE_PAGES_LARGE

⚠️  VERIFY STORE API URL in DevTools if store scrapes fail.
"""

import logging
import math
import re
from typing import Optional

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

# ⚠️  VERIFY THIS URL before running store scrapes.
API_STORE_BASE = (
    "https://www.noon.com"
    "/_vs/nc/mp-customer-catalog-api"
    "/api/v3/u/"
)

WEB_STORE_BASE = "https://www.noon.com/uae-en"

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

def build_store_api_url(partner_id: str, page: int, sort_by: str) -> str:
    url = f"{API_STORE_BASE}{partner_id}/?page={page}"
    sort = SORT_OPTIONS.get(sort_by)
    if sort:
        url += f"&sort%5Bby%5D={sort['by']}&sort%5Bdir%5D={sort['dir']}"
    return url


def build_store_referer_url(partner_id: str, page: int) -> str:
    """
    Web-facing store URL used as Referer.
    Example: https://www.noon.com/uae-en/p-49644/?page=2
    """
    return f"{WEB_STORE_BASE}/{partner_id}/?page={page}"


def _decide_max_pages(nb_hits: int, sort_by: str) -> int:
    products_per_page = 50
    actual_pages      = math.ceil(nb_hits / products_per_page)

    if nb_hits <= settings.STORE_SMALL_THRESHOLD:
        logger.debug(
            f"Small store ({nb_hits} products) → scraping all {actual_pages} pages."
        )
        return actual_pages

    logger.debug(
        f"Large store ({nb_hits} products) → "
        f"capping at {settings.STORE_PAGES_LARGE} pages."
    )
    return min(actual_pages, settings.STORE_PAGES_LARGE)


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD RELEVANCE FILTER
# ─────────────────────────────────────────────────────────────────────────────

def is_relevant(product_name: str, keywords: list[str]) -> bool:
    if not product_name:
        return False

    if not keywords:
        return True

    name_lower = product_name.lower()

    return any(
        re.search(rf"\b{re.escape(kw.lower())}\b", name_lower)
        for kw in keywords
    )


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCT EXTRACTOR
# ─────────────────────────────────────────────────────────────────────────────

def extract_product_from_store(
    hit:         dict,
    index:       int,
    page_number: int,
    partner_id:  str,
) -> Optional[dict]:
    try:
        noon_sku = hit.get("sku")
        url_slug = hit.get("url")

        if not noon_sku or not url_slug:
            logger.warning(
                f"[Store:{partner_id}] Skipping hit — missing SKU or URL: "
                f"{hit.get('name', 'unknown')}"
            )
            return None

        sale_price_raw = safe_float(hit.get("sale_price"))
        mrp_raw        = safe_float(hit.get("price"))
        current_price  = sale_price_raw if sale_price_raw is not None else mrp_raw

        if current_price is None:
            logger.warning(
                f"[Store:{partner_id}] Skipping product — no price: {noon_sku}"
            )
            return None

        if (
            sale_price_raw is not None
            and mrp_raw is not None
            and mrp_raw > sale_price_raw
        ):
            original_price = mrp_raw
        else:
            original_price = None

        stock_status = "in_stock" if hit.get("is_buyable", False) else "out_of_stock"

        product_rating = hit.get("product_rating")
        rating         = None
        review_count   = 0

        if product_rating is not None:
            rating       = safe_float(product_rating.get("value"))
            review_count = safe_int(product_rating.get("count")) or 0

        logo_url          = hit.get("assets", {}).get("logo", "")
        extracted_partner = extract_partner_id(logo_url)

        if extracted_partner and extracted_partner != partner_id:
            logger.warning(
                f"[Store:{partner_id}] Partner ID mismatch — "
                f"logo says {extracted_partner}. Using URL value."
            )

        return {
            "noon_sku":       noon_sku,
            "name":           hit.get("name", "").strip(),
            "brand":          hit.get("brand", "").strip() or None,
            "url_slug":       url_slug,
            "product_url":    build_product_url(url_slug, noon_sku),
            "image_url":      hit.get("image_url"),
            "store_name":     hit.get("store_name", "unknown").strip() or "unknown",
            "partner_id":     partner_id,
            "current_price":  current_price,
            "original_price": original_price,
            "stock_status":   stock_status,
            "rating":         rating,
            "review_count":   review_count,
            "is_ad":          bool(hit.get("is_ad", False)),
            "source":         "store",
        }

    except Exception as exc:
        logger.error(
            f"[Store:{partner_id}] Error extracting product: {exc} "
            f"| sku: {hit.get('sku', 'unknown')}"
        )
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SINGLE STORE PAGE SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_store_page(
    session_manager: BrowserbaseCookieProvider,
    partner_id:      str,
    page_number:     int,
    total_pages:     int,
    sort_by:         str = "recommended",
) -> tuple[list[dict], Optional[int], Optional[int]]:
    """
    Scrapes one page of a seller's store catalogue via the persistent Session.

    Returns:
      (products, nb_pages, nb_hits)
    """
    api_url = build_store_api_url(partner_id, page_number, sort_by)
    referer = build_store_referer_url(partner_id, page_number)

    logger.info(
        f"[Store:{partner_id}] Page {page_number}/{total_pages} | "
        f"sort: {sort_by}"
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
            f"[Store:{partner_id}] Network error on page {page_number}: {exc}"
        )
        return [], None, None

    if resp.status_code == 403:
        logger.warning(
            f"[Store:{partner_id}] HTTP 403 — session blocked. "
            f"Triggering handle_block()."
        )
        await session_manager.handle_block(
            reason=f"403 on store:{partner_id} page={page_number}"
        )
        return [], None, None

    if resp.status_code != 200:
        logger.error(
            f"[Store:{partner_id}] Unexpected HTTP {resp.status_code} "
            f"on page {page_number}."
        )
        return [], None, None

    try:
        data = resp.json()
    except Exception as exc:
        logger.error(
            f"[Store:{partner_id}] JSON parse error on page {page_number}: {exc}"
        )
        return [], None, None

    nb_pages = data.get("nbPages")
    nb_hits  = data.get("nbHits", 0)
    hits     = data.get("hits", [])

    if nb_hits == 0:
        logger.warning(
            f"[Store:{partner_id}] Page {page_number}: nbHits=0. "
            f"Empty store or soft block."
        )
        return [], nb_pages, nb_hits

    if not hits:
        logger.warning(
            f"[Store:{partner_id}] nbHits={nb_hits} but hits empty. "
            f"Unexpected API response."
        )
        return [], nb_pages, nb_hits

    products = []
    for index, hit in enumerate(hits):
        product = extract_product_from_store(hit, index, page_number, partner_id)
        if product is not None:
            products.append(product)

    logger.info(
        f"[Store:{partner_id}] Page {page_number}: "
        f"{len(products)}/{len(hits)} products extracted."
    )

    session_manager.log_request()

    return products, nb_pages, nb_hits


# ─────────────────────────────────────────────────────────────────────────────
# MAIN STORE SCRAPER
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_store(
    session_manager: BrowserbaseCookieProvider,
    partner_id:      str,
    keywords:        list[str] = None,
    sort_by:         str = "recommended",
) -> list[dict]:
    """
    Scrapes a seller's full store and returns relevant products.

    max_pages is decided dynamically after page 1 from nb_hits.
    keywords: if provided, only matching products are kept; if None/empty, keep all.
    """
    if sort_by not in SORT_OPTIONS:
        logger.warning(
            f"[Store:{partner_id}] Unknown sort_by '{sort_by}'. "
            f"Falling back to 'recommended'."
        )
        sort_by = "recommended"

    all_products:      list[dict] = []
    seen_skus:         set[str]   = set()
    max_pages:         int        = settings.STORE_PAGES_LARGE
    consecutive_empty: int        = 0

    for page_number in range(1, max_pages + 1):

        products, nb_pages, nb_hits = await scrape_store_page(
            session_manager=session_manager,
            partner_id=partner_id,
            page_number=page_number,
            total_pages=max_pages,
            sort_by=sort_by,
        )

        if page_number == 1 and nb_hits is not None:
            max_pages = _decide_max_pages(nb_hits, sort_by)
            if nb_pages is not None:
                max_pages = min(max_pages, nb_pages)
            logger.info(
                f"[Store:{partner_id}] Store has {nb_hits} products "
                f"across {nb_pages} pages. "
                f"Will scrape up to {max_pages} pages."
            )

        if not products:
            consecutive_empty += 1
            if consecutive_empty >= 2:
                logger.warning(
                    f"[Store:{partner_id}] Two consecutive empty pages. "
                    f"Possible soft block. Returning partial data."
                )
                await session_manager.handle_block(
                    reason=f"two consecutive empty pages on store:{partner_id}"
                )
                break
        else:
            consecutive_empty = 0

        relevant_on_page = 0

        for product in products:
            sku  = product["noon_sku"]
            name = product["name"]

            if sku in seen_skus:
                logger.debug(f"[Store:{partner_id}] Duplicate SKU: {sku}")
                continue

            if keywords and not is_relevant(name, keywords):
                logger.debug(f"[Store:{partner_id}] Not relevant: {name[:60]}")
                continue

            seen_skus.add(sku)
            all_products.append(product)
            relevant_on_page += 1

        logger.info(
            f"[Store:{partner_id}] Page {page_number}: "
            f"{relevant_on_page} products kept."
        )

        if nb_pages is not None and page_number >= nb_pages:
            logger.info(
                f"[Store:{partner_id}] Last page reached "
                f"({page_number}/{nb_pages}). Done."
            )
            break

        if page_number >= max_pages:
            logger.info(
                f"[Store:{partner_id}] Page cap reached ({max_pages}). Done."
            )
            break

        if page_number < max_pages:
            await random_delay()

    logger.info(
        f"[Store:{partner_id}] Complete. "
        f"Total products collected: {len(all_products)}."
    )

    return all_products