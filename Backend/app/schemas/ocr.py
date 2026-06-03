from pydantic import BaseModel, Field
from typing import List, Optional


class OCRResponse(BaseModel):
    success: bool = True
    text: str = ""
    language: str = Field(..., description="Detected or requested language code: en or ur")
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    engine: Optional[str] = None
    word_count: int = 0
    char_count: int = 0
    uncertain_spans: List[dict] = []


class OCRErrorResponse(BaseModel):
    success: bool = False
    text: str = ""
    language: str = "en"
    confidence: float = 0.0
    detail: str
