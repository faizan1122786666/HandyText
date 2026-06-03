from beanie import Document
from typing import Optional
from datetime import datetime, timezone
from pydantic import Field

class Feedback(Document):
    user_id: str
    username: str
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    comment: str
    rating: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "feedbacks"
