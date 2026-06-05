from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from ..models.conversion import Conversion
from ..services import export_service
import os
from beanie import PydanticObjectId

router = APIRouter(prefix="/export", tags=["Export"])

class SaveEditedTextRequest(BaseModel):
    edited_text: str
    edited_html: Optional[str] = None
    page_border: Optional[bool] = None

async def get_conversion_by_id(conversion_id: str):
    conversion = await Conversion.get(PydanticObjectId(conversion_id))
    if not conversion:
        raise HTTPException(status_code=404, detail="Conversion not found")
    if not conversion.extracted_text:
        raise HTTPException(status_code=400, detail="No text extracted to export")
    return conversion

@router.post("/{conversion_id}/save-edited")
async def save_edited_text(conversion_id: str, request: SaveEditedTextRequest):
    conversion = await get_conversion_by_id(conversion_id)
    conversion.edited_text = request.edited_text
    conversion.edited_html = request.edited_html
    if request.page_border is not None:
        conversion.page_border = request.page_border
    await conversion.save()
    return {"message": "Text saved successfully"}

@router.get("/{conversion_id}/txt")
async def export_txt(conversion_id: str):
    conversion = await get_conversion_by_id(conversion_id)
    text = conversion.edited_text or conversion.extracted_text
    file_path = export_service.generate_txt(text, conversion.original_filename)
    return FileResponse(file_path, filename=f"{conversion.original_filename}.txt", media_type='text/plain')

@router.get("/{conversion_id}/docx")
async def export_docx(conversion_id: str):
    conversion = await get_conversion_by_id(conversion_id)
    plain_text = conversion.edited_text or conversion.extracted_text
    html_content = conversion.edited_html
    file_path = export_service.generate_docx(html_content, plain_text, conversion.original_filename, page_border=conversion.page_border)
    return FileResponse(file_path, filename=f"{conversion.original_filename}.docx",
                        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

@router.get("/{conversion_id}/pdf")
async def export_pdf(conversion_id: str):
    conversion = await get_conversion_by_id(conversion_id)
    plain_text = conversion.edited_text or conversion.extracted_text
    html_content = conversion.edited_html
    file_path = export_service.generate_pdf(html_content, plain_text, conversion.original_filename, page_border=conversion.page_border)
    return FileResponse(file_path, filename=f"{conversion.original_filename}.pdf", media_type='application/pdf')
