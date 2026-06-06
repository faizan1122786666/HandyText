"""Unified AI provider layer.

Supports text generation and vision (image -> text) across several providers,
with one globally-selected model chosen in Settings. Providers:

  - gemini      Google Gemini (via google-generativeai SDK)
  - openai      OpenAI Chat Completions API
  - anthropic   Anthropic Messages API
  - openrouter  OpenRouter (OpenAI-compatible) — one key, many models

Configuration (selected model + per-provider API keys) is stored in
``AI/ai_config.json``. The legacy ``AI/gemini_key.txt`` / ``KEYS.txt`` / the
``.env`` GEMINI_API_KEY are still honoured for the Gemini key so existing
installs keep working with no migration step.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Optional, Tuple

import requests

from ..config import settings

# --------------------------------------------------------------------------- #
# Catalog
# --------------------------------------------------------------------------- #

# Provider metadata used by the Settings UI.
PROVIDERS = {
    "gemini": {
        "label": "Google Gemini",
        "key_url": "https://aistudio.google.com/apikey",
    },
    "openai": {
        "label": "OpenAI",
        "key_url": "https://platform.openai.com/api-keys",
    },
    "anthropic": {
        "label": "Anthropic (Claude)",
        "key_url": "https://console.anthropic.com/settings/keys",
    },
    "openrouter": {
        "label": "OpenRouter",
        "key_url": "https://openrouter.ai/keys",
    },
}

# Selectable models. Every model here is multimodal, so a single global choice
# works for both AI text suggestions and vision OCR.
MODEL_CATALOG = [
    {"id": "gemini-2.5-flash-lite", "label": "Gemini 2.5 Flash-Lite (fast, default)", "provider": "gemini"},
    {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "provider": "gemini"},
    {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro (best quality)", "provider": "gemini"},
    {"id": "gpt-4o-mini", "label": "GPT-4o mini (fast)", "provider": "openai"},
    {"id": "gpt-4o", "label": "GPT-4o", "provider": "openai"},
    {"id": "claude-3-5-haiku-latest", "label": "Claude 3.5 Haiku (fast)", "provider": "anthropic"},
    {"id": "claude-sonnet-4-5", "label": "Claude Sonnet 4.5 (best quality)", "provider": "anthropic"},
    {"id": "openai/gpt-4o", "label": "OpenRouter · GPT-4o", "provider": "openrouter"},
    {"id": "anthropic/claude-sonnet-4.5", "label": "OpenRouter · Claude Sonnet 4.5", "provider": "openrouter"},
    {"id": "google/gemini-2.5-flash", "label": "OpenRouter · Gemini 2.5 Flash", "provider": "openrouter"},
]

DEFAULT_MODEL = "gemini-2.5-flash-lite"

_ENV_VARS = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}

_IMAGE_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
    "bmp": "image/bmp",
}

_REQUEST_TIMEOUT = 120  # seconds

# --------------------------------------------------------------------------- #
# Config storage
# --------------------------------------------------------------------------- #

_AI_DIR = os.path.join(os.getcwd(), "AI")
_CONFIG_PATH = os.path.join(_AI_DIR, "ai_config.json")
_LEGACY_GEMINI_PATH = os.path.join(_AI_DIR, "gemini_key.txt")
_MASTER_KEYS_PATH = os.path.join(os.getcwd(), "KEYS.txt")


def load_config() -> dict:
    if os.path.exists(_CONFIG_PATH):
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data.setdefault("selected_model", DEFAULT_MODEL)
                data.setdefault("keys", {})
                if not isinstance(data["keys"], dict):
                    data["keys"] = {}
                return data
        except Exception:
            pass
    return {"selected_model": DEFAULT_MODEL, "keys": {}}


def save_config(cfg: dict) -> None:
    os.makedirs(_AI_DIR, exist_ok=True)
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def _legacy_gemini_key() -> str:
    """Read the Gemini key from the pre-existing file locations."""
    if os.path.exists(_MASTER_KEYS_PATH):
        try:
            with open(_MASTER_KEYS_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        key = line.strip().split("=", 1)[1]
                        if key and key != "your_gemini_api_key_here":
                            return key
        except OSError:
            pass

    if os.path.exists(_LEGACY_GEMINI_PATH):
        try:
            with open(_LEGACY_GEMINI_PATH, "r", encoding="utf-8") as f:
                key = f.read().strip()
                if key:
                    return key
        except OSError:
            pass
    return ""


# --------------------------------------------------------------------------- #
# Keys & model selection
# --------------------------------------------------------------------------- #

def get_provider_key(provider: str) -> str:
    """Resolve an API key for a provider: config -> legacy files -> env/.env."""
    cfg = load_config()
    key = (cfg.get("keys", {}).get(provider) or "").strip()
    if key:
        return key

    if provider == "gemini":
        legacy = _legacy_gemini_key()
        if legacy:
            return legacy

    env_name = _ENV_VARS.get(provider)
    if env_name:
        env_val = (os.environ.get(env_name) or "").strip()
        if env_val:
            return env_val

    if provider == "gemini" and settings.GEMINI_API_KEY:
        return settings.GEMINI_API_KEY.strip()

    return ""


def set_provider_key(provider: str, key: str) -> None:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    cfg = load_config()
    cfg.setdefault("keys", {})[provider] = (key or "").strip()
    save_config(cfg)


def delete_provider_key(provider: str) -> None:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    cfg = load_config()
    cfg.get("keys", {}).pop(provider, None)
    save_config(cfg)
    # Also clear the legacy Gemini key file so a removal really removes it.
    if provider == "gemini" and os.path.exists(_LEGACY_GEMINI_PATH):
        try:
            os.remove(_LEGACY_GEMINI_PATH)
        except OSError:
            pass


def _model_provider(model_id: str) -> Optional[str]:
    for m in MODEL_CATALOG:
        if m["id"] == model_id:
            return m["provider"]
    return None


def get_selected_model() -> str:
    cfg = load_config()
    model = cfg.get("selected_model")
    if model and _model_provider(model):
        return model
    return DEFAULT_MODEL


def set_selected_model(model_id: str) -> None:
    if not _model_provider(model_id):
        raise ValueError(f"Unknown model: {model_id}")
    cfg = load_config()
    cfg["selected_model"] = model_id
    save_config(cfg)


def resolve_active() -> Optional[Tuple[str, str, str]]:
    """Return (provider, model_id, api_key) for the active model.

    If the selected model's provider has no key, fall back to Gemini, then to
    any other provider that does have a key. Returns ``None`` when no provider
    is configured at all.
    """
    model = get_selected_model()
    provider = _model_provider(model) or "gemini"
    key = get_provider_key(provider)
    if key:
        return provider, model, key

    gemini_key = get_provider_key("gemini")
    if gemini_key:
        return "gemini", DEFAULT_MODEL, gemini_key

    for pid in PROVIDERS:
        k = get_provider_key(pid)
        if k:
            fallback_model = next((m["id"] for m in MODEL_CATALOG if m["provider"] == pid), None)
            if fallback_model:
                return pid, fallback_model, k
    return None


def has_any_key() -> bool:
    return resolve_active() is not None


def provider_label(provider: str) -> str:
    return PROVIDERS.get(provider, {}).get("label", provider.title())


def mask_key(key: str) -> str:
    key = (key or "").strip()
    if not key:
        return ""
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


def provider_status() -> list:
    """Per-provider configuration state for the Settings UI."""
    out = []
    for pid, meta in PROVIDERS.items():
        key = get_provider_key(pid)
        out.append({
            "id": pid,
            "label": meta["label"],
            "key_url": meta["key_url"],
            "configured": bool(key),
            "masked": mask_key(key),
        })
    return out


def ai_settings() -> dict:
    """Full payload consumed by GET /settings/ai."""
    return {
        "selected_model": get_selected_model(),
        "models": MODEL_CATALOG,
        "providers": provider_status(),
    }


# --------------------------------------------------------------------------- #
# Provider calls
# --------------------------------------------------------------------------- #

def _encode_image(image_path: str) -> Tuple[str, str]:
    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    media_type = _IMAGE_MEDIA_TYPES.get(ext, "image/png")
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return b64, media_type


# -- Gemini (SDK) ----------------------------------------------------------- #

async def _gemini_text(model: str, key: str, prompt: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=key)
    gen_model = genai.GenerativeModel(model)
    response = await gen_model.generate_content_async(prompt)
    return (getattr(response, "text", "") or "").strip()


def _gemini_vision(model: str, key: str, prompt: str, image_path: str) -> str:
    import google.generativeai as genai
    from PIL import Image

    genai.configure(api_key=key)
    gen_model = genai.GenerativeModel(model)
    with Image.open(image_path) as image:
        response = gen_model.generate_content([prompt, image])
    return (getattr(response, "text", "") or "").strip()


# -- OpenAI / OpenRouter (Chat Completions) --------------------------------- #

def _openai_base_url(provider: str) -> str:
    return "https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1"


def _openai_chat(provider: str, model: str, key: str, content, max_tokens: int = 3072) -> str:
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        # Optional attribution headers recommended by OpenRouter.
        headers["HTTP-Referer"] = "https://handytext.app"
        headers["X-Title"] = "HandyText"

    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": max_tokens,
    }
    resp = requests.post(
        f"{_openai_base_url(provider)}/chat/completions",
        json=body,
        headers=headers,
        timeout=_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    return (choices[0].get("message", {}).get("content") or "").strip()


# -- Anthropic (Messages) --------------------------------------------------- #

def _anthropic_messages(model: str, key: str, content, max_tokens: int = 3072) -> str:
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content}],
    }
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        json=body,
        headers=headers,
        timeout=_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    parts = data.get("content") or []
    return "".join(
        part.get("text", "") for part in parts if part.get("type") == "text"
    ).strip()


# -- Dispatchers ------------------------------------------------------------ #

def _text_via_rest(provider: str, model: str, key: str, prompt: str) -> str:
    if provider == "anthropic":
        return _anthropic_messages(model, key, prompt)
    # openai + openrouter
    return _openai_chat(provider, model, key, prompt)


def _vision_via_rest(provider: str, model: str, key: str, prompt: str, image_path: str) -> str:
    b64, media_type = _encode_image(image_path)
    if provider == "anthropic":
        content = [
            {"type": "text", "text": prompt},
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
        ]
        return _anthropic_messages(model, key, content)
    content = [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
    ]
    return _openai_chat(provider, model, key, content)


async def generate_text(prompt: str) -> Optional[str]:
    """Generate text with the active model. Returns ``None`` if no key is set."""
    resolved = resolve_active()
    if not resolved:
        return None
    provider, model, key = resolved
    if provider == "gemini":
        return await _gemini_text(model, key, prompt)
    return await asyncio.to_thread(_text_via_rest, provider, model, key, prompt)


def generate_vision(prompt: str, image_path: str) -> Optional[dict]:
    """Read text from an image with the active model.

    Returns ``{"text", "provider", "model", "engine"}`` or ``None`` when no
    provider key is configured.
    """
    resolved = resolve_active()
    if not resolved:
        return None
    provider, model, key = resolved
    if provider == "gemini":
        text = _gemini_vision(model, key, prompt, image_path)
    else:
        text = _vision_via_rest(provider, model, key, prompt, image_path)
    return {
        "text": (text or "").strip(),
        "provider": provider,
        "model": model,
        "engine": f"{provider_label(provider)} Vision",
    }
