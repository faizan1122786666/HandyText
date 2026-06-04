from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from beanie import PydanticObjectId

class ConversionBase(BaseModel):
    original_filename: str

class ConversionCreate(ConversionBase):
    user_id: Optional[str] = None
    file_path: str
    status: str = "pending"

class ConversionOut(ConversionBase):
    id: PydanticObjectId
    user_id: Optional[str]
    file_path: str
    extracted_text: Optional[str]
<<<<<<< HEAD
    edited_text: Optional[str] = None
=======
>>>>>>> 8343dc76d46e674b0619ce29d7b4a30aedf7652f
    edited_html: Optional[str] = None
    word_count: int
    char_count: int
    confidence_score: float
    ocr_engine_used: Optional[str]
    created_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)

class ConversionRename(BaseModel):
    original_filename: str

class ConversionListOut(BaseModel):
    conversions: List[ConversionOut]
