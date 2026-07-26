"""
pipeline/ai/query_generalizer.py

Turns a user's specific, marketing-heavy tracked_product.title into a
short, generalized search keyword suitable for a marketplace search
box — the thing a real shopper would type, not the full listing title.

WHY THIS IS A PLAIN FUNCTION, NOT A LANGGRAPH AGENT:
This is a single-shot classification/generation task — no multi-step
reasoning, no tool calls, no state to carry between turns. A plain
Gemini call with a tight system prompt and JSON output is the right
level of machinery for this.

Uses the official `google-genai` SDK, sync client — this module is
called from a sync FastAPI service function.

NEVER RAISES on API failure — falls back to returning the original
title unchanged. A failed AI call must never block product creation.
"""

import json
import logging
import re

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize the Gemini client using the new SDK standard
client = genai.Client(api_key=settings.GEMINI_API_KEY)

_MODEL_NAME = "gemini-2.0-flash"

_SYSTEM_PROMPT = """You turn a seller's full product listing title into a short, \
generalized search keyword — the phrase a real shopper would type into a \
marketplace search box to find this product AND its competitors.

Rules:
- Keep: brand, product type/category, the 1-2 specs that actually \
  distinguish this product in a search (e.g. capacity, size, model \
  family if it's commonly searched).
- Drop: marketing phrases, warranty terms, install/service offers, \
  redundant model-number variants, percentage/efficiency claims, \
  punctuation-heavy separators.
- Keep it to 3-6 words. Shorter is usually better — a keyword that is \
  too specific returns almost no results; too broad returns irrelevant \
  ones. Aim for the sweet spot a real shopper would use.
- Output ONLY valid JSON: {"keyword": "..."}. No other text.

Example:
Input: "Haier AC 1 Ton DC Inverter Split | Model AC HSU -13LF (New Model) / \
HSU-12LF | UPS Enabled Self Cleaning 67% Energy Saving Turbo Cooling - Wide \
Voltage - Full BTU | 10 Year Compressor 05 Year PCB 05 Year Evaporator \
Warranty | Haier Free Installation"
Output: {"keyword": "Haier 1 Ton DC Inverter AC"}
"""


def _extract_json(text: str) -> dict:
    """
    Gemini sometimes wraps JSON in markdown fences despite instructions
    not to. Strip those before parsing.
    """
    cleaned = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    return json.loads(cleaned)


def generalize_title(title: str) -> str:
    """
    Calls Gemini once to generalize one product title into a search
    keyword. Returns the original title unchanged on any failure.
    """
    if not title or not title.strip():
        return title

    try:
        response = client.models.generate_content(
            model=_MODEL_NAME,
            contents=title,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=100,
            ),
        )
        parsed = _extract_json(response.text)
        keyword = parsed.get("keyword", "").strip()

        if not keyword:
            logger.warning(
                f"[QueryGeneralizer] Empty keyword returned for title "
                f"{title[:60]!r}. Falling back to original title."
            )
            return title

        logger.info(
            f"[QueryGeneralizer] '{title[:60]}...' -> '{keyword}'"
        )
        return keyword

    except Exception as exc:
        logger.error(
            f"[QueryGeneralizer] Failed to generalize title "
            f"{title[:60]!r}: {exc}. Falling back to original title.",
            exc_info=True,
        )
        return title