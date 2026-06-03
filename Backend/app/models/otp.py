from beanie import Document
from datetime import datetime, timezone
from pydantic import Field

class OTP(Document):
    email: str
    code: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def is_expired(self):
        # ensure timezone aware comparison
        now = datetime.now(timezone.utc)
        if self.expires_at.tzinfo is None:
            return now > self.expires_at.replace(tzinfo=timezone.utc)
        return now > self.expires_at

    class Settings:
        name = "otps"
