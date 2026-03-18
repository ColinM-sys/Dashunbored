from fastapi import APIRouter
from services.claude_service import get_available_models as get_claude_models
from services import ollama_service

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def list_models():
    claude_models = get_claude_models()
    try:
        ollama_raw = await ollama_service.list_models()
        ollama_models = [{"name": m["name"], "id": m["name"], "provider": "ollama"} for m in ollama_raw]
    except Exception:
        ollama_models = []
    return {"models": claude_models + ollama_models}
