"""


Single source of truth for:
  - Parsing Noon / Daraz URLs → marketplace, country, currency
  - Validating store / product / competitor URLs against an expected store

v1 = domain-level checks only (no HTTP fetch, no deep path rules).
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse




COUNTRY_CURRENCY: dict[str, str] = {
    "UAE": "AED",
    "Saudi Arabia": "SAR",
    "Egypt": "EGP",
    "Kuwait": "KWD",
    "Qatar": "QAR",
    "Bahrain": "BHD",
    "Pakistan": "PKR",
    "Bangladesh": "BDT",
    "Nepal": "NPR",
    "Myanmar": "MMK",
}


NOON_PATH_COUNTRY: dict[str, str] = {
    "uae-en": "UAE",
    "uae-ar": "UAE",
    "saudi-en": "Saudi Arabia",
    "saudi-ar": "Saudi Arabia",
    "egypt-en": "Egypt",
    "egypt-ar": "Egypt",
    "kuwait-en": "Kuwait",
    "kuwait-ar": "Kuwait",
    "qatar-en": "Qatar",
    "qatar-ar": "Qatar",
    "bahrain-en": "Bahrain",
    "bahrain-ar": "Bahrain",
}


DARAZ_HOST_COUNTRY: dict[str, str] = {
    "daraz.pk": "Pakistan",
    "daraz.com.bd": "Bangladesh",
    "daraz.com.np": "Nepal",
    "daraz.com.mm": "Myanmar",
}


@dataclass(frozen=True)
class ParsedMarketplaceUrl:
    marketplace: str        
    country: str              
    currency: str
    host: str                 


class MarketplaceUrlError(ValueError):
    """Raised when a URL is not a supported Noon/Daraz link."""
    pass


def currency_for_country(country: str) -> str:
    currency = COUNTRY_CURRENCY.get(country)
    if not currency:
        raise MarketplaceUrlError(
            f"No currency mapped for country={country!r}."
        )
    return currency


def _normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        raise MarketplaceUrlError("URL is required.")
    if not raw.lower().startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def _normalized_host(netloc: str) -> str:
    host = (netloc or "").lower().strip()
    if host.startswith("www."):
        host = host[4:]
    # Drop port if present
    if ":" in host:
        host = host.split(":", 1)[0]
    return host


def parse_marketplace_url(url: str) -> ParsedMarketplaceUrl:
    """
    Parse a Noon or Daraz URL into marketplace + country + currency.

    Raises MarketplaceUrlError if the URL is not supported.
    """
    normalized = _normalize_url(url)
    parsed = urlparse(normalized)
    host = _normalized_host(parsed.netloc)

    if not host:
        raise MarketplaceUrlError(
            "Could not read a hostname from this URL. "
            "Paste a full Noon or Daraz link."
        )

    # ── Daraz ────────────────────────────────────────────────────────────
    for daraz_host, country in DARAZ_HOST_COUNTRY.items():
        if host == daraz_host or host.endswith("." + daraz_host):
            return ParsedMarketplaceUrl(
                marketplace="daraz",
                country=country,
                currency=currency_for_country(country),
                host=host,
            )

    # ── Noon ─────────────────────────────────────────────────────────────
    if "noon.com" in host:
        path = (parsed.path or "").lower()
        segments = [s for s in path.split("/") if s]
        country = None
        for seg in segments:
            if seg in NOON_PATH_COUNTRY:
                country = NOON_PATH_COUNTRY[seg]
                break
        if country is None:
            raise MarketplaceUrlError(
                "Noon URL must include a country segment "
                "(e.g. /uae-en/, /saudi-en/, /egypt-en/). "
                f"Got: {url!r}"
            )
        return ParsedMarketplaceUrl(
            marketplace="noon",
            country=country,
            currency=currency_for_country(country),
            host=host,
        )

    raise MarketplaceUrlError(
        "URL must be a supported Noon or Daraz link "
        "(e.g. https://www.noon.com/uae-en/... or https://www.daraz.pk/...). "
        f"Got: {url!r}"
    )


def validate_store_url(url: str) -> ParsedMarketplaceUrl:
    """Validate a store URL (same domain rules as any marketplace URL)."""
    return parse_marketplace_url(url)


def validate_product_url(
    url: str,
    expected_marketplace: str,
    expected_country: str,
) -> ParsedMarketplaceUrl:
    """
    Validate a product or competitor URL against the store's marketplace + country.
    """
    info = parse_marketplace_url(url)

    exp_m = (expected_marketplace or "").strip().lower()
    exp_c = (expected_country or "").strip()

    if info.marketplace != exp_m:
        raise MarketplaceUrlError(
            f"URL is a {info.marketplace.title()} link, but this store is "
            f"{exp_m.title()}. Use a {exp_m.title()} product URL."
        )

    if info.country != exp_c:
        raise MarketplaceUrlError(
            f"URL is for {info.country}, but this store is {exp_c}. "
            f"Use a {exp_c} product URL."
        )

    return info