import json
import httpx
from config import settings


async def chat_with_tools(model: str, messages: list[dict], tools: list[dict], system: str = None) -> dict:
    """Call Ollama with tool definitions. Returns a normalized response matching Anthropic's shape."""
    payload = {
        "model": model,
        "messages": messages,
        "tools": tools,
        "stream": False,
    }
    if system:
        payload["messages"] = [{"role": "system", "content": system}] + payload["messages"]

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{settings.ollama_url}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()

    msg = data.get("message", {})
    content = []

    # Ollama returns tool_calls as a list on the message
    tool_calls = msg.get("tool_calls") or []
    text = msg.get("content", "")

    if text and text.strip():
        content.append({"type": "text", "text": text.strip()})

    for i, tc in enumerate(tool_calls):
        fn = tc.get("function", {})
        args = fn.get("arguments", {})
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        content.append({
            "type": "tool_use",
            "id": f"ollama_tool_{i}",
            "name": fn.get("name", ""),
            "input": args,
        })

    stop_reason = "end_turn" if not tool_calls else "tool_use"
    return {"content": content, "stop_reason": stop_reason}


async def list_models() -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{settings.ollama_url}/api/tags")
        resp.raise_for_status()
        data = resp.json()
        return data.get("models", [])


async def chat_stream(model: str, messages: list[dict], system: str = None):
    payload = {"model": model, "messages": messages, "stream": True}
    if system:
        payload["messages"] = [{"role": "system", "content": system}] + payload["messages"]

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", f"{settings.ollama_url}/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.strip():
                    yield line


async def chat_sync(model: str, messages: list[dict], system: str = None) -> str:
    payload = {"model": model, "messages": messages, "stream": False}
    if system:
        payload["messages"] = [{"role": "system", "content": system}] + payload["messages"]

    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{settings.ollama_url}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")
