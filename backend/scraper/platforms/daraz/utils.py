# """
# Daraz-specific utility functions.
# """
# import httpx
# from app.config import settings
# import logging
# import random 
# logger = logging.getLogger(__name__)


# def build_product_url(base_url: str, slug: str) -> str:
#     return f"{base_url}/{slug}.html"


# def parse_price(raw: str | int | float) -> float | None:
#     try:
#         return float(str(raw).replace(",", "").strip())
#     except (ValueError, TypeError):
#         return None
    

# async def fetch_header_pool(num_results: int = 10) -> list[dict]:
#     """
#     Hit ScrapeOps once at startup.
#     Returns a list of realistic browser header dicts.
#     Store the result in memory — never call this per request.
#     """
#     url = "https://headers.scrapeops.io/v1/browser-headers"
#     params = {
#         "api_key": settings.SCRAPEOPS_API_KEY,
#         "num_results": num_results,
#     }

#     try:
#         async with httpx.AsyncClient() as client:
#             response = await client.get(url, params=params, timeout=10)
#             response.raise_for_status()
#             data = response.json()
#             headers_list = data.get("result", [])

#             if not headers_list:
#                 logger.warning(
#                     "ScrapeOps returned empty headers. "
#                     "Check your API key or quota."
#                 )
#                 return []

#             logger.info(f"Fetched {len(headers_list)} headers from ScrapeOps.")
#             return headers_list

#     except httpx.HTTPError as e:
#         logger.error(f"Failed to fetch headers from ScrapeOps: {e}")
#         return []


# def get_random_header(header_pool: list[dict]) -> dict:
#     """
#     Pick one random header dict from the in-memory pool.
#     Pure function — no API call, no side effects.
#     Falls back to a basic header if pool is empty.
#     """
#     if not header_pool:
#         logger.warning("Header pool is empty. Using fallback header.")
#         return {
#             "user-agent": (
#                 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
#                 "AppleWebKit/537.36 (KHTML, like Gecko) "
#                 "Chrome/124.0.0.0 Safari/537.36"
#             )
#         }
#     return random.choice(header_pool)

"""
scraper/platforms/daraz/utils.py

Pure functions only — no network calls, no session/token/signing logic
(that all lives in mtop_client.py). This file answers one kind of
question: "given real data Daraz gave us, how do I turn it into our
schema's shape?"

Covers:
    - URL/SKU extraction and normalization
    - Country/currency lookup for Daraz's 4-domain footprint
    - Search-hit -> schema field mapping (competitor_listings + price_snapshots)
    - Product-detail response parsing (the double-encoded "module" JSON)
"""

import json
import logging
import re
from typing import Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# 1. Item ID / SKU ID / URI extraction
# ─────────────────────────────────────────────────────────────────────────

# Matches "-i{digits}" immediately before ".html" or end of path segment.
# Confirmed against both real URL shapes:
#   /products/dw-210-20-1-i212788200.html                 (item only)
#   /products/10-20-i278179861-s1499990847.html            (item + variant)
_ITEM_ID_PATTERN = re.compile(r"-i(\d+)(?:-s\d+)?\.html")

# Matches the optional "-s{digits}" variant suffix, when present.
_SKU_ID_PATTERN = re.compile(r"-s(\d+)\.html")


def extract_item_id_from_url(url: str) -> Optional[str]:
    """
    Pulls the Daraz itemId out of a product URL. Always present on any
    real Daraz product URL — returns None only if the URL doesn't match
    the expected shape at all (malformed, non-Daraz, etc.), which the
    caller should treat as skippable, not fatal.

    Example:
        >>> extract_item_id_from_url(
        ...     "https://www.daraz.pk/products/dw-210-20-1-i212788200.html"
        ... )
        '212788200'
        >>> extract_item_id_from_url(
        ...     "https://www.daraz.pk/products/10-20-i278179861-s1499990847.html"
        ... )
        '278179861'
    """
    if not url:
        return None
    match = _ITEM_ID_PATTERN.search(url)
    return match.group(1) if match else None


def extract_sku_id_from_url(url: str) -> Optional[str]:
    """
    Pulls the optional Daraz skuId (variant identifier) out of a product
    URL, when present. Returns None when the URL is a bare item-only
    link (the default-variant search-result shape) — this is expected
    and normal, NOT an error. Callers needing a skuId when this returns
    None should fall back to the product-detail response's
    primaryKey.defaultSkuId instead (see extract_product_detail).

    Example:
        >>> extract_sku_id_from_url(
        ...     "https://www.daraz.pk/products/10-20-i278179861-s1499990847.html"
        ... )
        '1499990847'
        >>> extract_sku_id_from_url(
        ...     "https://www.daraz.pk/products/dw-210-20-1-i212788200.html"
        ... )
        # returns None — no -s suffix present
    """
    if not url:
        return None
    match = _SKU_ID_PATTERN.search(url)
    return match.group(1) if match else None


def extract_uri_from_url(url: str) -> Optional[str]:
    """
    Extracts the "uri" identifier the mtop product-detail API expects —
    the URL path segment with ".html" and any query string stripped.
    This is the bridge between utils.py's data-shape world and
    mtop_client.py's protocol world: product_scraper.py calls this
    first, then passes the result into MtopClient.fetch_product_detail.

    Example:
        >>> extract_uri_from_url(
        ...     "https://www.daraz.pk/products/dw-210-20-1-i212788200.html"
        ...     "?spm=a2a0e.searchlist.list.2.243974523HvVEn"
        ... )
        'dw-210-20-1-i212788200'
    """
    if not url:
        return None
    path = urlparse(url).path  # drops query string automatically
    if not path.endswith(".html"):
        logger.warning(f"extract_uri_from_url: unexpected URL shape: {url!r}")
        return None
    filename = path.rsplit("/", 1)[-1]
    return filename[: -len(".html")]

def extract_sku_id_from_platform_sku(platform_sku: Optional[str]) -> Optional[str]:
    """
    Splits the bare skuId back out of a stored platform_sku value.
    platform_sku is stored in Daraz's own "cheapest_sku" format —
    "{itemId}_{countryCode}-{skuId}" (e.g. "920388148_PK-3973070786") —
    agreed as the storage format since it's what Daraz's search API
    already hands us pre-combined, self-documenting, and always
    splittable back into parts when needed.
 
    This is needed because extract_product_detail requires a bare
    skuId (matching skuInfos' dict keys, e.g. "3973070786"), not the
    combined platform_sku string. product_scraper.py calls this to
    bridge stored data back into what extract_product_detail expects.
 
    Returns None if platform_sku is empty/None, or doesn't contain the
    expected "-" separator — callers should treat this the same as "no
    specific variant known," falling back to primaryKey.defaultSkuId
    (same fallback extract_product_detail already implements).
 
    Example:
        >>> extract_sku_id_from_platform_sku("920388148_PK-3973070786")
        '3973070786'
        >>> extract_sku_id_from_platform_sku(None)
        # returns None
    """
    if not platform_sku or "-" not in platform_sku:
        return None
    return platform_sku.rsplit("-", 1)[-1]


def normalize_item_url(item_url: str) -> str:
    """
    Fixes Daraz's protocol-relative URL shape (confirmed present in real
    search results, e.g. "//www.daraz.pk/products/...") into a proper
    absolute https:// URL, before it's ever stored in
    competitor_listings.url. Idempotent — a URL that's already absolute
    passes through unchanged.

    Example:
        >>> normalize_item_url("//www.daraz.pk/products/dw-210-20-1-i212788200.html")
        'https://www.daraz.pk/products/dw-210-20-1-i212788200.html'
        >>> normalize_item_url("https://www.daraz.pk/products/dw-210-20-1-i212788200.html")
        'https://www.daraz.pk/products/dw-210-20-1-i212788200.html'
    """
    if not item_url:
        return item_url
    if item_url.startswith("//"):
        return f"https:{item_url}"
    return item_url


# ─────────────────────────────────────────────────────────────────────────
# 2. Country / currency lookup — Daraz's 4-country footprint
# ─────────────────────────────────────────────────────────────────────────

# Domain is the authoritative signal (not a locale path segment, unlike
# Noon) — each Daraz country is genuinely a separate top-level domain.
DOMAIN_COUNTRY_CURRENCY: dict[str, tuple[str, str]] = {
    "daraz.pk": ("PK", "PKR"),
    "daraz.com.bd": ("BD", "BDT"),
    "daraz.com.np": ("NP", "NPR"),
    "daraz.com.mm": ("MM", "MMK"),
}


def get_country_currency(url_or_domain: str) -> tuple[Optional[str], Optional[str]]:
    """
    Resolves (country, currency) from either a full URL or a bare
    domain. Returns (None, None) if the domain isn't one of Daraz's
    four known country domains — caller should treat this as "unknown
    market, don't guess," not silently default to Pakistan.

    Example:
        >>> get_country_currency("https://www.daraz.pk/products/foo.html")
        ('PK', 'PKR')
        >>> get_country_currency("daraz.com.bd")
        ('BD', 'BDT')
    """
    if not url_or_domain:
        return None, None

    if "//" in url_or_domain:
        domain = urlparse(url_or_domain).netloc
    else:
        domain = url_or_domain

    # Strip a leading "www." if present, since the lookup table keys
    # don't include it.
    domain = domain.removeprefix("www.")

    return DOMAIN_COUNTRY_CURRENCY.get(domain, (None, None))


# ─────────────────────────────────────────────────────────────────────────
# 3. Search-hit -> schema field mapping
# ─────────────────────────────────────────────────────────────────────────

_DISCOUNT_PCT_PATTERN = re.compile(r"(\d+)%")


def _parse_discount_pct(discount_str: Optional[str]) -> Optional[float]:
    """
    Parses Daraz's formatted "19% Off" string into a plain float. Does
    NOT recompute this from price/originalPrice — Daraz's own displayed
    figure is trusted directly here, since spot-checking confirmed it
    matches the computed value closely (122499/150999 -> ~18.9%, Daraz
    shows "19% Off" — consistent, rounds as expected).

    Returns None if discount_str is empty/missing (no discount active)
    or doesn't match the expected "%" shape.
    """
    if not discount_str:
        return None
    match = _DISCOUNT_PCT_PATTERN.search(discount_str)
    return float(match.group(1)) if match else None


def _safe_decimal_str(value: Any) -> Optional[str]:
    """
    Daraz's search API sends price fields as plain numeric strings
    (e.g. "17999", no thousands separator, no currency symbol) — this
    just guards against missing/empty values without doing any type
    coercion here. The actual Decimal() conversion happens at the
    loader/DB-insert layer, consistent with how Noon's extract_offer
    hands back raw values and lets the loader do that conversion.
    """
    if value in (None, ""):
        return None
    return str(value)


def extract_search_hit(hit: dict[str, Any]) -> dict[str, Any]:
    """
    Maps one search-result hit to schema-matching fields, covering both
    competitor_listings and price_snapshots columns in a single flat
    dict — Daraz's search API already gives us everything in one shot
    (unlike Noon, no separate "offer" extraction pass is needed, since
    there's no multi-seller array here — each hit already IS one
    seller's one listing).

    Unlike Noon, seller identity needs no logo-regex extraction at all:
    sellerId is directly present in the payload as a plain field.

    Returns a dict with keys grouped by which table they eventually
    feed — the caller (loader-equivalent) is responsible for splitting
    these into the right upsert calls, same division of responsibility
    as Noon's extract_offer/extract_signals split.

    Example (verified against a real Dawlance microwave search hit):
        >>> extract_search_hit({
        ...     "itemId": "212788200", "skuId": "1421008099",
        ...     "cheapest_sku": "212788200_PK-1421008099",
        ...     "name": "Dawlance Microwave Oven DW 210 Solo White...",
        ...     "itemUrl": "//www.daraz.pk/products/dw-210-20-1-i212788200.html",
        ...     "sellerName": "Dawlance Pakistan", "sellerId": "6005012844554",
        ...     "price": "17999", "originalPrice": "23000", "discount": "22% Off",
        ...     "inStock": True, "ratingScore": "4.81...", "review": "1323",
        ...     "image": "https://static-01.daraz.pk/p/...png",
        ... })
    """
    item_id = hit.get("itemId") or hit.get("nid")
    raw_url = hit.get("itemUrl", "")
    normalized_url = normalize_item_url(raw_url)

    rating_raw = hit.get("ratingScore")
    review_raw = hit.get("review")

    return {
        # ── competitor_listings fields ──────────────────────────────
        "item_id": item_id,
        "platform_sku": hit.get("cheapest_sku"),  # agreed: full "itemId_CC-skuId" string
        "name": (hit.get("name") or "").strip() or None,
        "url": normalized_url,
        "platform": "daraz",
        "image_url": hit.get("image"),
        # ── seller identity — direct, no extraction needed ──────────
        "seller_name": (hit.get("sellerName") or "").strip() or None,
        "seller_external_id": hit.get("sellerId"),  # -> marketplace_sellers.external_store_id
        # ── price_snapshots fields ──────────────────────────────────
        "price": _safe_decimal_str(hit.get("price")),
        "original_price": _safe_decimal_str(hit.get("originalPrice")),
        "discount_pct": _parse_discount_pct(hit.get("discount")),
        "stock_status": "in_stock" if hit.get("inStock", False) else "out_of_stock",
        "rating": float(rating_raw) if rating_raw not in (None, "") else None,
        "review_count": int(review_raw) if review_raw not in (None, "") else None,
        "product_title": (hit.get("name") or "").strip() or None,
    }


# ─────────────────────────────────────────────────────────────────────────
# 4. Product-detail response parsing (double-encoded JSON)
# ─────────────────────────────────────────────────────────────────────────

def _parse_module(raw_response: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Daraz's product-detail response nests its real payload as a JSON
    STRING inside data.module — confirmed from the real Galaxy S25 FE
    and Dawlance microwave responses. This requires a second
    json.loads() call, unlike every other response shape we've seen on
    either platform. Returns None (never raises) if the structure
    doesn't match — logged as a warning since this indicates either an
    API shape change or an error response slipping through.
    """
    module_str = raw_response.get("data", {}).get("module")
    if not module_str:
        logger.warning("_parse_module: no 'module' string found in response.")
        return None

    try:
        return json.loads(module_str)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning(f"_parse_module: failed to parse module JSON: {exc}")
        return None


def extract_product_detail(
    raw_response: dict[str, Any],
    target_sku_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    Parses a full mtop product-detail response into schema-matching
    fields for ONE specific variant.

    target_sku_id: which skuId to extract data for. A single product
    can carry multiple variants in skuInfos (confirmed: the Galaxy S25
    FE sample had 4 color variants under one itemId). Since a
    competitor_listing is tied to one specific itemId+skuId pair (via
    its platform_sku / cheapest_sku), the caller must say which variant
    it wants — this function does NOT guess or return "all variants."

    If target_sku_id is None, falls back to
    primaryKey.defaultSkuId — useful for the initial discovery pass,
    where a listing was created from a bare item-only URL with no
    specific variant pinned yet (see extract_sku_id_from_url's docstring
    on this same situation).

    Returns None on any parse failure or if target_sku_id (or the
    resolved default) isn't found in skuInfos — never raises.
    """
    module = _parse_module(raw_response)
    if module is None:
        return None

    product = module.get("product", {})
    seller = module.get("seller", {})
    sku_infos = module.get("skuInfos", {})
    primary_key = module.get("primaryKey", {})

    resolved_sku_id = target_sku_id or primary_key.get("defaultSkuId")
    if not resolved_sku_id:
        logger.warning(
            "extract_product_detail: no target_sku_id given and no "
            "primaryKey.defaultSkuId found to fall back to."
        )
        return None

    sku_info = sku_infos.get(resolved_sku_id)
    if sku_info is None:
        logger.warning(
            f"extract_product_detail: resolved_sku_id={resolved_sku_id!r} "
            f"not found in skuInfos (available: {list(sku_infos.keys())})."
        )
        return None

    price_block = sku_info.get("price", {})
    original_price_block = price_block.get("originalPrice", {})
    sale_price_block = price_block.get("salePrice", {})

    quantity_block = sku_info.get("quantity", {})
    quantity_text = (quantity_block.get("text") or "").lower()
    # Daraz's own quantity.text is the richest stock signal available
    # here — distinguishes "Out of stock" from generic low-stock
    # urgency messaging like "Almost sold out, buy now!" (still
    # purchasable) rather than a flat boolean like the search API gives.
    if "out of stock" in quantity_text:
        stock_status = "out_of_stock"
    elif quantity_text:
        stock_status = "limited"
    else:
        stock_status = "unknown"

    specifications = module.get("specifications", {}).get(resolved_sku_id, {})
    warranty_title = None
    warranties = module.get("warranties", {}).get(resolved_sku_id, [])
    for w in warranties:
        if w.get("dataType") == "warranty":
            warranty_title = w.get("title")
            break

    return {
        "item_id": str(primary_key.get("itemId") or ""),
        "sku_id": resolved_sku_id,
        "platform_sku": specifications.get("features", {}).get("SKU"),
        "product_title": module.get("tracking", {}).get("pdt_name"),
        "seller_name": seller.get("name"),
        "seller_external_id": seller.get("sellerId"),
        "seller_positive_rating_pct": seller.get("positiveSellerRating", {}).get("value"),
        "price": _safe_decimal_str(sale_price_block.get("value")),
        "original_price": _safe_decimal_str(original_price_block.get("value")),
        "discount_pct": _parse_discount_pct(price_block.get("discount")),
        "stock_status": stock_status,
        "stock_message": quantity_block.get("text"),  # raw text, e.g. "Almost sold out, buy now!"
        "warranty": warranty_title,
        "rating": module.get("review", {}).get("ratings", {}).get("average"),
        "review_count": module.get("review", {}).get("ratings", {}).get("reviewCount"),
    }