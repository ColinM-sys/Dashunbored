import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, AppSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SystemPromptUpdate(BaseModel):
    model: str = "default"
    prompt: str = ""


class APIKeyUpdate(BaseModel):
    provider: str
    api_key: str


class BrandingUpdate(BaseModel):
    app_name: str = "Dashunbored"
    accent_color: str = "#7c83ff"
    logo_text: str = ""


class AgentModelUpdate(BaseModel):
    model: str


def _get_setting(db: Session, key: str) -> str:
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    return setting.value if setting else ""


def _set_setting(db: Session, key: str, value: str):
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = AppSettings(key=key, value=value)
        db.add(setting)
    db.commit()


@router.get("/system-prompts")
def get_system_prompts(db: Session = Depends(get_db)):
    raw = _get_setting(db, "system_prompts")
    prompts = json.loads(raw) if raw else {}
    return {"prompts": prompts}


@router.put("/system-prompts")
def set_system_prompt(data: SystemPromptUpdate, db: Session = Depends(get_db)):
    raw = _get_setting(db, "system_prompts")
    prompts = json.loads(raw) if raw else {}
    prompts[data.model] = data.prompt
    _set_setting(db, "system_prompts", json.dumps(prompts))
    return {"prompts": prompts}


@router.get("/api-keys")
def get_api_keys(db: Session = Depends(get_db)):
    raw = _get_setting(db, "api_keys")
    keys = json.loads(raw) if raw else {}

    # Include the config.py key as fallback for anthropic
    from config import settings as app_settings
    result = {}

    # Anthropic
    stored_key = keys.get("anthropic", "")
    active_key = stored_key or app_settings.anthropic_api_key
    result["anthropic"] = {
        "configured": bool(active_key),
        "masked": f"...{active_key[-8:]}" if active_key else "",
        "source": "admin" if stored_key else ("config" if active_key else "none"),
    }

    # Integrations (Zoom OAuth app credentials are global/admin-only)
    result["integrations"] = {
        "zoom_client_id": keys.get("zoom_client_id", ""),
        "zoom_client_secret_set": bool(keys.get("zoom_client_secret", "")),
    }

    return {"api_keys": result}


@router.put("/api-keys")
def set_api_key(data: APIKeyUpdate, db: Session = Depends(get_db)):
    raw = _get_setting(db, "api_keys")
    keys = json.loads(raw) if raw else {}
    keys[data.provider] = data.api_key
    _set_setting(db, "api_keys", json.dumps(keys))

    # Update the live settings so it takes effect immediately
    from config import settings as app_settings
    if data.provider == "anthropic":
        app_settings.anthropic_api_key = data.api_key

    return {"status": "saved"}


@router.delete("/api-keys/{provider}")
def delete_api_key(provider: str, db: Session = Depends(get_db)):
    raw = _get_setting(db, "api_keys")
    keys = json.loads(raw) if raw else {}
    keys.pop(provider, None)
    _set_setting(db, "api_keys", json.dumps(keys))
    return {"status": "removed"}


@router.get("/branding")
def get_branding(db: Session = Depends(get_db)):
    raw = _get_setting(db, "branding")
    if raw:
        return json.loads(raw)
    return {"app_name": "AdminDashbored", "accent_color": "#7c83ff", "logo_text": ""}


@router.put("/branding")
def set_branding(data: BrandingUpdate, db: Session = Depends(get_db)):
    branding = data.model_dump()
    _set_setting(db, "branding", json.dumps(branding))
    return branding


@router.get("/agent-model")
def get_agent_model(db: Session = Depends(get_db)):
    model = _get_setting(db, "agent_model") or "claude-haiku-4-5-20251001"
    return {"model": model}


@router.put("/agent-model")
def set_agent_model(data: AgentModelUpdate, db: Session = Depends(get_db)):
    _set_setting(db, "agent_model", data.model)
    from config import settings as app_settings
    app_settings.agent_model = data.model
    return {"model": data.model}
