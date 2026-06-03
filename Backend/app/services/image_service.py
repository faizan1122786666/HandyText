"""
Backward-compatible image preprocessing wrapper for existing upload router.
"""
from ..utils.image_preprocessing import preprocess_for_ocr


def preprocess_image(file_path: str, enhance: bool = True, lang_code: str = "en") -> str:
    """Preprocess image for OCR (used by /upload/convert)."""
    return preprocess_for_ocr(file_path, enhance=enhance, lang_code=lang_code)
