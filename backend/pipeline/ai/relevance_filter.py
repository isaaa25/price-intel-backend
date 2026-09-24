"""
pipeline/ai/relevance_filter.py

Post-search relevance filter for discovery mode.

After the search scraper returns a list of listings for a generalized
keyword, this module asks Gemini which of those titles are actual
competing products (same model / close variants a buyer would compare
on price) versus noise (cases, covers, chargers, accessories,
"compatible with", completely different products, etc.).

Design choices:
  - One LLM call per tracked product (batch of all titles).
  - Title-only decision for now (price can be added later).
  - Structured JSON output with relevant indices.
  - Fail-open: on any error we return the original list so discovery
    never breaks because of the filter.
"""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

_MODEL_NAME = "gemini-2.5-flash"


class RelevanceResult(BaseModel):
    relevant_indices: list[int] = Field(
        ...,
        description="0-based indices of listings that are real competing products"
    )


_SYSTEM_PROMPT = """You are an expert e-commerce relevance filter used by a professional price-monitoring system that works across multiple marketplaces (Daraz, Noon, Amazon, etc.) and every possible product category.

Your single task:
Given a search keyword + an optional original product title + a numbered list of product titles returned by marketplace search, decide which of those titles represent REAL competing products that a buyer would actually compare on price.

You must work correctly for ANY product type: smartphones, laptops, ACs, TVs, refrigerators, washing machines, microwave ovens, headphones, cameras, furniture, kitchen appliances, clothing, shoes, beauty products, groceries, auto parts, tools, toys, books, etc.

### Core Principle
Keep a listing ONLY if it is a genuine alternative of the SAME core product (or a very close variant) that a rational price-conscious buyer would put side-by-side when deciding which one to buy.

Drop everything else.

### What to KEEP
- Exact same model / product family
- Same model with different capacity, size, storage, color, or minor configuration (e.g. 128GB vs 256GB, 1 Ton vs 1.5 Ton, 55" vs 65")
- Official brand sellers and third-party sellers of the identical product
- Close variants that still serve the exact same primary use case and would be considered direct substitutes
- Different colorways or regional versions of the same product when the core specs remain the same

### What to DROP (noise / non-competitors)
- Accessories and peripherals of any kind:
  - Cases, covers, screen protectors, tempered glass, skins
  - Chargers, cables, adapters, power banks, docks
  - Headphones, earbuds, speakers, stands, mounts, holders, bags, pouches
  - Spare parts, replacement batteries, filters, remote controls
- "Compatible with / for / fits / designed for [model]" items
- Completely different products that only share some words from the keyword
- Bundles that are primarily an accessory + the main product as a freebie
- Services, warranties, installation packages sold separately
- Completely unrelated categories that happen to contain similar words
- Obvious counterfeit or extremely suspicious titles that are not the real product

### Decision Guidelines (balanced precision + recall)
- When a listing is clearly an accessory → DROP
- When a listing is a close variant of the same product → KEEP
- When you are genuinely unsure whether it is a real competing unit or an accessory → KEEP (we prefer not to lose real competitors)
- Never invent specifications that are not present in the titles
- Base your decision ONLY on the information given (search keyword, original title, and the list of titles)
- Do not use external knowledge about prices or current market status

### Output Format (STRICT)
Return ONLY a valid JSON object in this exact format:
{"relevant_indices": [0, 2, 5, 7]}

- The numbers are 0-based indices referring to the numbered list of titles you receive.
- If none of the listings are relevant, return {"relevant_indices": []}.
- No explanations, no markdown, no comments, no extra text of any kind.

### Examples of correct reasoning (for your internal understanding only — do not output reasoning)

Example 1 – Smartphone
Search keyword: "Google Pixel 7 Pro 256GB"
Titles:
0. Google Pixel 7 Pro 256GB – Just Like New
1. Google Pixel 7 Pro Soft Silicone Case
2. Google Pixel 7 Pro 128GB Unlocked
3. Pixel 7 Pro Screen Protector Tempered Glass
4. Google Pixel 7 Pro 256GB – Official
→ relevant_indices: [0, 2, 4]

Example 2 – Air Conditioner
Search keyword: "Haier 1 Ton DC Inverter AC"
Titles:
0. Haier 1.0 Ton DC Inverter Split AC HSU-12
1. Haier AC Remote Control Compatible
2. Haier 1 Ton Inverter AC with Copper Condenser
3. 1 Ton AC Installation Kit
4. Haier 1.5 Ton DC Inverter AC
→ relevant_indices: [0, 2, 4]

Example 3 – Television
Search keyword: "LG 55 Inch OLED TV"
Titles:
0. LG OLED55C3 55 Inch 4K Smart OLED TV
1. LG 55 Inch TV Wall Mount Bracket
2. Samsung 55 Inch OLED TV
3. LG Magic Remote for OLED TVs
4. LG 65 Inch OLED TV
→ relevant_indices: [0, 2, 4]

Example 4 – Microwave
Search keyword: "Dawlance Microwave Oven 20L"
Titles:
0. Dawlance DW-210 Solo Microwave 20L
1. Microwave Oven Glass Turntable Plate 20L
2. Dawlance 20 Litre Microwave with Grill
3. Microwave Stand / Trolley
→ relevant_indices: [0, 2]

Example 5 – Headphones
Search keyword: "Sony WH-1000XM5"
Titles:
0. Sony WH-1000XM5 Wireless Noise Cancelling Headphones
1. Sony WH-1000XM5 Ear Cushions Replacement
2. Sony WH-1000XM4
3. Sony WH-1000XM5 Carrying Case
→ relevant_indices: [0, 2]

These examples illustrate the spirit. Apply the same logic to every other category you encounter.
"""


def _build_user_content(
    search_keyword: str,
    original_title: str | None,
    titles: list[str],
) -> str:
    lines = [
        f"Search keyword: {search_keyword}",
    ]
    if original_title:
        lines.append(f"Original product title: {original_title}")
    lines.append("")
    lines.append("Listings (0-based index):")
    for i, t in enumerate(titles):
        lines.append(f"{i}. {t}")
    return "\n".join(lines)


async def filter_relevant_listings(
    search_keyword: str,
    original_title: str | None,
    raw_listings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Filters a list of raw search hits, keeping only those whose titles
    are judged relevant competitors for the given search keyword.

    Args:
        search_keyword: The generalized keyword that was used for search.
        original_title: The full original title of the tracked product
                        (optional extra context for the model).
        raw_listings:   List of dicts returned by scrape_search
                        (each must contain a "name" key).

    Returns:
        A new list containing only the relevant raw listing dicts.
        On any failure the original list is returned unchanged (fail-open).
    """
    if not raw_listings:
        return raw_listings

    titles = []
    for item in raw_listings:
        name = (item.get("name") or item.get("product_title") or "").strip()
        titles.append(name if name else "(no title)")

    user_content = _build_user_content(search_keyword, original_title, titles)

    try:
        response = client.models.generate_content(
            model=_MODEL_NAME,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.0,
                max_output_tokens=1024,
                response_mime_type="application/json",
                response_json_schema=RelevanceResult.model_json_schema(),
            ),
        )

        if response.parsed:
            if isinstance(response.parsed, dict):
                indices = response.parsed.get("relevant_indices", [])
            else:
                indices = getattr(response.parsed, "relevant_indices", [])
        else:
            text = (response.text or "").strip()
            if not text:
                raise ValueError(
                    f"Empty response. finish_reason="
                    f"{getattr(response.candidates[0], 'finish_reason', None) if response.candidates else None}"
                )
            data = json.loads(text)
            indices = data.get("relevant_indices", [])

        # Safety: only keep valid integer indices inside range
        valid_indices = {
            i for i in indices
            if isinstance(i, int) and 0 <= i < len(raw_listings)
        }

        filtered = [raw_listings[i] for i in sorted(valid_indices)]

        dropped = len(raw_listings) - len(filtered)
        logger.info(
            f"[RelevanceFilter] keyword={search_keyword!r} | "
            f"kept={len(filtered)} | dropped={dropped} | total={len(raw_listings)}"
        )

        return filtered

    except Exception as exc:
        logger.error(
            f"[RelevanceFilter] Failed for keyword={search_keyword!r}: {exc}",
            exc_info=True,
        )
        # Fail-open: never break discovery because of the filter
        return raw_listings