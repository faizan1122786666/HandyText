"""User-configurable AI settings — selected model and per-provider API keys.

Keys and the chosen model are stored in AI/ai_config.json (see ai_providers).
The legacy AI/gemini_key.txt / KEYS.txt / .env GEMINI_API_KEY are still read as
a fallback, so existing installs keep working. Reads happen per request, so a
newly saved key/model takes effect immediately — no restart.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..models.user import User
from ..utils.auth import get_current_user
from ..services import ai_providers

router = APIRouter(prefix="/settings", tags=["Settings"])


class ApiKeyIn(BaseModel):
    api_key: str


class ProviderKeyIn(BaseModel):
    provider: str
    api_key: str


class ModelIn(BaseModel):
    model: str


# --------------------------------------------------------------------------- #
# Multi-provider AI settings
# --------------------------------------------------------------------------- #

@router.get("/ai")
async def get_ai_settings(current_user: User = Depends(get_current_user)):
    """Selected model, the model catalog, and per-provider key status."""
    return ai_providers.ai_settings()


@router.post("/ai/model")
async def set_ai_model(body: ModelIn, current_user: User = Depends(get_current_user)):
    try:
        ai_providers.set_selected_model(body.model)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unknown model")
    return ai_providers.ai_settings()


@router.post("/ai/key")
async def set_ai_key(body: ProviderKeyIn, current_user: User = Depends(get_current_user)):
    provider = (body.provider or "").strip().lower()
    if provider not in ai_providers.PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    key = (body.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if len(key) < 10:
        raise HTTPException(status_code=400, detail="That doesn't look like a valid API key")
    ai_providers.set_provider_key(provider, key)
    return ai_providers.ai_settings()


@router.delete("/ai/key/{provider}")
async def delete_ai_key(provider: str, current_user: User = Depends(get_current_user)):
    provider = (provider or "").strip().lower()
    if provider not in ai_providers.PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    ai_providers.delete_provider_key(provider)
    return ai_providers.ai_settings()


# --------------------------------------------------------------------------- #
# Legacy Gemini-only endpoints (kept for backward compatibility)
# --------------------------------------------------------------------------- #

@router.get("/gemini-key")
async def get_gemini_key(current_user: User = Depends(get_current_user)):
    key = ai_providers.get_provider_key("gemini")
    return {"configured": bool(key), "masked": ai_providers.mask_key(key) if key else ""}


@router.post("/gemini-key")
async def set_gemini_key(body: ApiKeyIn, current_user: User = Depends(get_current_user)):
    key = (body.api_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if len(key) < 10:
        raise HTTPException(status_code=400, detail="That doesn't look like a valid API key")
    ai_providers.set_provider_key("gemini", key)
    return {"configured": True, "masked": ai_providers.mask_key(key)}


@router.delete("/gemini-key")
async def delete_gemini_key(current_user: User = Depends(get_current_user)):
    ai_providers.delete_provider_key("gemini")
    return {"configured": False, "masked": ""}
