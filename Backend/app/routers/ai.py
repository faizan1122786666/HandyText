from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional
from pydantic import BaseModel
from ..services.ai_service import get_ai_suggestions, get_ocr_corrections
from ..models.conversion import Conversion
from ..utils.auth import get_current_user
from ..models.user import User
from beanie import PydanticObjectId

router = APIRouter(prefix="/ai", tags=["AI Suggestions"])


class CorrectionRequest(BaseModel):
    text: Optional[str] = None


@router.post("/suggest/{conversion_id}")
async def get_suggestions(
    conversion_id: str,
    action: str = Query("improve"),
    current_user: User = Depends(get_current_user),
):
    conversion = await Conversion.get(PydanticObjectId(conversion_id))

    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    if conversion.user_id is not None and conversion.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this conversion")
    if not conversion.extracted_text:
        raise HTTPException(status_code=400, detail="No text extracted for this conversion")

    suggestion = await get_ai_suggestions(conversion.extracted_text, action=action)
    return {"suggestion": suggestion}


@router.post("/correct/{conversion_id}")
async def get_corrections(
    conversion_id: str,
    action: str = Query("proofread"),
    body: Optional[CorrectionRequest] = Body(None),
    current_user: User = Depends(get_current_user),
):
    """Structured OCR fix suggestions (Accept / Ignore per item)."""
    conversion = await Conversion.get(PydanticObjectId(conversion_id))

    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    if conversion.user_id is not None and conversion.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this conversion")

    source_text = (body.text if body and body.text else None) or conversion.extracted_text
    if not source_text or not source_text.strip():
        raise HTTPException(status_code=400, detail="No text extracted for this conversion")

    return await get_ocr_corrections(source_text, action=action)
