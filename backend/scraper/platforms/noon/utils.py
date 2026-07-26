# scraper/utils.py

import asyncio
import random
import re
import logging
from typing import Optional
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ─── ScrapeOps Header Pool ───────────────────────────────────

async def fetch_header_pool(num_results: int = 10) -> list[dict]:
    """
    Hit ScrapeOps once at startup.
    Returns a list of realistic browser header dicts.
    Store the result in memory — never call this per request.
    """
    url = "https://headers.scrapeops.io/v1/browser-headers"
    params = {
        "api_key": settings.SCRAPEOPS_API_KEY,
        "num_results": num_results,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            headers_list = data.get("result", [])

            if not headers_list:
                logger.warning(
                    "ScrapeOps returned empty headers. "
                    "Check your API key or quota."
                )
                return []

            logger.info(f"Fetched {len(headers_list)} headers from ScrapeOps.")
            return headers_list

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch headers from ScrapeOps: {e}")
        return []


def get_random_header(header_pool: list[dict]) -> dict:
    """
    Pick one random header dict from the in-memory pool.
    Pure function — no API call, no side effects.
    Falls back to a basic header if pool is empty.
    """
    if not header_pool:
        logger.warning("Header pool is empty. Using fallback header.")
        return {
            "user-agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
    return random.choice(header_pool)


# ─── Delay ───────────────────────────────────────────────────

async def random_delay() -> None:
    """
    Async sleep for a random duration between DELAY_MIN and DELAY_MAX.
    Always await this between requests — never skip it.
    """
    delay = random.uniform(settings.DELAY_MIN, settings.DELAY_MAX)
    logger.debug(f"Sleeping for {delay:.2f}s")
    await asyncio.sleep(delay)


# ─── Retry ───────────────────────────────────────────────────

async def retry(func, retries: int = None, *args, **kwargs):
    """
    Retries any async function with exponential backoff.

    Usage:
        result = await retry(some_async_func, 3, arg1, arg2, kwarg=value)

    On total failure returns None — never raises.
    Caller is responsible for handling None return.
    """
    if retries is None:
        retries = settings.MAX_RETRIES

    for attempt in range(1, retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            wait = 2 ** attempt  # 2s, 4s, 8s
            logger.warning(
                f"Attempt {attempt}/{retries} failed for "
                f"{func.__name__}: {e}. Retrying in {wait}s..."
            )
            await asyncio.sleep(wait)

    logger.error(
        f"All {retries} attempts failed for {func.__name__}. "
        f"Returning None."
    )
    return None


# ─── URL Builder ─────────────────────────────────────────────

def build_product_url(url_slug: str, sku: str) -> str:
    """
    Constructs a full Noon product URL from the url slug and SKU.
    Both values come directly from the search API response.

    Example:
        url_slug = "apple-iphone-15-pro-max-256gb"
        sku      = "N12345678V"
        result   = "https://www.noon.com/uae-en/apple-iphone-15-pro-max-256gb/N12345678V/p/"
    """
    base = "https://www.noon.com/uae-en"
    return f"{base}/{url_slug}/{sku}/p/"


# ─── Safe Type Casting ───────────────────────────────────────

def safe_float(value) -> Optional[float]:
    """
    Safely converts any value to float.
    Returns None if conversion fails for any reason.

    Handles: None, empty string "", "N/A", "AED 99", unexpected types.
    Never raises — always returns float or None.

    Usage:
        price = safe_float(hit.get("sale_price"))
        if price is None:
            # handle missing price explicitly
    """
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        logger.debug(f"safe_float: could not convert {value!r} to float.")
        return None


def safe_int(value) -> Optional[int]:
    """
    Safely converts any value to int.
    Returns None if conversion fails for any reason.

    Handles: None, empty string "", "N/A", float strings like "3.0".
    Never raises — always returns int or None.

    Usage:
        count = safe_int(hit.get("review_count")) or 0
        # the `or 0` gives you a safe default when None is returned
    """
    if value is None:
        return None
    try:
        # handle "3.0" style strings by converting via float first
        return int(float(value))
    except (ValueError, TypeError):
        logger.debug(f"safe_int: could not convert {value!r} to int.")
        return None


# ─── Partner ID Extractor ────────────────────────────────────

# def extract_partner_id(logo_url: str) -> Optional[str]:
#     """
#     Extracts the Noon seller partner ID from their logo URL.

#     The search API does not return seller IDs directly.
#     However, the assets.logo URL always contains the numeric partner ID.
#     We extract it and construct the standard "p-{id}" format.

#     Example:
#         logo_url = "https://p.nooncdn.com/reviews-partners/partner_assets/49644/logo_ae_..."
#         returns  = "p-49644"

#     Returns None if the URL is empty, None, or the pattern is not found.
#     This is non-critical — a product without a partner ID is still saved,
#     just without store-level tracking capability.
#     """
#     if not logo_url:
#         return None

#     match = re.search(r'partner_assets/(\d+)/', logo_url)
#     if match:
#         return f"p-{match.group(1)}"

#     logger.debug(f"extract_partner_id: no partner ID found in URL: {logo_url!r}")
#     return None


"""
Step 2 — Pure extraction/transform functions for the Noon product-page API.

These functions have NO side effects: no database session, no network call.
Each one takes plain data in and returns plain data out, so they can be
verified against real sample payloads before ever being wired into the
scraper (Step 3) or the loader (Step 4).

Add these into scraper/platforms/noon/utils.py alongside whatever utility
functions already live there.
"""

import re
from typing import Any, Optional


# ─────────────────────────────────────────────────────────────────────────
# 1. SKU extraction
# ─────────────────────────────────────────────────────────────────────────

# Matches the SKU segment immediately before a trailing /p/ in a Noon
# product URL, tolerating an optional trailing slash and an optional
# trailing query string (e.g. "?ps=true&o=..."). SKUs are always
# uppercase alphanumeric in every sample we've seen (N70100742V, N53433233A).
_SKU_PATTERN = re.compile(r"/([A-Z0-9]+)/p/?(?:\?.*)?$")


def extract_sku_from_url(url: str) -> Optional[str]:
    """
    Pull the Noon catalogue SKU out of a competitor_listings.url value.

    Example:
        >>> extract_sku_from_url(
        ...     "https://www.noon.com/uae-en/renewed-iphone-15-pro-max-256gb-"
        ...     "natural-titanium-5g-with-facetime-international-version/"
        ...     "N70100742V/p/"
        ... )
        'N70100742V'

    Returns None (never raises) if the URL doesn't match the expected
    shape — this is called in a loop over many listings, and one
    malformed URL should be skippable by the caller, not fatal to the
    whole run.
    """
    if not url:
        return None
    match = _SKU_PATTERN.search(url)
    return match.group(1) if match else None


# ─────────────────────────────────────────────────────────────────────────
# 2. Product-page API URL builder
# ─────────────────────────────────────────────────────────────────────────

_API_BASE = "https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/"

# Strips "https://www.noon.com/{locale}/" for ANY locale segment, not just
# "uae-en". Confirmed necessary: a real listing URL used "saudi-en" instead
# of "uae-en" ("https://www.noon.com/saudi-en/renewed-iphone-14-pro-max-..."),
# and a hardcoded uae-en replace would have silently failed to strip
# anything on that URL, producing a broken API URL for every non-UAE
# listing. Locale segments look like "{country}-{lang}", e.g. "uae-en",
# "saudi-en", "egypt-en" — this pattern matches that shape generically.
_LOCALE_PREFIX_PATTERN = re.compile(r"^https://www\.noon\.com/[a-z]+-[a-z]{2}/")


def build_product_api_url(frontend_url: str) -> str:
    """
    Transform a Noon frontend product URL into its product-page API
    equivalent. Strips the locale segment (whatever country/language it
    is — "uae-en", "saudi-en", etc.), prepends the API base path, and
    appends "?ps=true" so the response includes every seller's offer for
    that SKU (not just one pre-selected offer code). Any existing query
    string on the input URL (e.g. "?o=...") is dropped, since ps=true
    alone is sufficient and we don't want to pin to one seller's offer
    code.

    This function does NOT validate that the URL contains a real SKU —
    that's extract_sku_from_url's job. This function does the string
    transform unconditionally; the caller decides not to invoke it at
    all if SKU extraction already failed.

    Examples:
        >>> build_product_api_url(
        ...     "https://www.noon.com/uae-en/renewed-iphone-15-pro-max-256gb-"
        ...     "natural-titanium-5g-with-facetime-international-version/"
        ...     "N70100742V/p/"
        ... )
        'https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/renewed-iphone-15-pro-max-256gb-natural-titanium-5g-with-facetime-international-version/N70100742V/p/?ps=true'

        >>> build_product_api_url(
        ...     "https://www.noon.com/saudi-en/renewed-iphone-14-pro-max-256gb-"
        ...     "deep-purple-5g-with-facetime-international-version/"
        ...     "N53431280A/p/?o=af0bcda9165830fb"
        ... )
        'https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/renewed-iphone-14-pro-max-256gb-deep-purple-5g-with-facetime-international-version/N53431280A/p/?ps=true'
    """
    without_query = frontend_url.split("?")[0]
    path = _LOCALE_PREFIX_PATTERN.sub("", without_query).rstrip("/")
    return f"{_API_BASE}{path}/?ps=true"


# ─────────────────────────────────────────────────────────────────────────
# 3. Offer -> price_snapshots field mapping
# ─────────────────────────────────────────────────────────────────────────

def extract_offer(
    offer: dict[str, Any],
    product_rating: Optional[dict[str, Any]] = None,
    product_title: Optional[str] = None,
) -> dict[str, Any]:
    """
    Maps one element of the product-page API's variants[0].offers[]
    array to the columns on price_snapshots.

    IMPORTANT field mapping (confirmed, do not swap):
        price_snapshots.price          <- offer["sale_price"]  (what the
                                           customer actually pays)
        price_snapshots.original_price <- offer["price"]        (the
                                           crossed-out reference price)

    `product_rating` and `product_title` are passed in separately because
    BOTH live at the product level in the API response (shared across
    every offer for that SKU), not per-offer. Confirmed by a real sample:
    the N53431280A offer object has no "name"/"product_title" field at
    all — only response["product"]["product_title"] carries it. Pass
    response["product"]["product_rating"] and
    response["product"]["product_title"] respectively.

    Returns a dict with keys matching price_snapshots columns exactly,
    ready to be unpacked into a PriceSnapshot(...) constructor call at
    the loader step. Does NOT set competitor_listing_id, scrape_job_id,
    scraped_at, or currency — those are set by the caller, since this
    function has no knowledge of which listing/job/time it belongs to.
    """
    sale_price = offer.get("sale_price")
    price = offer.get("price")

    discount_pct = None
    if sale_price is not None and price:
        try:
            discount_pct = round((1 - (sale_price / price)) * 100, 2)
        except (TypeError, ZeroDivisionError):
            discount_pct = None

    stock_status, stock_count = _derive_stock_status(offer)

    rating = None
    review_count = None
    if product_rating:
        rating = product_rating.get("value")
        review_count = product_rating.get("count")

    return {
        "seller_name": offer.get("store_name"),
        "seller_id": offer.get("partner_code"),
        "product_title": offer.get("name"),
        "price": sale_price,
        "original_price": price,
        "discount_pct": discount_pct,
        "stock_status": stock_status,
        "stock_count": stock_count,
        "rating": rating,
        "review_count": review_count,
        "is_lowest_price_nudge": _has_lowest_price_nudge(offer),
        "low_stock_nudge_value": offer.get("low_stock_nudge_value"),
        "delivery_estimate": offer.get("estimated_delivery_date") or offer.get("estimated_delivery"),
    }


def _derive_stock_status(offer: dict[str, Any]) -> tuple[str, Optional[int]]:
    """
    Derives a stock_status value matching the price_snapshots CHECK
    constraint ('in_stock', 'out_of_stock', 'limited', 'pre_order',
    'unknown'), plus a stock_count if the payload happens to expose one.

    Real payloads (see N53433233A / N70100742V samples) often do NOT
    include a raw numeric "stock" field when inventory is healthy — the
    low_stock_nudge_value only appears when stock is low. So stock_count
    being None while stock_status is "in_stock" is the expected, normal
    case, not a data gap.
    """
    is_buyable = offer.get("is_buyable", False)
    low_stock_value = offer.get("stock_minimum_quantity")
    raw_stock = offer.get("stock")  # present in some response shapes, absent in others

    stock_count = raw_stock if raw_stock is not None else low_stock_value

    if not is_buyable:
        return "out_of_stock", stock_count
    if low_stock_value is not None:
        return "limited", stock_count
    if is_buyable:
        return "in_stock", stock_count
    return "unknown", stock_count


# ─────────────────────────────────────────────────────────────────────────
# 4. Offer -> listing_signals field mapping
# ─────────────────────────────────────────────────────────────────────────

def _has_lowest_price_nudge(offer: dict[str, Any]) -> bool:
    """
    True if any nudge text mentions a "lowest price" badge, regardless of
    the exact window Noon used ("Lowest price in 30 days", "Lowest price
    in 7 days" — both seen in real samples).
    """
    for nudge in offer.get("nudges", []) or []:
        text = (nudge.get("text") or "").lower()
        if "lowest price" in text:
            return True
    return False


def extract_signals(offer: dict[str, Any]) -> dict[str, Any]:
    """
    Maps one offer to the columns on listing_signals. Stores the full
    raw nudges array as-is (JSONB) in addition to the derived booleans/
    values already broken out onto price_snapshots, so any new nudge
    type Noon introduces later is captured automatically with zero
    schema changes.

    Does NOT set competitor_listing_id, price_snapshot_id, or
    detected_at — those are set by the caller (detected_at should be
    passed the same value as the parent snapshot's scraped_at, per our
    earlier discussion, not left to its own server_default).
    """
    seller_ratings = offer.get("partner_ratings_sellerlab") or {}

    return {
        "nudges": offer.get("nudges", []) or [],
        "warranty": offer.get("warranty"),
        "partner_rating": seller_ratings.get("partner_rating"),
        "positive_seller_rating": seller_ratings.get("positive_seller_rating"),
    }


# ─────────────────────────────────────────────────────────────────────────
# 5. Seller logo -> partner ID extraction (for marketplace_sellers backfill)
# ─────────────────────────────────────────────────────────────────────────
_PARTNER_ID_PATTERN = re.compile(r"partner_assets/(\d+)/")
 
 
def extract_partner_id(logo_url: Optional[str]) -> Optional[str]:
    """
    Extracts the Noon seller partner ID from their logo URL, returned in
    the same "p-{id}" format as offer["partner_code"] so the two are
    directly comparable without reformatting.
 
    Example:
        logo_url = "https://p.nooncdn.com/reviews-partners/partner_assets/11275/logo_ae_....jpeg"
        returns  = "p-11275"
 
    Returns None if the URL is empty, None, or the pattern isn't found —
    several real sample offers have "assets": {} with nothing under it,
    which is an expected, non-error case (not every seller has uploaded
    a store logo). Non-critical: a listing without a resolvable partner
    ID is still saved, just without store-level backfill for this pass.
    """
    if not logo_url:
        return None
    match = _PARTNER_ID_PATTERN.search(logo_url)
    return f"p-{match.group(1)}" if match else None
 