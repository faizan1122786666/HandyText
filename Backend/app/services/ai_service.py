import json
import os
import re
import google.generativeai as genai
from ..config import settings

ACTION_PROMPTS = {
    "proofread": "Fix OCR misreads and obvious spelling mistakes only.",
    "grammar": "Fix grammar and punctuation while keeping the author's wording.",
    "improve": "Improve clarity and flow without changing the meaning.",
    "shorten": "Make the text shorter but keep all important points and line breaks.",
    "simplify": "Use simpler words suitable for easy reading.",
}

GEMINI_MODEL = "gemini-2.5-flash-lite"


def get_gemini_api_key():
    master_keys_path = os.path.join(os.getcwd(), "KEYS.txt")
    if os.path.exists(master_keys_path):
        with open(master_keys_path, "r") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    key = line.strip().split("=", 1)[1]
                    if key and key != "your_gemini_api_key_here":
                        return key

    key_file_path = os.path.join(os.getcwd(), "AI", "gemini_key.txt")
    if os.path.exists(key_file_path):
        with open(key_file_path, "r") as f:
            key = f.read().strip()
            if key:
                return key

    return settings.GEMINI_API_KEY


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
    return "Could not load AI suggestions."


async def get_ai_suggestions(text: str, action: str = "improve") -> str:
    """Return improved text as a single string (preserves line breaks)."""
    api_key = get_gemini_api_key()
    if not api_key:
        return "Gemini API key not found. Add it from Settings."

    instruction = ACTION_PROMPTS.get(action, ACTION_PROMPTS["improve"])

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        prompt = f"""{instruction}

IMPORTANT: Keep every line break and blank line exactly as in the source. Do not merge lines into one paragraph.

OCR text:
{text}

Return only the corrected text with the same line structure:"""

        response = await model.generate_content_async(prompt)
        return (response.text or "").strip()
    except Exception as e:
        print(f"Gemini AI Service Error: {e}")
        return _friendly_ai_error(e)


async def get_ocr_corrections(text: str, action: str = "proofread") -> dict:
    """
    Return structured correction suggestions for the AI sidebar.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return {
            "corrections": [],
            "corrected_text": text,
            "message": "Gemini API key not found. Add it from Settings.",
        }

    instruction = ACTION_PROMPTS.get(action, ACTION_PROMPTS["proofread"])

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
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

        response = await model.generate_content_async(prompt)
        parsed = _extract_json(response.text or "{}")
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
        print(f"Gemini corrections error: {e}")
        return {
            "corrections": [],
            "corrected_text": text,
            "message": _friendly_ai_error(e),
        }
