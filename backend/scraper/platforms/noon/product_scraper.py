"""
scraper/platforms/noon/product_scraper.py

Scrapes a single Noon product-page API endpoint to get every seller's
current offer for one SKU (used for monitoring confirmed competitor
listings — see utils.py's build_product_api_url / extract_sku_from_url).

ARCHITECTURE: identical pattern to search_scraper.py's scrape_page().
Same SessionManager lifecycle (ensure_valid → get_headers/get_proxy →
curl_cffi call → status handling → log_request), same curl_cffi
impersonation target, same block-detection philosophy. This function
deliberately mirrors that one line-for-line where the shapes allow it,
so anyone who understands search_scraper.py already understands this.

WHAT'S DIFFERENT FROM SEARCH:
  Response shape    — offers live at product.variants[0].offers, not a
                       top-level hits[] array.
  No pagination      — one SKU, one call, one response. No page loop.
  No silent-block     — search always has results for a real keyword,
    detection            so two empty pages in a row means a soft block.
                       A single product can legitimately have zero
                       offers (delisted, out of stock everywhere) — a
                       missing/empty offers array here is real data,
                       not a block signal. Only 403 / non-200 / network
                       errors are treated as blocks, same as search.
  Return shape        — raw (offers, product_rating) tuple, NOT parsed
                       into price_snapshots/listing_signals rows. That
                       transform is utils.py's job (extract_offer,
                       extract_signals) — this function's only
                       responsibility is "did the network call succeed
                       and does the response have the shape we expect."

WHAT THIS FUNCTION DOES NOT DO:
  - Does not call extract_offer() or extract_signals()
  - Does not touch the database
  - Does not decide which offers match which competitor_listings
  All of that is Step 4 (the loader), which consumes this function's
  return value.
"""

import logging
from typing import Optional

from curl_cffi.requests import AsyncSession

from scraper.platforms.noon.session_manager import SessionManager
from scraper.platforms.noon.utils import build_product_api_url

logger = logging.getLogger(__name__)


# Same impersonation target as search_scraper.py — must stay in sync
# with whatever Chrome version the bootstrap browser used.
IMPERSONATE_TARGET = "chrome146"


async def scrape_product_page(
    session_manager: SessionManager,
    listing_url: str,
) -> Optional[tuple[list[dict], Optional[dict]]]:
    """
    Scrapes the product-page API for one competitor listing's URL.

    Flow (mirrors search_scraper.scrape_page):
      1. ensure_valid()        — JWT refresh or rebootstrap if needed
      2. Build URLs             — API URL to call, referer for headers
      3. Build headers          — full ordered header set from SessionManager
      4. curl_cffi GET          — direct API hit with Chrome TLS fingerprint
      5. Response handling      — 200/403/error cases
      6. Shape validation       — confirm product/variants/offers exist
      7. log_request()          — increment counters

    Referer: confirmed via real network capture to be the exact frontend
    product page URL, INCLUDING its "?o=<offer_code>" query string when
    present (e.g. "https://www.noon.com/saudi-en/.../N70142935V/p/
    ?o=c3ff482177ffc9fd"). Unlike build_product_api_url (which strips the
    query string to avoid pinning the API call to one seller), the
    referer header should be passed through as close to the original
    listing_url as possible — it only needs to look like a real page a
    browser was sitting on, it does not affect which offers come back.

    Args:
      session_manager : The active SessionManager instance.
      listing_url      : competitor_listings.url — the frontend product
                        page URL for this listing, in whatever locale
                        it was captured in (e.g. "uae-en", "saudi-en").

    Returns:
      None on any failure (network error, block, non-200, malformed or
      unexpected JSON shape) — caller skips this listing for this run.

      On success: (offers, product_rating)
        offers          : raw list of offer dicts from
                          product["variants"][0]["offers"]. May be an
                          empty list — that's valid data (e.g. a
                          delisted or fully out-of-stock product), not
                          an error.
        product_rating   : raw dict from product.get("product_rating"),
                          or None if absent. Shared across every offer
                          for this SKU — pass it to extract_offer() for
                          each offer in the loop, don't re-derive it
                          per-offer.
    """
    # ── Step 1: Ensure session is valid before every request ──────────────
    await session_manager.ensure_valid()

    # ── Step 2: Build URLs ─────────────────────────────────────────────────
    api_url = build_product_api_url(listing_url)
    # Referer matches the original listing URL exactly, including any
    # "?o=" query string — confirmed against a real network capture.
    referer = listing_url

    logger.info(f"[ProductPage] Scraping | url: {api_url}")

    # ── Step 3: Get headers and proxy from session ─────────────────────────
    headers = session_manager.get_headers(referer)
    proxy = session_manager.get_proxy()

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
        # SessionManager's ensure_valid() will handle re-bootstrap on
        # next call if the session is the cause.
        logger.error(f"[ProductPage] Network error scraping {api_url}: {exc}")
        return None

    # ── Step 5: Handle HTTP response codes ────────────────────────────────

    if resp.status_code == 403:
        # Hard block — Akamai has explicitly rejected this session.
        logger.warning(
            f"[ProductPage] HTTP 403 scraping {api_url}. "
            f"Session blocked. Triggering handle_block()."
        )
        await session_manager.handle_block()
        return None

    if resp.status_code != 200:
        logger.error(
            f"[ProductPage] Unexpected HTTP {resp.status_code} scraping {api_url}."
        )
        return None

    # ── Step 6: Parse the JSON response ───────────────────────────────────
    try:
        data = resp.json()
    except Exception as exc:
        logger.error(f"[ProductPage] Failed to parse JSON from {api_url}: {exc}")
        return None

    # ── Step 7: Validate the expected response shape ──────────────────────
    # Defensive at every level — a missing/empty structure here is either
    # a genuinely delisted product (real information, log as info/warning,
    # not an error) or an unexpected API change (worth a distinct warning
    # so it doesn't get confused with the normal "no offers" case).
    product = data.get("product")
    if not product:
        logger.warning(
            f"[ProductPage] No 'product' key in response for {api_url}. "
            f"Listing may have been delisted or the API shape changed."
        )
        return None

    variants = product.get("variants")
    if not variants:
        logger.warning(
            f"[ProductPage] 'product' present but 'variants' empty/missing "
            f"for {api_url}. Treating as no data available."
        )
        return None

    offers = variants[0].get("offers")
    if offers is None:
        logger.warning(
            f"[ProductPage] variants[0] has no 'offers' key for {api_url}. "
            f"Unexpected API shape."
        )
        return None

    if not offers:
        # A genuinely empty offers list — valid, means nobody is
        # currently selling this SKU. Not an error, just worth noting.
        logger.info(f"[ProductPage] Zero offers returned for {api_url}.")

    product_rating = product.get("product_rating")

    logger.info(
        f"[ProductPage] Scraped {len(offers)} offer(s) for {api_url}."
    )

    # ── Step 8: Log the successful request ────────────────────────────────
    session_manager.log_request()

    return offers, product_rating