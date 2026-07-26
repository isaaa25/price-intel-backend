"""
validator.py
------------
Pure validation function. Zero database calls. Zero network calls.
Takes raw extractor output, returns a ValidationResult.

All historical/temporal context is passed IN by pipeline.py.
This function always produces the same output for the same input.
"""

from __future__ import annotations

import re
import logging
from enum import Enum
from typing import Any

from price_parser import Price
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Constants
# ---------------------------------------------------------------------------

class StockStatus(str, Enum):
    IN_STOCK    = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    LIMITED     = "limited"
    PRE_ORDER   = "pre_order"      # backorder / ships-in-X-weeks
    UNKNOWN     = "unknown"


class ExtractionSource(str, Enum):
    SHOPIFY_API          = "shopify_api"
    JSON_LD              = "json_ld"
    CSS_SELECTOR         = "css_selector"
    LLM                  = "llm"
    NETWORK_INTERCEPTOR  = "network_interceptor"


# Baseline confidence by source — how much we trust each extractor
SOURCE_BASELINE: dict[str, float] = {
    ExtractionSource.SHOPIFY_API:         0.95,
    ExtractionSource.NETWORK_INTERCEPTOR: 0.95,
    ExtractionSource.JSON_LD:             0.90,
    ExtractionSource.CSS_SELECTOR:        0.80,
    ExtractionSource.LLM:                 0.75,
}

# Stock status normalisation map
# Keys are lowercase stripped strings from raw HTML / API responses
STOCK_NORMALISATION: dict[str, StockStatus] = {
    # In stock variants
    "in stock":           StockStatus.IN_STOCK,
    "instock":            StockStatus.IN_STOCK,
    "in_stock":           StockStatus.IN_STOCK,
    "available":          StockStatus.IN_STOCK,
    "add to cart":        StockStatus.IN_STOCK,
    "buy now":            StockStatus.IN_STOCK,
    "true":               StockStatus.IN_STOCK,
    "yes":                StockStatus.IN_STOCK,
    "https://schema.org/instock": StockStatus.IN_STOCK,

    # Out of stock variants
    "out of stock":       StockStatus.OUT_OF_STOCK,
    "outofstock":         StockStatus.OUT_OF_STOCK,
    "out_of_stock":       StockStatus.OUT_OF_STOCK,
    "sold out":           StockStatus.OUT_OF_STOCK,
    "soldout":            StockStatus.OUT_OF_STOCK,
    "unavailable":        StockStatus.OUT_OF_STOCK,
    "false":              StockStatus.OUT_OF_STOCK,
    "no":                 StockStatus.OUT_OF_STOCK,
    "https://schema.org/outofstock": StockStatus.OUT_OF_STOCK,

    # Limited variants
    "limited":            StockStatus.LIMITED,
    "limited stock":      StockStatus.LIMITED,
    "low stock":          StockStatus.LIMITED,
    "only a few left":    StockStatus.LIMITED,
    "hurry":              StockStatus.LIMITED,
    "https://schema.org/limitedavailability": StockStatus.LIMITED,

    # Pre-order / backorder variants
    "pre-order":          StockStatus.PRE_ORDER,
    "preorder":           StockStatus.PRE_ORDER,
    "pre order":          StockStatus.PRE_ORDER,
    "backorder":          StockStatus.PRE_ORDER,
    "back order":         StockStatus.PRE_ORDER,
    "backordered":        StockStatus.PRE_ORDER,
    "ships in":           StockStatus.PRE_ORDER,   # "ships in 4 weeks"
    "available for order": StockStatus.PRE_ORDER,
    "https://schema.org/preorder": StockStatus.PRE_ORDER,
    "https://schema.org/backorder": StockStatus.PRE_ORDER,
}

# "Only N left" pattern — maps to LIMITED
LIMITED_PATTERN = re.compile(r"only\s+\d+\s+(left|remaining|in stock)", re.IGNORECASE)
SHIPS_IN_PATTERN = re.compile(r"ships?\s+in\s+\d+", re.IGNORECASE)

# Currency normalisation
CURRENCY_ALIASES: dict[str, str] = {
    "rs":    "PKR",
    "rs.":   "PKR",
    "pkr":   "PKR",
    "₨":     "PKR",
    "usd":   "USD",
    "$":     "USD",
    "gbp":   "GBP",
    "£":     "GBP",
    "eur":   "EUR",
    "€":     "EUR",
    "inr":   "INR",
    "₹":     "INR",
    "aed":   "AED",
    "sar":   "SAR",
}

# Domain → expected currency (used to flag mismatches)
DOMAIN_CURRENCY_MAP: dict[str, str] = {
    "daraz.pk":   "PKR",
    "daraz.com":  "PKR",
    "noon.com":   "AED",
    "amazon.com": "USD",
    "amazon.co.uk": "GBP",
}


# Hard price limits - anything outside this is an extraction artifact
PRICE_MIN = 0.01
PRICE_MAX = 100_000_000.0   # 100 million — adjust per category if needed

# Confidence thresholds
THRESHOLD_HIGH   = 0.90   # write snapshot + cache config
THRESHOLD_MEDIUM = 0.75   # write snapshot, don't cache
THRESHOLD_LOW    = 0.60   # write snapshot with flag, notify admin
# below LOW       → reject entirely


# ---------------------------------------------------------------------------
# Output Models
# ---------------------------------------------------------------------------

class CleanedData(BaseModel):
    price:          float
    original_price: float | None = None
    currency:       str = "PKR"
    stock_status:   StockStatus = StockStatus.UNKNOWN
    seller_name:    str | None = None
    title:          str | None = None
    rating:         float | None = None
    review_count:   int | None = None


class ValidationResult(BaseModel):
    valid : bool
    should_cache : bool
    confidence : float

    data : CleanedData | None = None
    # source that produced that raw data
    extracted_by : str

    # diagnostic result
    flags : list[str] = []
    rejection_reason : str | None = None
    checks_passed : list[str] = []
    checks_failed : list[str] = []
    cleaning_applied : list[str] = []


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_price(raw: Any, label: str, cleaning_applied: list[str]) -> float | None:
    """
    Use price-parser to clean and extract a float from any raw price string.
    Handles PKR, lakh notation, European decimals, currency symbols etc.
    Returns None if unparseable.
    """
    if raw is None:
        return None

    raw_str = str(raw).strip()

    if not raw_str or raw_str.lower() in {"n/a", "-", "none", "null", "price", ""}:
        return None

    parsed = Price.fromstring(raw_str)

    if parsed.amount is None:
        logger.debug("price-parser could not parse: %r", raw_str)
        return None

    amount = float(parsed.amount)
    cleaning_applied.append(f"{label}: '{raw_str}' → {amount}")
    return amount


def _normalise_stock(raw: Any, cleaning_applied: list[str]) -> StockStatus:
    """
    Maps any raw stock string to a StockStatus enum value.
    Defaults to UNKNOWN rather than raising.
    """
    if raw is None:
        return StockStatus.UNKNOWN

    raw_str = str(raw).strip().lower()

    # Direct map lookup
    if raw_str in STOCK_NORMALISATION:
        result = STOCK_NORMALISATION[raw_str]
        cleaning_applied.append(f"stock: '{raw_str}' → {result}")
        return result

    # Pattern matching for dynamic strings
    if LIMITED_PATTERN.search(raw_str):
        cleaning_applied.append(f"stock: '{raw_str}' → limited (pattern match)")
        return StockStatus.LIMITED

    if SHIPS_IN_PATTERN.search(raw_str):
        cleaning_applied.append(f"stock: '{raw_str}' → pre_order (pattern match)")
        return StockStatus.PRE_ORDER

    # Partial match fallback
    for key, status in STOCK_NORMALISATION.items():
        if key in raw_str:
            cleaning_applied.append(f"stock: '{raw_str}' → {status} (partial match on '{key}')")
            return status

    cleaning_applied.append(f"stock: '{raw_str}' → unknown (no match)")
    return StockStatus.UNKNOWN


def _normalise_currency(raw: Any, domain: str | None, cleaning_applied: list[str]) -> str:
    """
    Normalises currency string. Falls back to domain-expected currency,
    then to PKR as the default market.
    """
    if raw:
        raw_str = str(raw).strip().lower()
        if raw_str in CURRENCY_ALIASES:
            result = CURRENCY_ALIASES[raw_str]
            cleaning_applied.append(f"currency: '{raw_str}' → {result}")
            return result
        # Already a valid 3-letter code
        if len(raw_str) == 3 and raw_str.isalpha():
            return raw_str.upper()

    # Fall back to domain expectation
    if domain:
        for domain_key, currency in DOMAIN_CURRENCY_MAP.items():
            if domain_key in domain:
                cleaning_applied.append(f"currency: fallback to domain default {currency}")
                return currency

    cleaning_applied.append("currency: no match, defaulting to PKR")
    return "PKR"


def _clean_seller_name(raw: Any) -> str | None:
    if not raw:
        return None
    cleaned = str(raw).strip()
    if len(cleaned) > 200:
        return cleaned[:200]     # truncate, don't discard
    if len(cleaned) < 2:
        return None
    return cleaned


def _clean_title(raw: Any) -> str | None:
    if not raw:
        return None
    cleaned = str(raw).strip()
    if len(cleaned) < 2:
        return None              # too short, likely extraction artifact
    if len(cleaned) > 1000:
        return cleaned[:1000]
    return cleaned


def _clean_rating(raw: Any, flags: list[str], checks_failed: list[str]) -> float | None:
    if raw is None:
        return None
    try:
        val = float(str(raw).strip())
    except (ValueError, TypeError):
        checks_failed.append("rating_not_numeric")
        return None

    if val < 0 or val > 5:
        checks_failed.append(f"rating_out_of_range:{val}")
        flags.append(f"Rating {val} is outside 0-5 range — discarded")
        return None

    return round(val, 1)


def _clean_review_count(raw: Any, flags: list[str], checks_failed: list[str]) -> int | None:
    if raw is None:
        return None
    try:
        # Strip commas like "1,234"
        val = int(str(raw).replace(",", "").strip())
    except (ValueError, TypeError):
        checks_failed.append("review_count_not_integer")
        return None

    if val < 0:
        checks_failed.append(f"review_count_negative:{val}")
        return None
    if val > 10_000_000:
        flags.append(f"Review count {val} suspiciously high — discarded")
        checks_failed.append("review_count_unrealistic")
        return None

    return val


def _verify_xpath_selector(selector: str, html: str, expected_price: float) -> bool:
    """
    Evaluates an XPath selector against HTML and checks if the result
    contains text that resolves to the expected price value.
    Result-based verification — not just existence check.
    """
    try:
        from lxml import etree
        from price_parser import Price

        parser = etree.HTMLParser()
        tree = etree.HTML(html,parser)
        results = tree.xpath(selector)

        if not results:
            return False

        for element in results[:5]:    # check first 5 matches
            text = element if isinstance(element, str) else (
                element.text_content() if hasattr(element, "text_content") else str(element)
            )
            parsed = Price.fromstring(str(text))
            if parsed.amount is not None:
                extracted = float(parsed.amount)
                # Allow 2% tolerance for floating point / display rounding
                if abs(extracted - expected_price) / max(expected_price, 1) < 0.02:
                    return True

        return False

    except Exception as e:
        logger.debug("XPath verification error: %s", e)
        return False


# ---------------------------------------------------------------------------
# Main validation function
# ---------------------------------------------------------------------------

def validate_extraction(
    raw_data:         dict[str, Any],
    source:           str,
    html:             str = "",
    last_known_price: float | None = None,
    domain:           str | None = None,
) -> ValidationResult:
    """
    Pure validation function.

    Parameters
    ----------
    raw_data          : dict returned by any extractor
    source            : which extractor produced it (ExtractionSource value)
    html              : original page HTML — used for selector/xpath verification
    last_known_price  : last confirmed price from DB, passed in by pipeline.py
    domain            : e.g. "daraz.pk" — for currency expectation checks

    Returns
    -------
    ValidationResult — always returned, never raises
    """

    flags:            list[str] = []
    checks_passed:    list[str] = []
    checks_failed:    list[str] = []
    cleaning_applied: list[str] = []

    # Helper to build a rejection result cleanly
    def reject(reason: str) -> ValidationResult:
        checks_failed.append(reason)
        logger.warning("Extraction rejected | source=%s domain=%s reason=%s", source, domain, reason)
        return ValidationResult(
            valid=False,
            should_cache=False,
            confidence=0.0,
            data=None,
            extracted_by=source,
            flags=flags,
            rejection_reason=reason,
            checks_passed=checks_passed,
            checks_failed=checks_failed,
            cleaning_applied=cleaning_applied,
        )

    # ------------------------------------------------------------------
    # LAYER 1 — Existence checks
    # ------------------------------------------------------------------

    if not raw_data:
        return reject("empty_extraction_result")

    raw_price = raw_data.get("price")
    if raw_price is None:
        return reject("price_missing")

    # Detect LLM hallucinations where field name is returned as value
    if isinstance(raw_price, str) and raw_price.lower().strip() in {
        "price", "n/a", "-", "none", "null", "contact for price", "call for price"
    }:
        return reject("price_is_placeholder_string")

    checks_passed.append("existence_check")

    # ------------------------------------------------------------------
    # LAYER 2 — Type coercion and cleaning
    # ------------------------------------------------------------------

    price = _parse_price(raw_price, "price", cleaning_applied)
    if price is None:
        return reject("price_unparseable")

    original_price = _parse_price(raw_data.get("original_price"), "original_price", cleaning_applied)
    currency       = _normalise_currency(raw_data.get("currency"), domain, cleaning_applied)
    stock_status   = _normalise_stock(raw_data.get("stock_status"), cleaning_applied)
    seller_name    = _clean_seller_name(raw_data.get("seller_name"))
    title          = _clean_title(raw_data.get("title"))
    rating         = _clean_rating(raw_data.get("rating"), flags, checks_failed)
    review_count   = _clean_review_count(raw_data.get("review_count"), flags, checks_failed)

    checks_passed.append("type_coercion")

    # ------------------------------------------------------------------
    # LAYER 3 — Sanity checks
    # ------------------------------------------------------------------

    if price <= 0:
        return reject("price_zero_or_negative")

    if price < PRICE_MIN:
        return reject(f"price_below_minimum:{price}")

    if price > PRICE_MAX:
        return reject(f"price_above_maximum:{price}")

    checks_passed.append("price_range_check")

    # Suspicious placeholder prices
    SUSPICIOUS_PRICES = {0.0, 1.0, 0.01, 999999.0, 9999999.0}
    if price in SUSPICIOUS_PRICES:
        flags.append(f"Price {price} is a known placeholder value")
        checks_failed.append("price_suspicious_placeholder")

    checks_passed.append("price_sanity")

    # ------------------------------------------------------------------
    # LAYER 4 — Cross-field consistency
    # ------------------------------------------------------------------

    if original_price is not None:
        if original_price < price:
            # Do NOT reject — surging/scalping is real market intelligence
            flags.append(
                f"Anomaly: current price {price} exceeds original {original_price}. "
                "Possible surge pricing or scalping. Data saved."
            )
            checks_failed.append("price_exceeds_original_anomaly")
        elif original_price == price:
            pass   # no active discount, perfectly fine
        elif original_price > price * 10:
            flags.append(
                f"original_price {original_price} is >10x current price {price}. "
                "Likely fake discount inflation."
            )
            checks_failed.append("original_price_inflated")

    checks_passed.append("cross_field_consistency")

    # in_stock with price=0 is a contradiction — already caught above
    # pre_order with a price is fine and common
    # out_of_stock with a price is fine and common

    # ------------------------------------------------------------------
    # LAYER 5 — Source-specific confidence baseline
    # ------------------------------------------------------------------

    confidence: float = SOURCE_BASELINE.get(source, 0.70)

    # ------------------------------------------------------------------
    # LAYER 6 — XPath / selector verification (LLM results only)
    # ------------------------------------------------------------------

    if source == ExtractionSource.LLM and html:
        xpath_selectors: dict = raw_data.get("xpath_selectors") or {}
        css_selectors:   dict = raw_data.get("css_selectors") or {}

        price_xpath = xpath_selectors.get("price") or css_selectors.get("price")

        if price_xpath and html:
            verified = _verify_xpath_selector(price_xpath, html, price)
            if verified:
                confidence += 0.10
                checks_passed.append("llm_selector_verified_against_result")
            else:
                confidence -= 0.20
                flags.append(
                    f"LLM-provided selector '{price_xpath}' did not resolve to "
                    f"the extracted price {price}. Selector may be fabricated."
                )
                checks_failed.append("llm_selector_unverified")
        else:
            # LLM returned no selectors — slight penalty
            confidence -= 0.05
            flags.append("LLM returned no selectors for caching")
            checks_failed.append("llm_no_selectors_returned")

    # ------------------------------------------------------------------
    # LAYER 7 — Temporal consistency (passed in by pipeline)
    # ------------------------------------------------------------------

    if last_known_price is not None and last_known_price > 0:
        change_pct = abs(price - last_known_price) / last_known_price

        if change_pct > 0.80:
            # 80%+ swing overnight is almost always an extraction error
            return reject(
                f"temporal_price_swing_too_large:{change_pct:.1%}_from_{last_known_price}_to_{price}"
            )

        elif change_pct > 0.50:
            # 50-80% — flag but save, could be a real flash sale
            confidence -= 0.15
            flags.append(
                f"Large price swing: {change_pct:.1%} change from {last_known_price} to {price}. "
                "Possible flash sale or extraction error."
            )
            checks_failed.append(f"temporal_large_swing:{change_pct:.1%}")

        elif change_pct > 0.30:
            confidence -= 0.05
            flags.append(f"Moderate price swing: {change_pct:.1%}")
            checks_failed.append(f"temporal_moderate_swing:{change_pct:.1%}")

        else:
            confidence += 0.05
            checks_passed.append("temporal_consistency_ok")

    # ------------------------------------------------------------------
    # LAYER 8 — Confidence modifiers
    # ------------------------------------------------------------------

    # Bonus: all key fields present
    all_fields_present = all([
        price is not None,
        stock_status != StockStatus.UNKNOWN,
        title is not None,
        seller_name is not None,
    ])
    if all_fields_present:
        confidence += 0.05
        checks_passed.append("all_key_fields_present")

    # Penalty: currency mismatch
    if domain:
        for domain_key, expected_currency in DOMAIN_CURRENCY_MAP.items():
            if domain_key in domain and currency != expected_currency:
                confidence -= 0.03
                flags.append(
                    f"Currency mismatch: got {currency}, expected {expected_currency} for {domain}"
                )
                checks_failed.append("currency_domain_mismatch")
                break

    # Clamp confidence to [0.0, 1.0]
    confidence = round(max(0.0, min(1.0, confidence)), 4)

    # ------------------------------------------------------------------
    # LAYER 9 — Final decision
    # ------------------------------------------------------------------

    if confidence < THRESHOLD_LOW:
        return reject(f"confidence_too_low:{confidence}")

    valid       = True
    should_cache = confidence >= THRESHOLD_HIGH

    if confidence < THRESHOLD_MEDIUM:
        flags.append(f"LOW CONFIDENCE ({confidence:.2f}) — snapshot saved with flag, admin notified")
    elif confidence < THRESHOLD_HIGH:
        flags.append(f"MEDIUM CONFIDENCE ({confidence:.2f}) — snapshot saved, config not cached")

    cleaned = CleanedData(
        price=price,
        original_price=original_price,
        currency=currency,
        stock_status=stock_status,
        seller_name=seller_name,
        title=title,
        rating=rating,
        review_count=review_count,
    )

    logger.info(
        "Validation passed | source=%s domain=%s price=%s confidence=%s cache=%s",
        source, domain, price, confidence, should_cache,
    )

    return ValidationResult(
        valid=valid,
        should_cache=should_cache,
        confidence=confidence,
        data=cleaned,
        extracted_by=source,
        flags=flags,
        rejection_reason=None,
        checks_passed=checks_passed,
        checks_failed=checks_failed,
        cleaning_applied=cleaning_applied,
    )