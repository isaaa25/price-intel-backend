"""
pipeline/cleaner.py

Takes a raw dict from the Noon scraper and returns a structured clean dict
ready for pipeline/loader.py.

The orchestrator (main.py) adds user_id, tracked_product_id, and
scrape_job_id AFTER cleaning — the cleaner never knows about those.
The cleaner's only job is: validate and normalise the scraped fields.

Input shape (from scraper/platforms/noon/search_scraper.py):
    {
        "noon_sku":        str,
        "name":            str,
        "brand":           str | None,
        "url_slug":        str,
        "product_url":     str,
        "image_url":       str | None,
        "store_name":      str,
        "partner_id":      str | None,   # "p-40123456"
        "current_price":   float | None,
        "original_price":  float | None,
        "stock_status":    str,
        "rating":          float | None,
        "review_count":    int | None,
        "is_ad":           bool,
        "search_position": int | None,
        "search_keyword":  str,
    }

Output shape (consumed by loader.save_product):
    {
        "valid":              bool,
        "marketplace_seller": { ... },
        "listing":            { ... },
        "snapshot":           { ... },
    }

    user_id, tracked_product_id, scrape_job_id are injected by main.py
    after this function returns.
"""

import logging
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

VALID_STOCK_STATUSES = {"in_stock", "out_of_stock", "limited", "unknown"}

# Noon country → currency mapping
COUNTRY_CURRENCY = {
    "UAE": "AED",
    "SAU": "SAR",
    "EGY": "EGP",
    "KWT": "KWD",
    "QAT": "QAR",
    "BHR": "BHD",
    "OMN": "OMR",
}


# ─── Private helpers ──────────────────────────────────────────────────────────

def _str(value, max_length: int = None) -> Optional[str]:
    """Strip and truncate a string. Return None if empty."""
    if value is None:
        return None
    try:
        s = str(value).strip()
        if not s:
            return None
        if max_length and len(s) > max_length:
            s = s[:max_length]
        return s
    except Exception:
        return None


def _decimal(value) -> Optional[Decimal]:
    """Convert to Decimal. Return None if unparseable."""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _stock_status(value) -> str:
    """Normalise stock status. Fall back to 'unknown'."""
    if not value:
        return "unknown"
    normalised = str(value).lower().strip()
    return normalised if normalised in VALID_STOCK_STATUSES else "unknown"


def _rating(value) -> Optional[float]:
    """Validate rating is 0.0–5.0. Return None if outside range."""
    if value is None:
        return None
    try:
        r = float(value)
        return r if 0.0 <= r <= 5.0 else None
    except (ValueError, TypeError):
        return None


def _image_url(value) -> Optional[str]:
    """Accept only URLs that start with http."""
    if not value:
        return None
    url = str(value).strip()
    return url if url.startswith("http") else None


def _partner_id(value) -> Optional[str]:
    """Validate Noon partner_id format: p-{digits}."""
    if not value:
        return None
    v = str(value).strip()
    return v if re.match(r'^p-\d+$', v) else None


def _discount_pct(
    original: Optional[Decimal],
    current: Optional[Decimal],
) -> Optional[Decimal]:
    """
    Calculate discount percentage.
    Pre-computed here so queries never recalculate on the fly.
    Returns None if either price is missing or original <= current.
    """
    if original is None or current is None:
        return None
    if original <= 0 or original <= current:
        return None
    try:
        pct = ((original - current) / original) * Decimal("100")
        return round(pct, 2)
    except (InvalidOperation, ZeroDivisionError):
        return None


# ─── Section builders ─────────────────────────────────────────────────────────

def _build_marketplace_seller(raw: dict, marketplace: str, country: str) -> dict:
    """
    Builds the marketplace_seller section.
    Maps to MarketplaceSeller in the database.

    partner_id ("p-40123456") is Noon's internal store identifier.
    This is what makes upsert_marketplace_seller atomic — it is the
    external_store_id in the unique constraint (marketplace, country, external_store_id).
    """
    store_name = _str(raw.get("store_name"), max_length=200) or "unknown"
    partner_id = _partner_id(raw.get("partner_id"))

    return {
        "marketplace":       marketplace,
        "country":           country,
        "external_store_id": partner_id,   # "p-40123456" or None
        "store_name":        store_name,
        "store_slug":        partner_id,   # same value — Noon uses partner_id as slug
    }


def _build_listing(raw: dict, marketplace: str) -> dict:
    """
    Builds the listing section.
    Maps to CompetitorListing in the database.

    product_url is the unique key for CompetitorListing.
    Two different competitors listing the same product have different URLs.
    """
    return {
        "url":                     raw.get("product_url"),   # required — unique key
        "platform":                marketplace,
        "platform_sku":            _str(raw.get("noon_sku"), max_length=50),
        "name":                    _str(raw.get("name"), max_length=500),
        "category":                None,    # not in search results — populated later
        "image_url":               _image_url(raw.get("image_url")),
        "render_type":             "api_driven",     # Noon uses API interception
        "discovered_by":           "noon_search",      # scraper type — used in check constraint
        "discovered_api_endpoint": None,             # captured separately if needed
    }


def _build_snapshot(raw: dict, currency: str) -> dict:
    """
    Builds the snapshot section.
    Maps to PriceSnapshot in the database.

    Prices are kept as Decimal strings so the loader can use
    Decimal(str(value)) safely without any float rounding.
    """
    current_price  = _decimal(raw.get("current_price"))
    original_price = _decimal(raw.get("original_price"))

    # Discard original_price if it is not actually higher than current
    if original_price is not None and current_price is not None:
        if original_price <= current_price:
            original_price = None

    # review_count: never None, never negative
    raw_count    = raw.get("review_count")
    review_count = max(int(raw_count), 0) if raw_count is not None else None

    # search_position: must be a positive integer
    raw_pos  = raw.get("search_position")
    position = None
    if raw_pos is not None:
        try:
            p = int(raw_pos)
            position = p if p > 0 else None
        except (ValueError, TypeError):
            position = None

    store_name = _str(raw.get("store_name"), max_length=255) or "unknown"
    partner_id = _partner_id(raw.get("partner_id"))

    return {
        "price":          str(current_price) if current_price is not None else None,
        "currency":       currency,
        "original_price": str(original_price) if original_price is not None else None,
        "discount_pct":   str(_discount_pct(original_price, current_price))
                          if _discount_pct(original_price, current_price) is not None else None,
        "stock_status":   _stock_status(raw.get("stock_status")),
        "rating":         _rating(raw.get("rating")),
        "review_count":   review_count,
        "search_position": position,
        "seller_name":    store_name,
        "seller_id":      partner_id,
        "product_title":  _str(raw.get("name"), max_length=255),
        "scraped_at":     datetime.now(timezone.utc),
    }


def _is_valid(listing: dict, snapshot: dict) -> bool:
    """
    Reject records that are missing foundational anchors.
    Everything else degrades gracefully.

    Rejection conditions:
        - url missing          (cannot create CompetitorListing without a URL)
        - price missing        (a listing with no price is useless)
        - price zero/negative  (data error — Noon never lists at 0)
    """
    if not listing.get("url"):
        logger.warning(
            f"Rejecting: missing product_url | sku={listing.get('platform_sku')}"
        )
        return False

    price_raw = snapshot.get("price")
    if price_raw is None:
        logger.warning(
            f"Rejecting: missing price | url={listing.get('url', '')[:60]}"
        )
        return False

    try:
        if Decimal(str(price_raw)) <= 0:
            logger.warning(
                f"Rejecting: price <= 0 | url={listing.get('url', '')[:60]}"
            )
            return False
    except (InvalidOperation, TypeError):
        logger.warning(
            f"Rejecting: unparseable price {price_raw!r} | "
            f"url={listing.get('url', '')[:60]}"
        )
        return False

    return True


# ─── Public interface ─────────────────────────────────────────────────────────

def clean_product(
    raw: dict,
    marketplace: str = "noon",
    country: str = "UAE",
) -> dict:
    """
    Takes one raw product dict from the Noon scraper.
    Returns a structured clean dict ready for pipeline/loader.save_product().

    The caller (main.py) must inject three fields after this returns:
        result["user_id"]            = str(user_id)
        result["tracked_product_id"] = str(tracked_product_id)
        result["scrape_job_id"]      = None  (or a real UUID if you have one)

    Never raises. All errors degrade gracefully.
    Records missing a URL or a valid price are marked invalid.
    """
    try:
        currency            = COUNTRY_CURRENCY.get(country, "AED")
        marketplace_seller  = _build_marketplace_seller(raw, marketplace, country)
        listing             = _build_listing(raw, marketplace)
        snapshot            = _build_snapshot(raw, currency)
        valid               = _is_valid(listing, snapshot)

        return {
            "valid":               valid,
            "marketplace_seller":  marketplace_seller,
            "listing":             listing,
            "snapshot":            snapshot,
        }

    except Exception as e:
        logger.error(
            f"Unexpected error in clean_product: {e} "
            f"| sku={raw.get('noon_sku', 'unknown')}",
            exc_info=True,
        )
        return {
            "valid":              False,
            "marketplace_seller": {},
            "listing":            {},
            "snapshot":           {},
        }


    # ═══════════════════════════════════════════════════════════════════════════
# DARAZ — clean_daraz_hit
# ═══════════════════════════════════════════════════════════════════════════
#
# Own section builders, one cleaner function per platform (per agreement):
# whenever Daraz's data shape changes or a Daraz-specific bug shows up,
# this is the one place to look - clean_product above is never touched.
# Both functions produce the exact same output shape, so loader.py needs
# zero platform-awareness: it only ever sees the standardized
# valid/marketplace_seller/listing/snapshot dict, regardless of which
# cleaner produced it.
#
# Input shape (from scraper/platforms/daraz/utils.py's extract_search_hit):
#     {
#         "item_id":            str,
#         "platform_sku":       str,     # Daraz's "cheapest_sku" format
#         "name":               str | None,
#         "url":                str,     # already normalized to https://
#         "platform":           "daraz",
#         "image_url":          str | None,
#         "seller_name":        str | None,
#         "seller_external_id": str | None,   # plain numeric string, e.g. "6005012844554"
#         "price":              str | None,   # already a plain numeric string
#         "original_price":     str | None,
#         "discount_pct":       float | None, # already parsed from "19% Off"
#         "stock_status":       str,          # already "in_stock" | "out_of_stock"
#         "rating":             float | None,
#         "review_count":       int | None,
#         "product_title":      str | None,
#     }
 
# Daraz country -> currency, matching the four-domain footprint confirmed
# in scraper/platforms/daraz/utils.py's DOMAIN_COUNTRY_CURRENCY. Kept as
# its own dict here (not imported from there) for the same reason
# COUNTRY_CURRENCY above isn't imported from anywhere either - cleaner.py
# stays self-contained, no cross-file coupling for a 4-line lookup table.
DARAZ_COUNTRY_CURRENCY = {
    "PK": "PKR",
    "BD": "BDT",
    "NP": "NPR",
    "MM": "MMK",
}
 
 
def _daraz_seller_id(value) -> Optional[str]:
    """
    Validates a Daraz seller external ID - a plain numeric string
    (e.g. "6005012844554"), unlike Noon's "p-{digits}" format. No
    prefix to check for, just confirm it's non-empty and all-digit.
    """
    if not value:
        return None
    v = str(value).strip()
    return v if v.isdigit() else None
 
 
def _build_daraz_marketplace_seller(raw: dict, country: str) -> dict:
    """
    Builds the marketplace_seller section for a Daraz hit.
    Maps to MarketplaceSeller, same as Noon's _build_marketplace_seller.
 
    store_slug is left as None - Daraz's search API gives us no
    separate slug concept the way Noon's logo-URL extraction produced
    one; external_store_id (the plain seller ID) is the sole matching
    key here, consistent with the marketplace_sellers model comment
    describing store_slug as an optional SEO field, not a required one.
    """
    store_name = _str(raw.get("seller_name"), max_length=200) or "unknown"
    seller_id = _daraz_seller_id(raw.get("seller_external_id"))
 
    return {
        "marketplace":       "daraz",
        "country":           country,
        "external_store_id": seller_id,
        "store_name":        store_name,
        "store_slug":        None,
    }
 
 
def _build_daraz_listing(raw: dict) -> dict:
    """
    Builds the listing section for a Daraz hit.
    Maps to CompetitorListing, same as Noon's _build_listing.
 
    render_type is "api_driven" - Daraz's search results come from a
    direct JSON API call (ajax=true), same category as Noon's approach,
    just unsigned. discovered_by uses "daraz_search", already present
    in the CompetitorListing.discovered_by CHECK constraint.
    """
    return {
        "url":                     raw.get("url"),   # required - unique key, already normalized
        "platform":                "daraz",
        "platform_sku":            _str(raw.get("platform_sku"), max_length=50),
        "name":                    _str(raw.get("name"), max_length=500),
        "category":                None,    # not in search results - populated later
        "image_url":               _image_url(raw.get("image_url")),
        "render_type":             "api_driven",
        "discovered_by":           "daraz_search",
        "discovered_api_endpoint": None,
    }
 
 
def _build_daraz_snapshot(raw: dict, currency: str) -> dict:
    """
    Builds the snapshot section for a Daraz hit.
    Maps to PriceSnapshot, same as Noon's _build_snapshot.
 
    Unlike Noon, discount_pct arrives already parsed (extract_search_hit
    parses Daraz's own "19% Off" display string) rather than needing to
    be computed here from original/current price - trusted directly,
    same reasoning documented in extract_search_hit's docstring.
 
    search_position is always None here - Daraz's search response
    doesn't carry a per-item rank the way Noon's does (nothing in
    extract_search_hit's output maps to it), so this column is simply
    left unpopulated for every Daraz-sourced snapshot.
    """
    current_price  = _decimal(raw.get("price"))
    original_price = _decimal(raw.get("original_price"))
 
    if original_price is not None and current_price is not None:
        if original_price <= current_price:
            original_price = None
 
    raw_count = raw.get("review_count")
    review_count = max(int(raw_count), 0) if raw_count is not None else None
 
    discount_pct_raw = raw.get("discount_pct")
    discount_pct = _decimal(discount_pct_raw) if discount_pct_raw is not None else None
 
    store_name = _str(raw.get("seller_name"), max_length=255) or "unknown"
    seller_id = _daraz_seller_id(raw.get("seller_external_id"))
 
    return {
        "price":           str(current_price) if current_price is not None else None,
        "currency":        currency,
        "original_price":  str(original_price) if original_price is not None else None,
        "discount_pct":    str(discount_pct) if discount_pct is not None else None,
        "stock_status":    _stock_status(raw.get("stock_status")),
        "rating":          _rating(raw.get("rating")),
        "review_count":    review_count,
        "search_position": None,   # not available from Daraz's search response
        "seller_name":     store_name,
        "seller_id":       seller_id,
        "product_title":   _str(raw.get("product_title") or raw.get("name"), max_length=255),
        "scraped_at":      datetime.now(timezone.utc),
    }
 
 
def clean_daraz_hit(
    raw: dict,
    marketplace: str = "daraz",
    country: str = "PK",
) -> dict:
    """
    Takes one raw hit dict from scraper/platforms/daraz/utils.py's
    extract_search_hit. Returns the exact same standardized clean dict
    shape as clean_product() - loader.save_product() consumes both
    identically, with zero platform-awareness.
 
    The caller (main.py) must inject the same three fields after this
    returns, identical to clean_product():
        result["user_id"]            = str(user_id)
        result["tracked_product_id"] = str(tracked_product_id)
        result["scrape_job_id"]      = None  (or a real UUID if you have one)
 
    Never raises. All errors degrade gracefully. Reuses _is_valid()
    unchanged - the same url/price validity gate applies regardless of
    which platform produced the data.
    """
    try:
        currency             = DARAZ_COUNTRY_CURRENCY.get(country, "PKR")
        marketplace_seller   = _build_daraz_marketplace_seller(raw, country)
        listing               = _build_daraz_listing(raw)
        snapshot              = _build_daraz_snapshot(raw, currency)
        valid                 = _is_valid(listing, snapshot)
 
        return {
            "valid":               valid,
            "marketplace_seller":  marketplace_seller,
            "listing":             listing,
            "snapshot":            snapshot,
        }
 
    except Exception as e:
        logger.error(
            f"Unexpected error in clean_daraz_hit: {e} "
            f"| item_id={raw.get('item_id', 'unknown')}",
            exc_info=True,
        )
        return {
            "valid":              False,
            "marketplace_seller": {},
            "listing":            {},
            "snapshot":           {},
        }


# ═══════════════════════════════════════════════════════════════════════════
# OWN-PRODUCT SNAPSHOT CLEANERS — clean_own_snapshot_noon / clean_own_snapshot_daraz
# ═══════════════════════════════════════════════════════════════════════════
#
# These map a scraped detail-page result for the USER'S OWN product
# (tracked_products.own_url) into the slim shape TrackedProductSnapshot
# actually has columns for: price, original_price, currency, stock_status,
# rating, review_count. No seller_name/seller_id/product_title/discount_pct/
# search_position — those belong to competitor identity, which doesn't
# apply to your own listing, and TrackedProductSnapshot has no columns
# for them.
#
# "source" is NOT set here — it's always "scraped" for anything going
# through this scraping pipeline. The loader sets it explicitly rather
# than trusting a cleaner-supplied value, since "manual" rows only ever
# come from a user typing a price into the dashboard directly, a
# completely different code path that never touches this cleaner.
#
# Output shape (identical across both platforms — loader stays
# platform-agnostic, same principle as the competitor-path cleaners):
#     {
#         "valid":          bool,
#         "own_snapshot": {
#             "price":          str | None,
#             "original_price": str | None,
#             "currency":       str,
#             "stock_status":   str,
#             "rating":         float | None,
#             "review_count":   int | None,
#             "scraped_at":     datetime,
#         },
#     }
#
# Validity gate is intentionally simpler than _is_valid() for the
# competitor path: there's no "url missing" case to check (own_url is
# NOT NULL on tracked_products and was already used to scrape), so
# the only thing that can invalidate an own-snapshot is an unparseable
# or non-positive price.
def _own_snapshot_valid(price: Optional[Decimal]) -> bool:
    if price is None:
        return False
    try:
        return Decimal(str(price)) > 0
    except (InvalidOperation, TypeError):
        return False


def clean_own_snapshot_noon(raw: dict, country: str = "UAE") -> dict:
    """
    raw: the dict returned by Noon's own product-detail scraper
    (whatever function scrapes own_url on Noon — same extraction
    logic used for competitor detail pages, just pointed at own_url).
    Expected keys mirror what that function already produces for
    price/stock — reusing the same field names Noon's own detail
    extraction uses elsewhere in the codebase (current_price,
    original_price, stock_status, rating, review_count).
    """
    currency = COUNTRY_CURRENCY.get(country, "AED")

    price = _decimal(raw.get("current_price"))
    original_price = _decimal(raw.get("original_price"))
    if original_price is not None and price is not None and original_price <= price:
        original_price = None

    raw_count = raw.get("review_count")
    review_count = max(int(raw_count), 0) if raw_count is not None else None

    snapshot = {
        "price": str(price) if price is not None else None,
        "original_price": str(original_price) if original_price is not None else None,
        "currency": currency,
        "stock_status": _stock_status(raw.get("stock_status")),
        "rating": _rating(raw.get("rating")),
        "review_count": review_count,
        "scraped_at": datetime.now(timezone.utc),
    }

    return {
        "valid": _own_snapshot_valid(price),
        "own_snapshot": snapshot,
    }


def clean_own_snapshot_daraz(raw: dict, country: str = "PK") -> dict:
    """
    raw: the dict returned by scraper/platforms/daraz/utils.py's
    extract_product_detail(), pointed at own_url instead of a
    competitor's URL. Same function, same output shape, just a
    different caller — per the design notes, no new scraping logic
    needed for Daraz either.
    """
    currency = DARAZ_COUNTRY_CURRENCY.get(country, "PKR")

    price = _decimal(raw.get("price"))
    original_price = _decimal(raw.get("original_price"))
    if original_price is not None and price is not None and original_price <= price:
        original_price = None

    raw_count = raw.get("review_count")
    review_count = max(int(raw_count), 0) if raw_count is not None else None

    snapshot = {
        "price": str(price) if price is not None else None,
        "original_price": str(original_price) if original_price is not None else None,
        "currency": currency,
        "stock_status": _stock_status(raw.get("stock_status")),
        "rating": _rating(raw.get("rating")),
        "review_count": review_count,
        "scraped_at": datetime.now(timezone.utc),
    }

    return {
        "valid": _own_snapshot_valid(price),
        "own_snapshot": snapshot,
    }