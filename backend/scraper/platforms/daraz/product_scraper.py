"""
scraper/platforms/daraz/product_scraper.py

Scrapes a single Daraz product-detail page for one confirmed competitor
listing. The Daraz equivalent of Noon's product_scraper.py, but
structurally simpler: Daraz has no multi-seller offers[] array (each
itemId is already exactly one seller's one listing), so there's no
SKU-dedup/fan-out step here at all — one listing, one call, one result.

WHAT THIS FILE DOES NOT DO:
    - Does not touch the database
    - Does not decide which listings to scrape or in what order
      (that's the orchestration layer, built separately)
    - Does not manage the mtop token/header handshake — that's
      mtop_client.py's job; this file just calls it

WHY NO SKU-DEDUP/FAN-OUT (unlike Noon):
    Noon's product-page API returns every seller's offer for one SKU in
    a single call, so several confirmed listings sharing that SKU could
    share one HTTP call. Daraz's product-detail API is scoped to one
    itemId, which IS one specific seller's listing — there is no
    "other sellers of this exact item" data to fan out from. Every
    confirmed Daraz listing genuinely needs its own separate call.
"""

import logging
from typing import Optional

from scraper.platforms.daraz.mtop_client import MtopClient
from scraper.platforms.daraz.utils import (
    extract_uri_from_url,
    extract_sku_id_from_platform_sku,
    extract_product_detail,
)

logger = logging.getLogger(__name__)


async def scrape_product_page(
    mtop_client: MtopClient,
    listing_url: str,
    platform_sku: Optional[str] = None,
) -> Optional[dict]:
    """
    Scrapes one Daraz product-detail page for one confirmed competitor
    listing.

    Flow:
      1. Derive "uri" from the listing URL — the identifier the mtop
         endpoint expects (see utils.extract_uri_from_url).
      2. Derive the target skuId from the stored platform_sku, if
         given — this pins the fetch to the exact confirmed variant
         rather than whatever Daraz considers the "default" one.
      3. Call mtop_client.fetch_product_detail — handles the token
         handshake transparently, returns the raw (still
         double-encoded) response or None on any network/protocol
         failure.
      4. Parse via utils.extract_product_detail — resolves to the
         target variant's data, or falls back to
         primaryKey.defaultSkuId if no platform_sku was available yet
         (e.g. a listing discovered from a bare item-only URL, not yet
         backfilled with a specific variant).

    Args:
      mtop_client   : A single MtopClient instance, reused across every
                      listing scraped in this run — NOT created fresh
                      per call. This keeps the token/header locked in
                      for the life of the run, same reasoning as
                      Noon's session_manager being reused across calls.
      listing_url    : competitor_listings.url for this listing.
      platform_sku   : competitor_listings.platform_sku, if known —
                      Daraz's "cheapest_sku" format
                      ("{itemId}_{countryCode}-{skuId}"). Optional
                      because a listing discovered from a bare
                      item-only URL may not have this populated yet.

    Returns:
      None on any failure at any step (malformed URL, network error,
      both mtop handshake attempts failed, parse failure, target
      variant not found in the response) — caller skips this listing
      for this run, logs it, moves on. Never raises.

      On success: the flat dict returned by utils.extract_product_detail
      — item_id, sku_id, platform_sku, product_title, seller_name,
      seller_external_id, seller_positive_rating_pct, price,
      original_price, discount_pct, stock_status, stock_message,
      warranty, rating, review_count.
    """
    uri = extract_uri_from_url(listing_url)
    if uri is None:
        logger.warning(
            f"[ProductScraper] Could not extract uri from listing_url, "
            f"skipping: {listing_url[:80]}"
        )
        return None

    target_sku_id = extract_sku_id_from_platform_sku(platform_sku)
    if target_sku_id is None:
        logger.debug(
            f"[ProductScraper] No target_sku_id resolved from "
            f"platform_sku={platform_sku!r} — will fall back to "
            f"primaryKey.defaultSkuId for {uri}."
        )

    logger.info(f"[ProductScraper] Scraping | uri: {uri} | target_sku_id: {target_sku_id}")

    raw_response = await mtop_client.fetch_product_detail(listing_url, uri)
    if raw_response is None:
        logger.warning(f"[ProductScraper] fetch_product_detail returned None for {uri}.")
        return None

    result = extract_product_detail(raw_response, target_sku_id=target_sku_id)
    if result is None:
        logger.warning(
            f"[ProductScraper] extract_product_detail returned None for {uri} "
            f"(target_sku_id={target_sku_id})."
        )
        return None

    logger.info(
        f"[ProductScraper] Scraped {uri} successfully | "
        f"price={result.get('price')} | stock={result.get('stock_status')}"
    )
    return result