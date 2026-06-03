"""
Save uploads and convert PDF pages to images for OCR/graph pipelines.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import List, Tuple

import aiofiles
from fastapi import HTTPException, UploadFile, status

from ..config import settings

logger = logging.getLogger(__name__)

OCR_GRAPH_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
OCR_GRAPH_MIME_PREFIXES = ("image/", "application/pdf")


def validate_ocr_graph_upload(file: UploadFile) -> str:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing file name.",
        )

    ext = os.path.splitext(filename)[1].lower()
    if ext not in OCR_GRAPH_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' not allowed. Allowed: JPG, JPEG, PNG, PDF",
        )

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file.size is not None and file.size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds limit of {settings.MAX_FILE_SIZE_MB}MB",
        )

    if file.content_type:
        valid = any(file.content_type.startswith(p) for p in OCR_GRAPH_MIME_PREFIXES)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image (JPG, PNG) or PDF.",
            )

    return ext


async def save_upload_to_disk(file: UploadFile) -> Tuple[str, str, str]:
    """Save upload; returns (local_path, extension, original_filename)."""
    ext = validate_ocr_graph_upload(file)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    local_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds limit of {settings.MAX_FILE_SIZE_MB}MB",
        )

    async with aiofiles.open(local_path, "wb") as out_file:
        await out_file.write(content)

    logger.info("Saved upload: %s (%d bytes)", local_path, len(content))
    return local_path, ext, (file.filename or unique_name)


def pdf_to_image_paths(pdf_path: str, dpi: int = 200) -> List[str]:
    """Convert PDF pages to PNG files in uploads/."""
    try:
        from pdf2image import convert_from_path
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pdf2image is not installed. Install poppler and pdf2image.",
        ) from exc

    try:
        pages = convert_from_path(pdf_path, dpi=dpi)
    except Exception as exc:
        logger.exception("PDF conversion failed: %s", pdf_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not convert PDF: {exc}. Ensure Poppler is installed.",
        ) from exc

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF contains no pages.",
        )

    image_paths: List[str] = []
    base = os.path.splitext(os.path.basename(pdf_path))[0]
    for index, page in enumerate(pages):
        out_path = os.path.join(settings.UPLOAD_DIR, f"{base}_page{index + 1}_{uuid.uuid4().hex[:8]}.png")
        page.save(out_path, "PNG")
        image_paths.append(out_path)

    logger.info("Converted PDF to %d image(s)", len(image_paths))
    return image_paths


def resolve_image_paths(local_path: str, ext: str) -> List[str]:
    if ext == ".pdf":
        return pdf_to_image_paths(local_path)
    return [local_path]


def cleanup_paths(paths: List[str]) -> None:
    for path in paths:
        try:
            if path and os.path.isfile(path):
                os.remove(path)
        except OSError as exc:
            logger.warning("Could not remove temp file %s: %s", path, exc)
