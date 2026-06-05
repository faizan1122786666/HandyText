from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.config import settings
from app.routers import auth, upload, export, ai, feedback, ocr, graph, handwriting, user_settings
from app.utils.tesseract_setup import check_tesseract

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("handytext")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize MongoDB connection using Beanie
    app.state.db_ready = False
    app.state.db_error = None
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        from beanie import init_beanie
        from app.database import get_database_url
        from app.models.user import User
        from app.models.conversion import Conversion
        from app.models.feedback import Feedback
        from app.models.otp import OTP

        mongo_client = AsyncIOMotorClient(get_database_url())
        # Use the default database specified in the connection string
        db = mongo_client.get_default_database()
        await init_beanie(database=db, document_models=[User, Conversion, Feedback, OTP])
        app.state.db_ready = True
        app.state.db_error = None
        print("" )
        print("=" * 50)
        print("DATABASE CONNECTED: MongoDB")
        print("=" * 50)
    except Exception as e:
        app.state.db_ready = False
        app.state.db_error = str(e)
        print(f"DATABASE CONNECTION FAILED: {e}")

    # Create upload directory if not exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)

    tess = check_tesseract(settings.TESSERACT_CMD)
    if tess["installed"]:
        print(f"Tesseract OK: {tess['version']} ({tess['path']})")
        print(f"Tesseract languages: {', '.join(tess['languages']) or 'none'}")
    else:
        print(f"Tesseract OCR Issue: {tess['message']}")
    
    yield

app = FastAPI(
    title="HandyText API",
    description="Backend for HandyText OCR application",
    version="1.0.1",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://((localhost)|(127\.0\.0\.1)|(\d{1,3}(\.\d{1,3}){3}))(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root and Health Endpoints
@app.get("/")
async def root():
    return {
        "status": "ok",
        "app": "HandyText API",
        "version": "1.0.1"
    }

@app.get("/health/tesseract")
async def tesseract_health():
    return check_tesseract(settings.TESSERACT_CMD)


@app.get("/health/ocr")
async def ocr_health():
    from app.services.ocr_service import _get_easyocr, SUPPORTED_LANGUAGES

    tess = check_tesseract(settings.TESSERACT_CMD)
    easyocr_ok = _get_easyocr() is not None
    return {
        "status": "ok" if (tess["installed"] or easyocr_ok) else "degraded",
        "tesseract": tess,
        "easyocr": easyocr_ok,
        "languages": list(SUPPORTED_LANGUAGES),
    }


@app.get("/health/db")
async def db_health():
    ready = getattr(app.state, "db_ready", False)
    err = getattr(app.state, "db_error", None)
    if ready:
        return {"status": "ok", "database": "connected"}
    return {"status": "error", "database": "disconnected", "detail": err}

# Include Routers
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(export.router)
app.include_router(ai.router)
app.include_router(feedback.router)
app.include_router(ocr.router)
app.include_router(graph.router)
app.include_router(handwriting.router)
app.include_router(user_settings.router)

if __name__ == "__main__":
    import sys
    import os
    # Ensure the current directory is in sys.path so 'app' can be imported
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        import uvicorn
    except ImportError:
        print("uvicorn is not installed. Install it with: pip install uvicorn")
        exit(1)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)