import json
import re

from . import ai_providers

ACTION_PROMPTS = {
    "proofread": "Fix OCR misreads and obvious spelling mistakes only.",
    "grammar": "Fix grammar and punctuation while keeping the author's wording.",
    "improve": "Improve clarity and flow without changing the meaning.",
    "shorten": "Make the text shorter but keep all important points and line breaks.",
    "simplify": "Use simpler words suitable for easy reading.",
}

# Kept for backwards compatibility with older imports. The active model is now
# resolved per request via ai_providers (Settings -> selected model).
GEMINI_MODEL = ai_providers.DEFAULT_MODEL


def get_gemini_api_key():
    """Backwards-compatible accessor for the Gemini key."""
    return ai_providers.get_provider_key("gemini")


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _friendly_ai_error(exc: Exception) -> str:
    message = str(exc)
    if re.search(r"quota|rate.?limit|\b429\b", message, flags=re.I):
        return "API limit exceeded."
    if re.search(r"\b401\b|\b403\b|unauthor|invalid.*api.?key|api.?key", message, flags=re.I):
        return "Invalid or missing API key. Check it in Settings."
    return "Could not load AI suggestions."


def _no_key_message() -> str:
    return "No AI model configured. Add an API key in Settings."


async def get_ai_suggestions(text: str, action: str = "improve") -> str:
    """Return improved text as a single string (preserves line breaks)."""
    if not ai_providers.has_any_key():
        return _no_key_message()

    instruction = ACTION_PROMPTS.get(action, ACTION_PROMPTS["improve"])

    prompt = f"""{instruction}

IMPORTANT: Keep every line break and blank line exactly as in the source. Do not merge lines into one paragraph.

OCR text:
{text}

Return only the corrected text with the same line structure:"""

    try:
        result = await ai_providers.generate_text(prompt)
        if result is None:
            return _no_key_message()
        return result.strip()
    except Exception as e:
        print(f"AI Service Error: {e}")
        return _friendly_ai_error(e)


async def get_ocr_corrections(text: str, action: str = "proofread") -> dict:
    """
    Return structured correction suggestions for the AI sidebar.
    """
    if not ai_providers.has_any_key():
        return {
            "corrections": [],
            "corrected_text": text,
            "message": _no_key_message(),
        }

    instruction = ACTION_PROMPTS.get(action, ACTION_PROMPTS["proofread"])

    prompt = f"""{instruction}

You are reviewing OCR output from a handwritten document. The text must keep the same line breaks and blank lines as the original (like a stack trace or numbered list — one line per row).

OCR text:
{text}

Respond with ONLY valid JSON (no markdown):
{{
  "corrections": [
    {{
      "old_text": "exact substring from the OCR text",
      "new_text": "corrected substring",
      "reason": "short reason"
    }}
  ],
  "corrected_text": "full text with all fixes applied, same line breaks as input"
}}

Rules:
- Maximum 20 corrections.
- old_text must appear verbatim in the OCR text (single word or short phrase only).
- Include spelling mistakes, grammar errors, wrong words from OCR, and extra/missing spaces.
- Do not merge multiple lines into one paragraph in corrected_text.
- If nothing needs fixing, return empty corrections and corrected_text equal to the input."""

    try:
        raw = await ai_providers.generate_text(prompt)
        if raw is None:
            return {
                "corrections": [],
                "corrected_text": text,
                "message": _no_key_message(),
            }
        parsed = _extract_json(raw or "{}")
        corrections = parsed.get("corrections") or []
        cleaned = []
        for item in corrections[:20]:
            old_t = (item.get("old_text") or "").strip()
            new_t = (item.get("new_text") or "").strip()
            if old_t and new_t and old_t != new_t and old_t in text:
                cleaned.append({
                    "old_text": old_t,
                    "new_text": new_t,
                    "reason": (item.get("reason") or "OCR correction").strip(),
                })

        corrected = (parsed.get("corrected_text") or text).strip()
        return {
            "corrections": cleaned,
            "corrected_text": corrected,
            "message": None,
        }
    except Exception as e:
        print(f"AI corrections error: {e}")
        return {
            "corrections": [],
            "corrected_text": text,
            "message": _friendly_ai_error(e),
        }
