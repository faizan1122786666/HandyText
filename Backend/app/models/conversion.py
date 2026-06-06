from beanie import Document
from typing import Optional
from datetime import datetime, timezone
from pydantic import Field

class Conversion(Document):
    user_id: Optional[str] = None
    original_filename: str
    file_path: str
    extracted_text: Optional[str] = None
    edited_text: Optional[str] = None
    edited_html: Optional[str] = None
    page_border: bool = True
    page_border_style: str = "solid"  # none | solid | thick | double | dashed | dotted
    word_count: int = 0
    char_count: int = 0
    confidence_score: float = 0.0
    ocr_engine_used: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"

    class Settings:
        name = "conversions"
