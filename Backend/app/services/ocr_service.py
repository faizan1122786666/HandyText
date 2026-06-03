"""
OCR service: EasyOCR (primary) + Tesseract (fallback) for English, Urdu, and handwriting.
"""
from __future__ import annotations

import io
import logging
import os
import sys
from typing import Literal, Optional

from PIL import Image
import pytesseract

from ..config import settings
from ..utils.image_preprocessing import preprocess_for_ocr
from ..utils.tesseract_setup import resolve_tesseract_cmd
from .ocr_layout import layout_text_from_detections, low_confidence_spans

logger = logging.getLogger(__name__)

LanguageCode = Literal["en", "ur"]

_TESSERACT_PATH = resolve_tesseract_cmd(settings.TESSERACT_CMD)
if _TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = _TESSERACT_PATH
elif os.name == "nt":
    logger.warning(
        "Tesseract not found. Set TESSERACT_CMD in .env "
        "(e.g. C:\\Program Files\\Tesseract-OCR\\tesseract.exe)"
    )

if os.name == "nt":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

readers = {}
_easyocr_module = None

SUPPORTED_LANGUAGES = ("en", "ur")
TESS_LANG_MAP = {"en": "eng", "ur": "urd+eng"}


def _get_easyocr():
    global _easyocr_module
    if _easyocr_module is None:
        try:
            import easyocr

            _easyocr_module = easyocr
        except Exception as exc:
            logger.error("EasyOCR unavailable: %s", exc)
            _easyocr_module = False
    return _easyocr_module if _easyocr_module is not False else None


def normalize_language(lang_code: str) -> LanguageCode:
    code = (lang_code or "en").strip().lower()
    if code not in SUPPORTED_LANGUAGES:
        return "en"
    return code  # type: ignore[return-value]


def get_reader(lang_code: str):
    easyocr = _get_easyocr()
    if not easyocr:
        return None

    langs = ["ur", "en"] if lang_code == "ur" else ["en"]
    cache_key = "-".join(sorted(langs))

    if cache_key not in readers:
        try:
            logger.info("Initializing EasyOCR for languages: %s", langs)
            readers[cache_key] = easyocr.Reader(langs, verbose=False)
        except Exception as exc:
            logger.error("EasyOCR init failed for %s: %s", langs, exc)
            return None
    return readers[cache_key]


def run_tesseract(image_path: str, lang_code: str) -> dict:
    tess_exe = resolve_tesseract_cmd(settings.TESSERACT_CMD)
    if not tess_exe:
        raise RuntimeError(
            "Tesseract OCR is not installed. Set TESSERACT_CMD in Backend/.env "
            "(e.g. C:\\Program Files\\Tesseract-OCR\\tesseract.exe)"
        )
    pytesseract.pytesseract.tesseract_cmd = tess_exe

    lang_code = normalize_language(lang_code)
    tess_lang = TESS_LANG_MAP.get(lang_code, "eng")
    config = (
        "--psm 3 -c preserve_interword_spaces=1"
        if lang_code == "ur"
        else "--psm 6 -c preserve_interword_spaces=1"
    )

    try:
        data = pytesseract.image_to_data(
            image_path, lang=tess_lang, config=config, output_type=pytesseract.Output.DICT
        )
        extracted_text = pytesseract.image_to_string(image_path, lang=tess_lang, config=config)
        confs = [int(c) for c in data.get("conf", []) if str(c).isdigit() and int(c) >= 0]
        avg_confidence = (sum(confs) / len(confs) / 100.0) if confs else (0.5 if extracted_text.strip() else 0.0)
    except pytesseract.TesseractError as err:
        if "Error opening data file" in str(err) or "Failed loading language" in str(err):
            logger.warning("Tesseract lang '%s' missing, falling back to eng", tess_lang)
            extracted_text = pytesseract.image_to_string(image_path, lang="eng", config=config)
            avg_confidence = 0.5 if extracted_text.strip() else 0.0
        else:
            raise

    return {
        "text": extracted_text.strip(),
        "confidence": round(float(avg_confidence), 4),
        "engine": "Pytesseract",
        "word_count": len(extracted_text.split()),
        "char_count": len(extracted_text),
        "uncertain_spans": [],
    }


def _text_quality_score(result: dict) -> float:
    text = (result.get("text") or "").strip()
    if not text:
        return 0.0

    words = text.split()
    line_count = len([line for line in text.splitlines() if line.strip()])
    alnum_count = sum(ch.isalnum() for ch in text)
    symbol_count = sum((not ch.isalnum() and not ch.isspace()) for ch in text)
    confidence = float(result.get("confidence") or 0.0)

    score = confidence * 100
    score += min(len(words), 80) * 1.25
    score += min(line_count, 30) * 2.0
    score += min(alnum_count, 500) * 0.04
    if alnum_count:
        score -= min(symbol_count / alnum_count, 1.0) * 18
    return score


def _best_ocr_result(*results: dict) -> dict:
    candidates = [result for result in results if result and (result.get("text") or "").strip()]
    if not candidates:
        return results[0] if results else {
            "text": "",
            "confidence": 0.0,
            "engine": "None",
            "word_count": 0,
            "char_count": 0,
            "uncertain_spans": [],
        }
    return max(candidates, key=_text_quality_score)


def _run_gemini_vision_ocr(image_path: str, lang_code: str) -> Optional[dict]:
    """
    Optional AI OCR fallback. Used only when local OCR is empty or weak.
    Requires GEMINI_API_KEY in Backend/.env, KEYS.txt, or AI/gemini_key.txt.
    """
    try:
        from .ai_service import get_gemini_api_key
        import google.generativeai as genai

        api_key = get_gemini_api_key()
        if not api_key:
            return None

        language_hint = "Urdu and English" if lang_code == "ur" else "English"
        prompt = f"""Extract the visible text from this image exactly as it appears.

Rules:
- Preserve the document layout as plain text.
- Keep the same line breaks, blank lines, headings, indentation, punctuation, numbers, and casing.
- If this is a letter, keep the address/date/greeting/body/closing/signature on separate lines like the original.
- Use only {language_hint} text. Do not insert Urdu or Arabic-script characters unless the selected language is Urdu and they are visible in the image.
- Correct obvious OCR-style character mistakes while keeping the original words and meaning.
- Do not summarize, rewrite, translate, or explain.
- If a word is unclear, make the closest readable transcription.
- Return only the extracted text.

Selected OCR language: {language_hint}."""

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-flash-latest")
        with Image.open(image_path) as image:
            response = model.generate_content([prompt, image])
        text = (getattr(response, "text", "") or "").strip()
        if not text:
            return None
        return {
            "text": text,
            "confidence": 0.92,
            "engine": "Gemini Vision",
            "word_count": len(text.split()),
            "char_count": len(text),
            "uncertain_spans": [],
        }
    except Exception as exc:
        logger.warning("Gemini vision OCR unavailable: %s", exc)
        return None


def run_ocr(
    image_path: str,
    lang_code: str = "en",
    handwriting: bool = True,
    confidence_threshold: float = 0.65,
) -> dict:
    """
    Run OCR on an image using EasyOCR with Tesseract fallback.
    Handwriting mode uses EasyOCR's default detector (strong on handwritten text).
    """
    lang_code = normalize_language(lang_code)
    confidences = []
    easyocr_results = []
    easyocr_result = None

    try:
        reader = get_reader(lang_code)
        if not reader:
            raise RuntimeError(f"EasyOCR reader not initialized for {lang_code}")

        logger.info("OCR via EasyOCR | lang=%s handwriting=%s", lang_code, handwriting)
        easyocr_results = reader.readtext(image_path)
        logger.debug("EasyOCR detections: %d", len(easyocr_results))

        confidences = [prob for (_bbox, _text, prob) in easyocr_results]
        extracted_text = layout_text_from_detections(easyocr_results, lang_code=lang_code)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        easyocr_result = {
            "text": extracted_text.strip(),
            "confidence": round(float(avg_confidence), 4),
            "engine": "EasyOCR",
            "word_count": len(extracted_text.split()),
            "char_count": len(extracted_text),
            "uncertain_spans": low_confidence_spans(easyocr_results, threshold=confidence_threshold),
        }

    except Exception as exc:
        logger.warning("EasyOCR failed: %s", exc)

    tesseract_result = None
    try:
        tesseract_result = run_tesseract(image_path, lang_code)
    except Exception as tess_exc:
        logger.warning("Tesseract OCR unavailable: %s", tess_exc)

    result = _best_ocr_result(easyocr_result, tesseract_result)

    ai_result = _run_gemini_vision_ocr(image_path, lang_code)
    if ai_result and _text_quality_score(ai_result) >= _text_quality_score(result):
        result = ai_result

    return result


def run_ocr_with_preprocessing(
    image_path: str,
    lang_code: str = "en",
    handwriting: bool = True,
    preprocess: bool = True,
    confidence_threshold: float = 0.65,
) -> dict:
    """Preprocess then OCR; retries on original image if preprocessing yields empty text."""
    lang_code = normalize_language(lang_code)
    processed_path = preprocess_for_ocr(image_path, enhance=preprocess, lang_code=lang_code)
    result = run_ocr(
        processed_path,
        lang_code=lang_code,
        handwriting=handwriting,
        confidence_threshold=confidence_threshold,
    )

    if not result["text"].strip() and processed_path != image_path:
        logger.info("Retrying OCR on original image")
        original = run_ocr(
            image_path,
            lang_code=lang_code,
            handwriting=handwriting,
            confidence_threshold=confidence_threshold,
        )
        if original["text"].strip():
            result = original

    if processed_path != image_path and os.path.isfile(processed_path):
        try:
            os.remove(processed_path)
        except OSError:
            pass

    result["language"] = lang_code
    return result


def build_ocr_api_response(ocr_result: dict, lang_code: str) -> dict:
    """Shape internal OCR result for POST /api/ocr."""
    return {
        "success": bool(ocr_result.get("text", "").strip()),
        "text": ocr_result.get("text", ""),
        "language": normalize_language(lang_code),
        "confidence": float(ocr_result.get("confidence", 0.0)),
        "engine": ocr_result.get("engine"),
        "word_count": ocr_result.get("word_count", 0),
        "char_count": ocr_result.get("char_count", 0),
        "uncertain_spans": ocr_result.get("uncertain_spans", []),
    }
