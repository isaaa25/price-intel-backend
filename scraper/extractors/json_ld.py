# scraper/extractors/json_ld.py

"""
Step 2 of the four-step extraction pipeline.

Looks for <script type="application/ld+json"> tags in the page HTML
and attempts to extract product data from Schema.org structured data.

This works on the majority of modern e-commerce sites because embedding
structured data is required for Google Shopping indexing. If a site wants
to appear in Google Shopping results, it almost certainly has JSON-LD.

Returns None if:
- No JSON-LD script tags found
- JSON-LD found but no Product type present
- Product found but price field is missing or unparseable

The pipeline moves to the next step (shopify_api.py) on any None return.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared data contract — every extractor in this pipeline returns this
# ---------------------------------------------------------------------------

@dataclass
class ExtractionResult:
    """
    The single data contract for all four extraction steps.

    Every extractor returns either an ExtractionResult or None.
    None means "I could not extract from this page — try the next step."
    A populated ExtractionResult means success — the pipeline stops here.

    Fields are deliberately Optional where the source may not provide them.
    The only non-optional fields are price and stock_status — these are the
    minimum viable data we need to be useful to a seller.
    """
    price: Decimal
    stock_status: str                      # 'in_stock' | 'out_of_stock' | 'limited'
    title: str | None = None
    original_price: Decimal | None = None  # for fake discount detection
    currency: str = "PKR"
    rating: float | None = None
    review_count: int | None = None
    seller_name: str | None = None
    extraction_method: str = "unknown"     # which step succeeded — for logging


# ---------------------------------------------------------------------------
# Schema.org stock status vocabulary → our internal vocabulary
# ---------------------------------------------------------------------------

# Schema.org uses full URIs or short names for availability.
# We normalise both forms to our three internal states.
_SCHEMA_STOCK_MAP: dict[str, str] = {
    # Full URI forms
    "https://schema.org/instock":          "in_stock",
    "https://schema.org/instockgenerally": "in_stock",
    "https://schema.org/limitedavailability": "limited",
    "https://schema.org/outofstock":       "out_of_stock",
    "https://schema.org/discontinued":     "out_of_stock",
    "https://schema.org/soldout":          "out_of_stock",
    "http://schema.org/instock":           "in_stock",
    "http://schema.org/outofstock":        "out_of_stock",
    "http://schema.org/limitedavailability": "limited",
    # Short name forms (some sites omit the domain prefix)
    "instock":            "in_stock",
    "instockgenerally":   "in_stock",
    "limitedavailability": "limited",
    "outofstock":         "out_of_stock",
    "discontinued":       "out_of_stock",
    "soldout":            "out_of_stock",
    "preorder":           "out_of_stock",
    "presale":            "out_of_stock",
}


def _normalise_stock(raw: str | None) -> str:
    """
    Convert a Schema.org availability value to our internal vocabulary.

    Defaults to 'in_stock' when the value is missing or unrecognised.
    We prefer false positives (showing as in_stock) over false negatives
    (showing as out_of_stock when item is actually available), because
    a false out_of_stock alert destroys user trust faster than a missed
    opportunity alert.
    """
    if not raw:
        return "in_stock"
    normalised = raw.strip().lower().rstrip("/")
    return _SCHEMA_STOCK_MAP.get(normalised, "in_stock")


def _parse_price(raw: Any) -> Decimal | None:
    """
    Parse a price value from JSON-LD into a Decimal.

    JSON-LD price fields can be:
    - A float: 85000.0
    - An integer: 85000
    - A string: "85,000" or "85000" or "85,000.00"
    - A string with currency prefix: "PKR 85000" (rare but seen)

    Returns None if the value cannot be parsed — signals pipeline failure
    for this field so the caller can decide whether to proceed.
    """
    if raw is None:
        return None
    try:
        # Handle string forms — strip currency symbols and commas
        if isinstance(raw, str):
            cleaned = (
                raw.strip()
                   .replace(",", "")
                   .split()[-1]  # "PKR 85000" → take last token
            )
            return Decimal(cleaned)
        # Numeric forms are straightforward
        return Decimal(str(raw))
    except (InvalidOperation, IndexError, TypeError):
        logger.debug("Could not parse price value: %r", raw)
        return None


# ---------------------------------------------------------------------------
# Core extraction logic
# ---------------------------------------------------------------------------

def _extract_from_product_node(node: dict[str, Any]) -> ExtractionResult | None:
    """
    Given a JSON-LD node that has "@type": "Product", extract all fields.

    The 'offers' field can be:
    - A single offer object: {"@type": "Offer", "price": 85000, ...}
    - A list of offer objects: [{"@type": "Offer", ...}, ...]
    - Missing entirely (in that case we cannot get a price — return None)

    When multiple offers exist, we take the lowest price. This reflects
    competitive reality: the most relevant price for a seller to know about
    is the cheapest available option from that competitor.
    """
    offers_raw = node.get("offers")
    if not offers_raw:
        logger.debug("JSON-LD Product node found but has no 'offers' field")
        return None

    # Normalise to always be a list
    offers: list[dict] = (
        offers_raw if isinstance(offers_raw, list) else [offers_raw]
    )

    # Find the best (lowest) price across all offers
    best_price: Decimal | None = None
    best_offer: dict = {}

    for offer in offers:
        if not isinstance(offer, dict):
            continue
        candidate = _parse_price(offer.get("price"))
        if candidate is None:
            continue
        if best_price is None or candidate < best_price:
            best_price = candidate
            best_offer = offer

    if best_price is None:
        logger.debug("JSON-LD offers found but no parseable price in any offer")
        return None

    # Extract optional fields — failures here do not abort extraction
    title: str | None = node.get("name") or node.get("title")

    # original_price lives in the offer, not the product node
    original_price = _parse_price(best_offer.get("priceSpecification", {}).get("price"))

    # Some sites put original price directly as a second priceType offer
    # Check if there's a "ListPrice" or "StrikethroughPrice" offer
    for offer in offers:
        if not isinstance(offer, dict):
            continue
        offer_type = str(offer.get("priceType") or "").lower()
        if "list" in offer_type or "regular" in offer_type or "strikethrough" in offer_type:
            candidate_original = _parse_price(offer.get("price"))
            if candidate_original and (not original_price or candidate_original > best_price):
                original_price = candidate_original
            break

    # Rating and review count
    aggregate_rating = node.get("aggregateRating") or {}
    rating: float | None = None
    review_count: int | None = None
    if isinstance(aggregate_rating, dict):
        raw_rating = aggregate_rating.get("ratingValue")
        raw_count = aggregate_rating.get("reviewCount") or aggregate_rating.get("ratingCount")
        try:
            rating = float(raw_rating) if raw_rating is not None else None
        except (TypeError, ValueError):
            pass
        try:
            review_count = int(raw_count) if raw_count is not None else None
        except (TypeError, ValueError):
            pass

    # Seller name — can be on the offer or the product
    seller_name: str | None = None
    seller_raw = best_offer.get("seller") or node.get("brand") or node.get("manufacturer")
    if isinstance(seller_raw, dict):
        seller_name = seller_raw.get("name")
    elif isinstance(seller_raw, str):
        seller_name = seller_raw

    # Currency — ISO 4217 code, default PKR for our primary market
    currency = str(best_offer.get("priceCurrency") or "PKR").upper()

    # Stock status
    stock_status = _normalise_stock(best_offer.get("availability"))

    return ExtractionResult(
        price=best_price,
        stock_status=stock_status,
        title=title,
        original_price=original_price,
        currency=currency,
        rating=rating,
        review_count=review_count,
        seller_name=seller_name,
        extraction_method="json_ld",
    )


def _find_product_node(data: Any) -> dict | None:
    """
    Recursively search a JSON-LD structure for a node with @type == Product.

    Handles three common structures:
    1. Direct product: {"@type": "Product", ...}
    2. Graph array:    {"@graph": [{"@type": "Product", ...}, ...]}
    3. Nested:         {"@type": "WebPage", "mainEntity": {"@type": "Product"}}
    """
    if isinstance(data, list):
        for item in data:
            result = _find_product_node(item)
            if result:
                return result
        return None

    if not isinstance(data, dict):
        return None

    # Check @type — can be a string or a list of strings
    type_value = data.get("@type", "")
    type_list: list[str] = (
        type_value if isinstance(type_value, list) else [type_value]
    )
    if any(t.lower() in ("product", "schema:product") for t in type_list):
        return data

    # Search in @graph
    graph = data.get("@graph")
    if graph:
        result = _find_product_node(graph)
        if result:
            return result

    # Search in mainEntity (WebPage wrapping a Product)
    main_entity = data.get("mainEntity")
    if main_entity:
        result = _find_product_node(main_entity)
        if result:
            return result

    return None


# ---------------------------------------------------------------------------
# Public interface — this is the only function the pipeline calls
# ---------------------------------------------------------------------------

def extract(html: str) -> ExtractionResult | None:
    """
    Attempt to extract product data from JSON-LD structured data in HTML.

    This is the only public function. The pipeline calls this with raw HTML
    and receives either an ExtractionResult (success) or None (move on).

    Args:
        html: Raw HTML string of the product page.

    Returns:
        ExtractionResult if JSON-LD product data was found and parseable.
        None if extraction failed for any reason.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        # lxml not available or HTML completely malformed — fall back
        soup = BeautifulSoup(html, "html.parser")

    script_tags = soup.find_all("script", type="application/ld+json")

    if not script_tags:
        logger.debug("No JSON-LD script tags found on page")
        return None

    for script in script_tags:
        raw_text = script.string or script.get_text()
        if not raw_text or not raw_text.strip():
            continue

        try:
            data = json.loads(raw_text.strip())
        except json.JSONDecodeError as exc:
            logger.debug("JSON-LD script tag contains invalid JSON: %s", exc)
            continue

        product_node = _find_product_node(data)
        if not product_node:
            continue

        result = _extract_from_product_node(product_node)
        if result:
            logger.info(
                "JSON-LD extraction successful — price: %s %s, stock: %s",
                result.price,
                result.currency,
                result.stock_status,
            )
            return result

    logger.debug("JSON-LD tags found but no Product node with valid price")
    return None