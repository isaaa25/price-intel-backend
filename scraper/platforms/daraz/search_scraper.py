"""
scraper/platforms/daraz/search_scraper.py

Scrapes Daraz search results for a keyword, via direct curl_cffi calls
to the unsigned catalog search endpoint. Confirmed via real captured
traffic: unlike the product-detail endpoint (mtop_client.py), this
endpoint carries no sign/appKey/t params at all — a plain GET with
realistic browser headers is sufficient. No token handshake, no
session state, no block-detection/refresh logic needed here at all —
genuinely simpler than Noon's search_scraper.py, since there's no
session layer to manage on this path.

RESPONSE SHAPE (per real captured structure):
    {
        "templates": [...],
        "mods": {...},
        "listItems": [ {...}, {...}, ... ],   <- the actual hits
        "mainInfo": {
            "totalResults": "2621",
            "pageSize": "40",
            "page": "3",
            ...
        }
    }
listItems holds the same hit shape utils.extract_search_hit already
parses (confirmed against real Dawlance/Samsung samples). mainInfo
gives us pagination: totalResults / pageSize tells us how many pages
exist; page confirms which page we're actually on.

HEADER STRATEGY:
    Reuses fetch_header_pool / get_random_header directly from
    mtop_client.py rather than duplicating them a second time — per
    agreement, since this is genuinely the same ScrapeOps pool logic,
    not a Daraz-search-specific variant of it.
"""

import logging
from typing import Optional
from urllib.parse import quote_plus

from curl_cffi.requests import AsyncSession

from scraper.platforms.daraz.mtop_client import (
    fetch_header_pool,
    get_random_header,
    IMPERSONATE_TARGET,
    _derive_sec_ch_ua,
    _FALLBACK_USER_AGENT,
)
from scraper.platforms.daraz.utils import extract_search_hit

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────

# Cap on how many listing pages to walk per keyword per discovery run.
# One page is ~40 listings (per mainInfo.pageSize observed in real
# traffic) — 1 page is often enough to surface the handful of real
# competitors for a given product; this stays a small, explicit limit
# rather than crawling deep into a 2000+ result category.
DEFAULT_MAX_PAGES = 1


# ─────────────────────────────────────────────────────────────────────────
# URL BUILDER
# ─────────────────────────────────────────────────────────────────────────

def build_search_api_url(domain: str, keyword: str, page: int) -> str:
    """
    Builds the minimal search API URL — deliberately stripped of the
    tracking-param tail seen in real captured URLs (clickTrackInfo,
    spm, sugg, etc.) since those are click-through/session artifacts
    from a real browser session, not required inputs for a cold search
    request. If this minimal version stops returning results, the
    tracking tail is the first thing to add back in.

    Args:
      domain  : e.g. "www.daraz.pk" — kept as a parameter (not
                hardcoded) so this works across all four Daraz country
                domains once multi-country scraping is built.
      keyword : search term, e.g. "micro wave oven"
      page    : 1-indexed page number

    Example:
        >>> build_search_api_url("www.daraz.pk", "micro wave oven", 1)
        'https://www.daraz.pk/catalog/?ajax=true&q=micro+wave+oven&page=1'
    """
    encoded_keyword = quote_plus(keyword)
    return f"https://{domain}/catalog/?ajax=true&q={encoded_keyword}&page={page}"


def build_referer_url(domain: str, keyword: str, page: int) -> str:
    """
    Builds the web page URL to use as the Referer header — the search
    API is an XHR call a real browser would fire from the search
    results page itself.
    """
    encoded_keyword = quote_plus(keyword)
    return f"https://{domain}/catalog/?q={encoded_keyword}&page={page}"


# ─────────────────────────────────────────────────────────────────────────
# HEADERS
# ─────────────────────────────────────────────────────────────────────────

def build_search_headers(referer: str, scrapeops_header: dict) -> dict[str, str]:
    """
    Headers for the plain (unsigned) search GET call. Fingerprint
    fields (user-agent, sec-ch-ua, etc.) come from the ScrapeOps header
    dict, same as mtop_client.py's build_request_headers — kept
    consistent across both Daraz files so a scrape run presents the
    same browser identity on both its search and product-detail calls.
    """
    user_agent = scrapeops_header.get("user-agent", _FALLBACK_USER_AGENT)
    sec_ch_ua = scrapeops_header.get("sec-ch-ua") or _derive_sec_ch_ua(user_agent)

    return {
        "accept": "application/json, text/plain, */*",
        "accept-language": scrapeops_header.get("accept-language", "en-US,en;q=0.9"),
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "referer": referer,
        "sec-ch-ua": sec_ch_ua,
        "sec-ch-ua-mobile": scrapeops_header.get("sec-ch-ua-mobile", "?0"),
        "sec-ch-ua-platform": scrapeops_header.get("sec-ch-ua-platform", '"Windows"'),
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": user_agent,
        "x-requested-with": "XMLHttpRequest",
    }


# ─────────────────────────────────────────────────────────────────────────
# SINGLE PAGE SCRAPER
# ─────────────────────────────────────────────────────────────────────────

async def scrape_search_page(
    session: AsyncSession,
    header: dict,
    domain: str,
    keyword: str,
    page: int,
) -> tuple[list[dict], Optional[int], Optional[int]]:
    """
    Scrapes a single search results page via direct API call.

    Returns:
      Tuple of (extracted_hits, total_results, page_size)
      extracted_hits : list of dicts from utils.extract_search_hit,
                        may be empty (genuinely no results, or a
                        malformed/blocked response — see logging below
                        for how to distinguish them).
      total_results   : mainInfo.totalResults as an int, or None if the
                        response didn't include it (unexpected shape).
      page_size        : mainInfo.pageSize as an int, or None likewise.
                        Caller uses total_results/page_size to decide
                        whether more pages exist worth walking.
    """
    api_url = build_search_api_url(domain, keyword, page)
    referer = build_referer_url(domain, keyword, page)
    headers = build_search_headers(referer, header)

    logger.info(f"[DarazSearch] [{keyword}] Page {page} | url: {api_url}")

    try:
        resp = await session.get(api_url, headers=headers, timeout=20)
    except Exception as exc:
        logger.error(f"[DarazSearch] [{keyword}] Network error on page {page}: {exc}")
        return [], None, None

    if resp.status_code != 200:
        logger.error(
            f"[DarazSearch] [{keyword}] Unexpected HTTP {resp.status_code} on page {page}."
        )
        return [], None, None

    try:
        data = resp.json()
        # print(data)
    except Exception as exc:
        logger.error(f"[DarazSearch] [{keyword}] Failed to parse JSON on page {page}: {exc}")
        return [], None, None

    list_items = data.get("mods", {}).get("listItems", [])
    main_info = data.get("mainInfo", {})

    total_results = None
    page_size = None
    try:
        if main_info.get("totalResults") is not None:
            total_results = int(main_info["totalResults"])
        if main_info.get("pageSize") is not None:
            page_size = int(main_info["pageSize"])
    except (ValueError, TypeError):
        logger.warning(
            f"[DarazSearch] [{keyword}] Could not parse totalResults/pageSize "
            f"from mainInfo on page {page}: {main_info}"
        )

    if not list_items:
        logger.warning(
            f"[DarazSearch] [{keyword}] Page {page} returned zero listItems. "
            f"Possible genuine no-results, or a blocked/malformed response — "
            f"total_results={total_results}."
        )
        return [], total_results, page_size

    extracted = []
    for hit in list_items:
        try:
            extracted.append(extract_search_hit(hit))
        except Exception as exc:
            logger.warning(
                f"[DarazSearch] [{keyword}] Failed to extract a hit on page "
                f"{page}: {exc} | raw item_id={hit.get('itemId', 'unknown')}"
            )

    logger.info(
        f"[DarazSearch] [{keyword}] Page {page}: "
        f"{len(extracted)}/{len(list_items)} hits extracted."
    )

    return extracted, total_results, page_size


# ─────────────────────────────────────────────────────────────────────────
# MAIN SEARCH SCRAPER
# ─────────────────────────────────────────────────────────────────────────

async def scrape_search(
    domain: str,
    keyword: str,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> list[dict]:
    """
    Scrapes up to max_pages of Daraz search results for a keyword,
    deduplicated by item_id across pages.

    Creates its own AsyncSession and picks one ScrapeOps header for the
    life of this call — locked in once, reused across every page
    requested, same fingerprint-consistency reasoning as
    mtop_client.py's MtopClient.

    No session/token state to manage, no block-detection/refresh logic
    (unlike Noon) — the only stopping conditions are: max_pages
    reached, or total_results/page_size indicates no further pages
    exist.

    Args:
      domain     : e.g. "www.daraz.pk"
      keyword    : search term, typically tracked_product.title
      max_pages  : defaults to DEFAULT_MAX_PAGES (1) — one page is
                   already ~40 listings, plenty to surface real
                   competitors without over-crawling a large category.

    Returns:
      Flat, deduplicated list of dicts (utils.extract_search_hit shape),
      ready for the loader to upsert into competitor_listings +
      price_snapshots.
    """
    pool = await fetch_header_pool()
    header = get_random_header(pool)

    all_hits: list[dict] = []
    seen_item_ids: set[str] = set()

    async with AsyncSession(impersonate=IMPERSONATE_TARGET) as session:
        for page in range(1, max_pages + 1):
            hits, total_results, page_size = await scrape_search_page(
                session, header, domain, keyword, page
            )

            for hit in hits:
                item_id = hit.get("item_id")
                if not item_id:
                    continue
                if item_id in seen_item_ids:
                    logger.debug(f"[DarazSearch] [{keyword}] Duplicate item_id skipped: {item_id}")
                    continue
                seen_item_ids.add(item_id)
                all_hits.append(hit)

            # Early stop once we've covered every available result.
            if total_results is not None and page_size is not None and page_size > 0:
                total_pages_available = -(-total_results // page_size)  # ceiling division
                if page >= total_pages_available:
                    logger.info(
                        f"[DarazSearch] [{keyword}] Reached last available page "
                        f"({page}/{total_pages_available}). Stopping early."
                    )
                    break

    logger.info(
        f"[DarazSearch] [{keyword}] Scrape complete. "
        f"Total unique listings: {len(all_hits)}."
    )
    return all_hits