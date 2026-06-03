import os
import sys
import io
import pytesseract
from ..config import settings
from ..utils.tesseract_setup import resolve_tesseract_cmd
from .ocr_layout import layout_text_from_detections, low_confidence_spans

_TESSERACT_PATH = resolve_tesseract_cmd(settings.TESSERACT_CMD)
if _TESSERACT_PATH:
    pytesseract.pytesseract.tesseract_cmd = _TESSERACT_PATH
elif os.name == "nt":
    print(
        "Tesseract OCR Issue: executable not found. "
        "Set TESSERACT_CMD in Backend/.env or install with: winget install UB-Mannheim.TesseractOCR"
    )

# Fix Windows console encoding for EasyOCR
if os.name == 'nt':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

readers = {}
_easyocr_module = None


def _get_easyocr():
    global _easyocr_module
    if _easyocr_module is None:
        try:
            import easyocr
            _easyocr_module = easyocr
        except Exception as e:
            print(f"EasyOCR unavailable: {e}")
            _easyocr_module = False
    return _easyocr_module if _easyocr_module is not False else None


def get_reader(lang_code: str):
    easyocr = _get_easyocr()
    if not easyocr:
        return None

    # Keep English and Urdu loaded together so mixed-script pages work.
    if lang_code == 'ur':
        langs = ['ur', 'en']
    else:
        langs = ['en', 'ur']
    
    cache_key = "-".join(sorted(langs))

    if cache_key not in readers:
        try:
            print(f"Initializing EasyOCR for languages: {langs}")
            readers[cache_key] = easyocr.Reader(langs, verbose=False)
        except Exception as e:
            print(f"EasyOCR Initialization Error for {langs}: {e}")
            return None
    return readers[cache_key]


def run_tesseract(image_path: str, lang_code: str) -> dict:
    tess_exe = resolve_tesseract_cmd(settings.TESSERACT_CMD)
    if not tess_exe:
        raise RuntimeError(
            "Tesseract OCR is not installed. Install it with "
            "'winget install UB-Mannheim.TesseractOCR' and set TESSERACT_CMD in Backend/.env"
        )
    pytesseract.pytesseract.tesseract_cmd = tess_exe

    # Map app language codes to Tesseract traineddata codes.
    # Use both English and Urdu so mixed-script pages are handled without reprocessing.
    TESS_LANG_MAP = {
        "en": "eng+urd",
        "ur": "urd+eng"
    }
    tess_lang = TESS_LANG_MAP.get(lang_code, "eng")

    # Use better config for different language types
    if lang_code == 'ur':
        # For Urdu (RTL), use more flexible page segmentation
        config = "--psm 3 -c preserve_interword_spaces=1"
    else:
        config = "--psm 6 -c preserve_interword_spaces=1"
        
    try:
        extracted_text = pytesseract.image_to_string(
            image_path, lang=tess_lang, config=config
        )
    except pytesseract.TesseractError as err:
        if "Error opening data file" in str(err) or "Failed loading language" in str(err):
            if tess_lang != "eng":
                print(f"Tesseract language '{tess_lang}' missing, falling back to English")
                extracted_text = pytesseract.image_to_string(
                    image_path, lang="eng", config=config
                )
            else:
                raise
        else:
            raise
    avg_confidence = 0.5 if extracted_text.strip() else 0.0

    return {
        "text": extracted_text,
        "confidence": avg_confidence,
        "engine": "Pytesseract",
        "word_count": len(extracted_text.split()),
        "char_count": len(extracted_text),
        "uncertain_spans": [],
    }


def run_ocr(image_path: str, lang_code: str = 'en', handwriting: bool = True, confidence_threshold: float = 0.65) -> dict:
    """
    Run OCR on the given image path using EasyOCR with Pytesseract fallback.
    """
    confidences = []
    engine = "EasyOCR"
    easyocr_results = []

    try:
        reader = get_reader(lang_code)
        if reader:
            print(f"Using EasyOCR for {lang_code}")
            # For handwriting mode, we could adjust detection params, but EasyOCR is already good for handwriting!
            easyocr_results = reader.readtext(image_path)
            print(f"Found {len(easyocr_results)} detections!")
            for bbox, text, prob in easyocr_results[:5]:  # Print first 5
                print(f"  - {text} (conf: {prob:.2f})")

            confidences = [prob for (_bbox, _text, prob) in easyocr_results]
            extracted_text = layout_text_from_detections(easyocr_results, lang_code=lang_code)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        else:
            raise RuntimeError(f"EasyOCR reader not initialized for {lang_code}")

    except Exception as e:
        print(f"EasyOCR failed, falling back to Pytesseract: {e}")
        try:
            result = run_tesseract(image_path, lang_code)
            result["uncertain_spans"] = []
            return result
        except Exception as te:
            print(f"Pytesseract failed: {te}")
            return {
                "text": "",
                "confidence": 0.0,
                "engine": "None",
                "word_count": 0,
                "char_count": 0,
                "uncertain_spans": [],
            }

    return {
        "text": extracted_text,
        "confidence": avg_confidence,
        "engine": engine,
        "word_count": len(extracted_text.split()),
        "char_count": len(extracted_text),
        "uncertain_spans": low_confidence_spans(easyocr_results, threshold=confidence_threshold),
    }
