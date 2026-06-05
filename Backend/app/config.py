import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from typing import Optional

_DEFAULT_TESSERACT = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.name == "nt"
    else "tesseract"
)


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 1 day
    UPLOAD_DIR: str = "uploads/"
    EXPORT_DIR: str = "exports/"
    MAX_FILE_SIZE_MB: int = 5
    ALLOWED_EXTENSIONS: str = ".jpg .jpeg .png .webp"
    CORS_ORIGINS: str = "http://localhost:5173"
    TESSERACT_CMD: str = _DEFAULT_TESSERACT

    # Cloudinary Settings
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Gemini Settings
    GEMINI_API_KEY: Optional[str] = None

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(" ")]

settings = Settings()
