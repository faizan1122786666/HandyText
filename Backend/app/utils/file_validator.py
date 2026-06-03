from fastapi import UploadFile, HTTPException, status
from ..config import settings
import os

def validate_file(file: UploadFile):
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing file name. Please choose a valid image file."
        )

    # Check extension
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension {ext} not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )
    
    # Check file size when the client provides it (FastAPI 0.111+)
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file.size is not None and file.size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds limit of {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    # Check MIME type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    return True
