"""
POST /handwriting/generate — render typed text as handwriting on a page.
GET  /handwriting/fonts    — list available handwriting fonts.
"""
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ..services import handwriting_service as hw

router = APIRouter(prefix="/handwriting", tags=["Handwriting"])


@router.get("/fonts")
async def get_fonts():
    return {"fonts": hw.list_fonts()}


@router.post("/generate")
async def generate(
    text: str = Form(...),
    font: str = Form(hw.DEFAULT_FONT),
    font_size: int = Form(44),
    ink_color: str = Form("#22356f"),
    page_type: str = Form("a4"),
    fmt: str = Form("png"),
    file: Optional[UploadFile] = File(None),
):
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Please type some text to convert.")

    background_bytes = await file.read() if file is not None else None

    try:
        image = hw.generate_handwriting(
            text,
            font_id=font,
            font_size=font_size,
            ink_color=ink_color,
            background_bytes=background_bytes,
            page_type=page_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not generate handwriting: {exc}")

    fmt = (fmt or "png").lower()
    if fmt not in ("png", "pdf"):
        fmt = "png"
    buffer = hw.to_bytes(image, fmt)
    media_type = "application/pdf" if fmt == "pdf" else "image/png"
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="handwriting.{fmt}"'},
    )
