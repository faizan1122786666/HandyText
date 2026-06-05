"""User-configurable settings — currently the personal Gemini API key.

The key is written to AI/gemini_key.txt, which ai_service.get_gemini_api_key()
already reads (and which takes precedence over the .env GEMINI_API_KEY). Reads
happen per request, so a newly saved key takes effect immediately — no restart.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..models.user import User
from ..utils.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])

_KEY_DIR = os.path.join(os.getcwd(), "AI")
_KEY_PATH = os.path.join(_KEY_DIR, "gemini_key.txt")


class ApiKeyIn(BaseModel):
    api_key: str


def _mask(key: str) -> str:
    key = (key or "").strip()
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


def _read_key() -> str:
    if os.path.exists(_KEY_PATH):
        with open(_KEY_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


@router.get("/gemini-key")
async def get_gemini_key(current_user: User = Depends(get_current_user)):
    key = _read_key()
    return {"configured": bool(key), "masked": _mask(key) if key else ""}


@router.post("/gemini-key")
async def set_gemini_key(body: ApiKeyIn, current_user: User = Depends(get_current_user)):
    key = (body.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if len(key) < 10:
        raise HTTPException(status_code=400, detail="That doesn't look like a valid API key")
    os.makedirs(_KEY_DIR, exist_ok=True)
    with open(_KEY_PATH, "w", encoding="utf-8") as f:
        f.write(key)
    return {"configured": True, "masked": _mask(key)}


@router.delete("/gemini-key")
async def delete_gemini_key(current_user: User = Depends(get_current_user)):
    if os.path.exists(_KEY_PATH):
        os.remove(_KEY_PATH)
    return {"configured": False, "masked": ""}
