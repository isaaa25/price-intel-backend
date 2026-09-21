# # """
# # pipeline/ai/query_generalizer.py

# # Turns a user's specific, marketing-heavy tracked_product.title into a
# # short, generalized search keyword suitable for a marketplace search
# # box — the thing a real shopper would type, not the full listing title.

# # WHY THIS IS A PLAIN FUNCTION, NOT A LANGGRAPH AGENT:
# # This is a single-shot classification/generation task — no multi-step
# # reasoning, no tool calls, no state to carry between turns. A plain
# # Gemini call with a tight system prompt and JSON output is the right
# # level of machinery for this.

# # Uses the official `google-genai` SDK, sync client — this module is
# # called from a sync FastAPI service function.

# # NEVER RAISES on API failure — falls back to returning the original
# # title unchanged. A failed AI call must never block product creation.
# # """

# # import json
# # import logging
# # import re

# # from google import genai
# # from google.genai import types

# # from app.config import settings

# # logger = logging.getLogger(__name__)

# # # Initialize the Gemini client using the new SDK standard
# # client = genai.Client(api_key=settings.GEMINI_API_KEY)

# # _MODEL_NAME = "gemini-2.5-flash"

# # _SYSTEM_PROMPT = """You turn a seller's full product listing title into a short, \
# # generalized search keyword — the phrase a real shopper would type into a \
# # marketplace search box to find this product AND its competitors.

# # Rules:
# # - Keep: brand, product type/category, the 1-2 specs that actually \
# #   distinguish this product in a search (e.g. capacity, size, model \
# #   family if it's commonly searched).
# # - Drop: marketing phrases, warranty terms, install/service offers, \
# #   redundant model-number variants, percentage/efficiency claims, \
# #   punctuation-heavy separators.
# # - Keep it to 3-6 words. Shorter is usually better — a keyword that is \
# #   too specific returns almost no results; too broad returns irrelevant \
# #   ones. Aim for the sweet spot a real shopper would use.
# # - Output ONLY valid JSON: {"keyword": "..."}. No other text.

# # Example:
# # Input: "Haier AC 1 Ton DC Inverter Split | Model AC HSU -13LF (New Model) / \
# # HSU-12LF | UPS Enabled Self Cleaning 67% Energy Saving Turbo Cooling - Wide \
# # Voltage - Full BTU | 10 Year Compressor 05 Year PCB 05 Year Evaporator \
# # Warranty | Haier Free Installation"
# # Output: {"keyword": "Haier 1 Ton DC Inverter AC"}
# # """


# # def _extract_json(text: str) -> dict:
# #     """
# #     Gemini sometimes wraps JSON in markdown fences despite instructions
# #     not to. Strip those before parsing.
# #     """
# #     cleaned = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
# #     return json.loads(cleaned)


# # def generalize_title(title: str) -> str:
# #     """
# #     Calls Gemini once to generalize one product title into a search
# #     keyword. Returns the original title unchanged on any failure.
# #     """
# #     if not title or not title.strip():
# #         return title

# #     try:
# #         response = client.models.generate_content(
# #             model=_MODEL_NAME,
# #             contents=title,
# #             config=types.GenerateContentConfig(
# #                 system_instruction=_SYSTEM_PROMPT,
# #                 temperature=0.2,
# #                 max_output_tokens=100,
# #             ),
# #         )
# #         parsed = _extract_json(response.text)
# #         keyword = parsed.get("keyword", "").strip()

# #         if not keyword:
# #             logger.warning(
# #                 f"[QueryGeneralizer] Empty keyword returned for title "
# #                 f"{title[:60]!r}. Falling back to original title."
# #             )
# #             return title

# #         logger.info(
# #             f"[QueryGeneralizer] '{title[:60]}...' -> '{keyword}'"
# #         )
# #         return keyword

# #     except Exception as exc:
# #         logger.error(
# #             f"[QueryGeneralizer] Failed to generalize title "
# #             f"{title[:60]!r}: {exc}. Falling back to original title.",
# #             exc_info=True,
# #         )
# #         return title
    

# # keyword = "Samsung Galaxy A57 5G 8GB RAM 256GB ROM 50.0 MP + 12.0 MP + 5.0 MP Back Camera 5000 mAh Battery 1 Year Brand Warranty"
# # # now let's check either this is working fine or not we can call the function and print the result
# # result = generalize_title(keyword)
# # print(f"Original title: {keyword}")
# # print(f"Generalized keyword: {result}")

# # pipeline/ai/query_generalizer.py

# import json
# import logging
# from typing import Optional

# from google import genai
# from google.genai import types
# from pydantic import BaseModel, Field

# from app.config import settings

# logger = logging.getLogger(__name__)

# client = genai.Client(api_key=settings.GEMINI_API_KEY)

# _MODEL_NAME = "gemini-2.5-flash"   # still valid and good for this task


# class KeywordResult(BaseModel):
#     keyword: str = Field(
#         ...,
#         description="Short 3-6 word search keyword a real shopper would type"
#     )


# _SYSTEM_PROMPT = """You turn a seller's full product listing title into a short, 
# generalized search keyword — the phrase a real shopper would type into a 
# marketplace search box to find this product AND its competitors.

# Rules:
# - Keep: brand, product type/category, the 1-2 most important distinguishing specs 
#   (capacity, size, model family if commonly searched).
# - Drop: marketing phrases, warranty terms, install/service offers, 
#   redundant model-number variants, percentage claims, punctuation-heavy separators.
# - Keep it to 3-6 words. Shorter is usually better.
# - Aim for the sweet spot a real shopper would actually type.

# Examples:
# Input: "Haier AC 1 Ton DC Inverter Split | Model AC HSU -13LF (New Model) / HSU-12LF | UPS Enabled Self Cleaning 67% Energy Saving..."
# Output keyword: "Haier 1 Ton DC Inverter AC"

# Input: "Samsung Galaxy A57 5G 8GB RAM 256GB ROM 50.0 MP + 12.0 MP + 5.0 MP Back Camera 5000 mAh Battery 1 Year Brand Warranty"
# Output keyword: "Samsung Galaxy A57 5G"
# """


# # def generalize_title(title: str) -> str:
# #     """
# #     Calls Gemini once to generalize one product title into a search keyword.
# #     Returns the original title unchanged on any failure.
# #     """
# #     if not title or not title.strip():
# #         return title

# #     try:
# #         response = client.models.generate_content(
# #             model=_MODEL_NAME,
# #             contents=title,
# #             config=types.GenerateContentConfig(
# #                 system_instruction=_SYSTEM_PROMPT,
# #                 temperature=0.1,                    # lower = more consistent
# #                 max_output_tokens=150,              # enough headroom
# #                 response_mime_type="application/json",
# #                 response_json_schema=KeywordResult.model_json_schema(),
# #             ),
# #         )

# #         # Preferred: use the already-parsed object
# #         if response.parsed and isinstance(response.parsed, dict):
# #             keyword = response.parsed.get("keyword", "").strip()
# #         else:
# #             # Fallback parse
# #             text = (response.text or "").strip()
# #             if not text:
# #                 raise ValueError("Empty response from Gemini")
# #             data = json.loads(text)
# #             keyword = data.get("keyword", "").strip()

# #         if not keyword:
# #             logger.warning(f"[QueryGeneralizer] Empty keyword for title {title[:60]!r}")
# #             return title

# #         logger.info(f"[QueryGeneralizer] '{title[:60]}...' → '{keyword}'")
# #         return keyword

# #     except Exception as exc:
# #         logger.error(
# #             f"[QueryGeneralizer] Failed for title {title[:60]!r}: {exc}. "
# #             "Falling back to original title.",
# #             exc_info=True,
# #         )
# #         return title
# def generalize_title(title: str) -> str:
#     if not title or not title.strip():
#         return title

#     try:
#         response = client.models.generate_content(
#             model=_MODEL_NAME,
#             contents=title,
#             config=types.GenerateContentConfig(
#                 system_instruction=_SYSTEM_PROMPT,
#                 temperature=0.1,
#                 max_output_tokens=256,          # increased
#                 response_mime_type="application/json",
#                 response_json_schema=KeywordResult.model_json_schema(),
#             ),
#         )

#         # ========== DEBUG: print everything ==========
#         print("\n" + "="*60)
#         print("FULL RESPONSE DEBUG")
#         print("="*60)
#         print("response.text          :", repr(response.text))
#         print("response.parsed        :", response.parsed)
#         print("candidates             :", response.candidates)
#         if response.candidates:
#             cand = response.candidates[0]
#             print("finish_reason          :", cand.finish_reason)
#             print("safety_ratings         :", cand.safety_ratings)
#             print("content                :", cand.content)
#         print("prompt_feedback        :", response.prompt_feedback)
#         print("usage_metadata         :", response.usage_metadata)
#         print("="*60 + "\n")
#         # =============================================

#         # Try to extract keyword
#         if response.parsed:
#             if isinstance(response.parsed, dict):
#                 keyword = response.parsed.get("keyword", "").strip()
#             else:
#                 # Sometimes it's already a Pydantic object
#                 keyword = getattr(response.parsed, "keyword", "").strip()
#         else:
#             text = (response.text or "").strip()
#             if not text:
#                 raise ValueError("Empty response from Gemini")
#             data = json.loads(text)
#             keyword = data.get("keyword", "").strip()

#         if not keyword:
#             logger.warning(f"[QueryGeneralizer] Empty keyword for {title[:60]!r}")
#             return title

#         logger.info(f"[QueryGeneralizer] '{title[:60]}...' → '{keyword}'")
#         return keyword

#     except Exception as exc:
#         logger.error(
#             f"[QueryGeneralizer] Failed for title {title[:60]!r}: {exc}",
#             exc_info=True,
#         )
#         return title
# pipeline/ai/query_generalizer.py

import json
import logging
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

_MODEL_NAME = "gemini-2.5-flash"


class KeywordResult(BaseModel):
    keyword: str = Field(..., description="Short 3-6 word search keyword")


_SYSTEM_PROMPT = """You turn a full product listing title into a short search keyword that a real shopper would type into a marketplace search box.

Rules:
- Keep brand + product type + the 1-2 most important specs (capacity, size, model family).
- Drop all marketing language, warranty, installation offers, percentages, model variants.
- Output 3-6 words maximum.
- Respond with ONLY the JSON object. No other text.

Examples:
"Haier AC 1 Ton DC Inverter Split | Model AC HSU-13LF ..." → {"keyword": "Haier 1 Ton DC Inverter AC"}
"Samsung Galaxy A57 5G 8GB RAM 256GB ..." → {"keyword": "Samsung Galaxy A57 5G"}
"Apple iPhone 15 Pro Max (256 GB) - Natural Titanium ..." → {"keyword": "iPhone 15 Pro Max 256GB"}
"Sony WH-1000XM5 Wireless Noise Canceling Headphones Black" → {"keyword": "Sony WH-1000XM5"}
"""


def generalize_title(title: str) -> str:
    if not title or not title.strip():
        return title

    try:
        response = client.models.generate_content(
            model=_MODEL_NAME,
            contents=title,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.0,
                max_output_tokens=1024,          # Important: give plenty of room
                response_mime_type="application/json",
                response_json_schema=KeywordResult.model_json_schema(),
                # Disable thinking if the SDK supports it (newer versions)
                # thinking_config=types.ThinkingConfig(thinking_budget=0),  # try this if available
            ),
        )

        # Preferred path
        if response.parsed:
            if isinstance(response.parsed, dict):
                keyword = response.parsed.get("keyword", "").strip()
            else:
                keyword = getattr(response.parsed, "keyword", "").strip()
        else:
            text = (response.text or "").strip()
            if not text:
                raise ValueError(f"Empty response. finish_reason={getattr(response.candidates[0], 'finish_reason', None) if response.candidates else None}")
            data = json.loads(text)
            keyword = data.get("keyword", "").strip()

        if not keyword:
            logger.warning(f"[QueryGeneralizer] Empty keyword for title {title[:60]!r}")
            return title

        logger.info(f"[QueryGeneralizer] '{title[:60]}...' → '{keyword}'")
        return keyword

    except Exception as exc:
        logger.error(
            f"[QueryGeneralizer] Failed for title {title[:60]!r}: {exc}",
            exc_info=True,
        )
        return title