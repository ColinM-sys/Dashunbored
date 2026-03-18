"""Proxy routes for ComfyUI — avoids CORS issues when frontend and ComfyUI are on different hosts."""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

COMFY_BASE = "http://100.121.201.104:8188"

router = APIRouter(prefix="/api/diffusion", tags=["diffusion"])


@router.post("/prompt")
async def queue_prompt(request: Request):
    body = await request.body()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{COMFY_BASE}/prompt", content=body, headers={"Content-Type": "application/json"})
    return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")


@router.get("/history/{prompt_id}")
async def get_history(prompt_id: str):
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{COMFY_BASE}/history/{prompt_id}")
    return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")


@router.get("/view")
async def view_image(request: Request):
    params = dict(request.query_params)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{COMFY_BASE}/view", params=params)
    return Response(content=resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type", "image/png"))


@router.get("/system_stats")
async def system_stats():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{COMFY_BASE}/system_stats")
        return Response(content=resp.content, status_code=resp.status_code, media_type="application/json")
    except Exception:
        return {"error": "ComfyUI not reachable", "online": False}
