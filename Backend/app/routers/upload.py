from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Form
from typing import List, Optional
from datetime import datetime
import os
import uuid
import aiofiles
from ..models.conversion import Conversion
from ..models.user import User
from ..schemas.conversion import ConversionOut, ConversionRename
from ..utils.auth import get_current_user, get_optional_current_user
from ..utils.file_validator import validate_file
from ..services.ocr_service import run_ocr
from ..services.ocr_layout import reflow_paragraphs, should_preserve_line_breaks
from ..services.image_service import preprocess_image
from ..services.cloudinary_service import upload_image
from ..config import settings
from beanie import PydanticObjectId
from html import escape

router = APIRouter(prefix="/upload", tags=["Upload & OCR"])


def resolve_upload_filename(upload_filename: Optional[str]) -> str:
    """Use the uploaded file name, or generate one if the browser did not provide it."""
    name = (upload_filename or "").strip()
    name = os.path.basename(name.replace("\\", "/"))
    if not name or name.lower() in ("blob", "undefined"):
        return f"Document_{datetime.utcnow().strftime('%Y-%m-%d_%H%M%S')}"
    return name


def build_formatted_ocr_html(ocr_result: dict) -> Optional[str]:
    text = (ocr_result.get("text") or "").strip("\n")
    if not text:
        return None

    preserve_lines = should_preserve_line_breaks(text)

    # EasyOCR text is already reflowed using box geometry. For engines that
    # return text directly (Gemini Vision / Tesseract), reflow hard wraps unless
    # the document looks like a letter/application where line breaks are fields.
    if ocr_result.get("engine") != "EasyOCR" and not preserve_lines:
        text = reflow_paragraphs(text)

    bold_lines = {line.strip() for line in ocr_result.get("bold_lines", []) if str(line).strip()}
    bold_phrases = [phrase.strip() for phrase in ocr_result.get("bold_phrases", []) if str(phrase).strip()]

    lines = text.splitlines()

    def is_fallback_heading(line: str, index: int) -> bool:
        stripped = line.strip()
        if not stripped:
            return False
        if stripped in bold_lines:
            return True
        if index == 0 and len(stripped) <= 80 and not stripped.endswith((".", ",", ";")):
            return True
        if stripped.endswith(":") and len(stripped) <= 60:
            return True
        return False

    def format_line(line: str, index: int) -> str:
        escaped = escape(line.rstrip())
        if is_fallback_heading(line, index):
            return f"<div><strong>{escaped}</strong></div>"
        for phrase in bold_phrases:
            if phrase in line:
                if len(phrase) >= max(6, len(line.strip()) * 0.65):
                    return f"<div><strong>{escaped}</strong></div>"
                escaped_phrase = escape(phrase)
                escaped = escaped.replace(escaped_phrase, f"<strong>{escaped_phrase}</strong>", 1)
        if not line.strip():
            return '<div class="ocr-blank-line"><br></div>'
        return f"<div>{escaped}</div>"

    html_lines = []
    for index, line in enumerate(lines):
        if not line.strip() and html_lines:
            next_line = lines[index + 1].strip() if index + 1 < len(lines) else ""
            previous_is_heading = is_fallback_heading(lines[index - 1], index - 1)
            if previous_is_heading and next_line:
                continue
        html_lines.append(format_line(line, index))

    return "".join(html_lines)


@router.post("/convert", response_model=ConversionOut)
async def convert_image(
    file: UploadFile = File(...),
    language: str = Form("en"),
    enhanceImage: bool = Form(True),
    handwritingMode: bool = Form(True),
    confidenceThreshold: float = Form(0.65),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # Validate file
    validate_file(file)

    # Save original file locally first
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    local_file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    async with aiofiles.open(local_file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    # Upload to Cloudinary if configured
    cloudinary_result = upload_image(local_file_path)
    file_url = cloudinary_result["url"]

    # Create conversion record
    conversion = Conversion(
        user_id=str(current_user.id) if current_user else None,
        original_filename=resolve_upload_filename(file.filename),
        file_path=file_url,
        status="pending"
    )
    await conversion.insert()

    try:
        # Preprocess locally
        processed_path = preprocess_image(local_file_path, enhance=enhanceImage, lang_code=language)

        # OCR locally
        ocr_result = run_ocr(processed_path, lang_code=language, handwriting=handwritingMode, confidence_threshold=confidenceThreshold)

        # Fallback to the original image if preprocessing wiped out the text.
        if not ocr_result["text"].strip():
            original_result = run_ocr(local_file_path, lang_code=language, handwriting=handwritingMode, confidence_threshold=confidenceThreshold)
            if original_result["text"].strip():
                ocr_result = original_result

        # Update record. Preserve application/letter line structure; otherwise
        # store reflowed paragraphs so long body text reads left-to-right.
        preserve_lines = should_preserve_line_breaks(ocr_result["text"])
        flowed_text = (
            ocr_result["text"]
            if ocr_result.get("engine") == "EasyOCR" or preserve_lines
            else reflow_paragraphs(ocr_result["text"])
        )
        conversion.extracted_text = ocr_result["text"]
        conversion.edited_text = flowed_text
        conversion.edited_html = build_formatted_ocr_html(ocr_result)
        conversion.word_count = ocr_result["word_count"]
        conversion.char_count = ocr_result["char_count"]
        conversion.confidence_score = ocr_result["confidence"]
        conversion.ocr_engine_used = ocr_result["engine"]
        conversion.status = "completed"
        
        # Cleanup local files
        if os.path.exists(local_file_path):
            os.remove(local_file_path)
        if processed_path != local_file_path and os.path.exists(processed_path):
            os.remove(processed_path)

    except Exception as e:
        conversion.status = "failed"
        print(f"Conversion failed: {e}")
        await conversion.save()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

    await conversion.save()
    return conversion

@router.get("/history", response_model=List[ConversionOut])
async def get_history(
    current_user: User = Depends(get_current_user)
):
    return await Conversion.find({"user_id": str(current_user.id)}).sort("-created_at").limit(20).to_list()

@router.get("/conversion/{id}", response_model=ConversionOut)
async def get_conversion(id: str):
    conversion = await Conversion.get(PydanticObjectId(id))
    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    return conversion

@router.patch("/conversion/{id}", response_model=ConversionOut)
async def rename_conversion(
    id: str,
    body: ConversionRename,
    current_user: User = Depends(get_current_user),
):
    new_name = body.original_filename.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Document name cannot be empty")
    if len(new_name) > 255:
        raise HTTPException(status_code=400, detail="Document name is too long (max 255 characters)")

    conversion = await Conversion.get(PydanticObjectId(id))

    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    if conversion.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to rename this conversion")

    conversion.original_filename = new_name
    await conversion.save()
    return conversion


@router.delete("/conversion/{id}")
async def delete_conversion(
    id: str,
    current_user: User = Depends(get_current_user)
):
    conversion = await Conversion.get(PydanticObjectId(id))
    
    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    
    if conversion.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this conversion")

    # Delete file
    if os.path.exists(conversion.file_path):
        os.remove(conversion.file_path)
    
    await conversion.delete()
    return {"message": "Conversion deleted successfully"}
