"""
POST /api/ocr — standalone OCR for images and PDFs (English, handwriting).
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from ..schemas.ocr import OCRResponse
from ..services.ocr_service import build_ocr_api_response, normalize_language, run_ocr_with_preprocessing
from ..utils.media_io import cleanup_paths, resolve_image_paths, save_upload_to_disk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.post("", response_model=OCRResponse)
async def extract_text(
    file: UploadFile = File(..., description="JPG, JPEG, PNG, or PDF"),
    language: str = Form("en", description="Language code: en"),
    handwriting: bool = Form(True, description="Optimize for handwritten text"),
    preprocess: bool = Form(True, description="Apply OpenCV preprocessing"),
    confidence_threshold: float = Form(0.65, ge=0.0, le=1.0),
):
    """
    Extract text from an uploaded image or PDF.

    Returns:
        { "success": true, "text": "...", "language": "en", "confidence": 0.95 }
    """
    lang = normalize_language(language)
    temp_paths: List[str] = []
    local_path = ""

    try:
        local_path, ext, _ = await save_upload_to_disk(file)
        temp_paths.append(local_path)

        image_paths = resolve_image_paths(local_path, ext)
        temp_paths.extend(image_paths)

        combined_text: List[str] = []
        best_confidence = 0.0
        engine = None
        total_words = 0
        total_chars = 0
        uncertain: list = []

        for page_index, image_path in enumerate(image_paths):
            logger.info("OCR page %d/%d: %s", page_index + 1, len(image_paths), image_path)
            result = run_ocr_with_preprocessing(
                image_path,
                lang_code=lang,
                handwriting=handwriting,
                preprocess=preprocess,
                confidence_threshold=confidence_threshold,
            )
            if result.get("text"):
                if len(image_paths) > 1:
                    combined_text.append(f"--- Page {page_index + 1} ---\n{result['text']}")
                else:
                    combined_text.append(result["text"])
            best_confidence = max(best_confidence, float(result.get("confidence", 0)))
            engine = result.get("engine") or engine
            total_words += int(result.get("word_count", 0))
            total_chars += int(result.get("char_count", 0))
            uncertain.extend(result.get("uncertain_spans", []))

        full_text = "\n\n".join(combined_text).strip()
        payload = build_ocr_api_response(
            {
                "text": full_text,
                "confidence": best_confidence,
                "engine": engine,
                "word_count": total_words,
                "char_count": total_chars,
                "uncertain_spans": uncertain,
            },
            lang,
        )

        if not full_text:
            logger.warning("OCR returned empty text for upload")
            payload["success"] = False

        return OCRResponse(**payload)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("OCR API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {exc}",
        ) from exc
    finally:
        cleanup_paths(temp_paths)
