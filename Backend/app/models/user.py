from beanie import Document
from typing import Optional
from datetime import datetime, timezone
from pydantic import Field

class User(Document):
    username: str
    email: str
    full_name: Optional[str] = None
    hashed_password: str
    profile_image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

    class Settings:
        name = "users"
