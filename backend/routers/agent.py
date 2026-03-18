"""Creative Agent router for Dashunbored.

The agent runs an autonomous agentic loop using Claude with tools:
- search_assets: search the knowledge base for images, docs, references
- web_search: find inspiration or references online
- analyze_image: describe and give creative feedback on an uploaded image
- generate_brief: produce a structured creative brief from a description
- suggest_palette: suggest a color palette for a project

POST /api/agent/run  — start an agent task (streams SSE)
GET  /api/agent/tasks — list recent tasks
"""

import asyncio
import base64
import json
import time
import uuid
from typing import AsyncGenerator

import anthropic
import fastapi
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings

router = APIRouter(prefix="/api/agent", tags=["agent"])

# In-memory task store (resets on restart — fine for demo)
_tasks: dict[str, dict] = {}

AGENT_SYSTEM_PROMPT = """You are a creative AI collaborator inside Dashunbored — a unified creative workspace for designers, photographers, and digital artists.

You think like a senior creative director: specific, opinionated, visual, and practical.

## How to handle each task type

**Photography review / shoot feedback:**
1. Use web_search to find best practices and references for that photography category and brand type
2. Give specific, actionable feedback: lighting rationale, composition, color treatment, storytelling gaps
3. Suggest concrete next steps the photographer can actually do

**Creative brief generation:**
1. Call generate_brief with the project description and type
2. Fill in the returned scaffold completely — every section, no placeholders
3. Be specific about visual direction, tone, and what to avoid

**Color palette:**
1. Call suggest_palette with mood, industry, and avoid parameters
2. Fill in the returned scaffold with real hex codes and specific rationale
3. Explain why the combination works psychologically for the brand

**Style direction / campaign:**
1. Use web_search to find relevant visual references and trends
2. Give detailed art direction: camera angles, lighting setups, casting direction, wardrobe, location feel
3. Name specific photographers, films, or campaigns as reference points

## Rules
- Always produce complete, ready-to-use output — never leave sections blank or say "insert here"
- Be opinionated. Say what works and what doesn't, and why.
- Use your tools before answering when research would improve the output
- Label your final deliverable as "## Creative Output" so it gets highlighted in the UI
- Keep reasoning turns short — get to the output quickly
"""

TOOLS = [
    {
        "name": "search_assets",
        "description": "Search the team's uploaded asset library and knowledge base for relevant images, documents, or references matching a query.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (e.g. 'product photography dark background', 'brand guidelines')"},
                "top_k": {"type": "integer", "description": "Number of results to return", "default": 5}
            },
            "required": ["query"]
        }
    },
    {
        "name": "web_search",
        "description": "Search the web for creative inspiration, references, trends, or technical information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "generate_brief",
        "description": "Generate a structured creative brief from a rough project description. Returns a formatted brief with objectives, deliverables, tone, audience, and style direction.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {"type": "string", "description": "Rough project description from the client or team"},
                "project_type": {"type": "string", "description": "Type of project: 'photography', 'design', 'video', 'branding', 'social'", "default": "design"}
            },
            "required": ["description"]
        }
    },
    {
        "name": "suggest_palette",
        "description": "Suggest a color palette for a project based on mood, brand, or reference description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "mood": {"type": "string", "description": "Mood or feeling (e.g. 'bold and energetic', 'calm and minimal', 'luxury dark')"},
                "industry": {"type": "string", "description": "Industry or sector (e.g. 'fashion', 'tech', 'food', 'nonprofit')"},
                "avoid": {"type": "string", "description": "Colors or vibes to avoid", "default": ""}
            },
            "required": ["mood"]
        }
    }
]


def _run_tool(name: str, inputs: dict) -> str:
    """Execute a tool and return its result as a string."""
    if name == "search_assets":
        try:
            from rag.retriever import retrieve_chunks
            query = inputs["query"]
            top_k = inputs.get("top_k", 5)
            results = retrieve_chunks(query, top_k=top_k)
            if not results:
                return f"No assets found matching '{query}'."
            lines = [f"Found {len(results)} asset(s) matching '{query}':"]
            for i, r in enumerate(results, 1):
                source = r.get("metadata", {}).get("source", "unknown")
                text = r.get("text", "")[:300]
                lines.append(f"\n[{i}] Source: {source}\n{text}...")
            return "\n".join(lines)
        except Exception as e:
            return f"Asset search error: {e}"

    elif name == "web_search":
        try:
            import httpx
            query = inputs["query"]
            resp = httpx.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                timeout=10
            )
            data = resp.json()
            results = []
            if data.get("AbstractText"):
                results.append(data["AbstractText"])
            for r in data.get("RelatedTopics", [])[:4]:
                if isinstance(r, dict) and r.get("Text"):
                    results.append(r["Text"])
            return "\n\n".join(results) if results else f"No web results found for '{query}'."
        except Exception as e:
            return f"Web search error: {e}"

    elif name == "generate_brief":
        desc = inputs["description"]
        ptype = inputs.get("project_type", "design")
        return f"""BRIEF SCAFFOLD — fill every section based on: "{desc}" (type: {ptype})

REQUIRED OUTPUT FORMAT:
## Creative Brief

**Project:** [name]
**Type:** {ptype}
**Date:** [today]

### Objective
[1-2 sentences: what this project must achieve]

### The Client / Brand
[Who they are, their values, what makes them distinct]

### Target Audience
[Demographics + psychographics. Be specific — age, lifestyle, values, media habits]

### Key Message
[Single sentence that everything else ladders up to]

### Tone & Voice
[3-5 adjectives + 1 sentence explanation. What it should feel like, what it should NOT feel like]

### Visual Direction
[Specific direction for photography style, typography mood, layout approach, color territory]

### Deliverables
[Bulleted list of what's being produced]

### References / Inspiration
[2-3 specific references with brief explanation of what to take from each]

### What to Avoid
[Explicit no-go territory — competitors, clichés, visual traps for this category]

Fill this entirely — do not leave any section blank."""

    elif name == "suggest_palette":
        mood = inputs["mood"]
        industry = inputs.get("industry", "general")
        avoid = inputs.get("avoid", "")
        avoid_note = f"\nAVOID: {avoid}" if avoid else ""
        return f"""PALETTE SCAFFOLD — mood: "{mood}", industry: "{industry}"{avoid_note}

REQUIRED OUTPUT FORMAT:
## Color Palette

**Palette Name:** [give it a name that captures the feeling]
**Mood:** {mood}
**Industry:** {industry}

### Primary Color
- Hex: #______
- Name: [descriptive name]
- Use: [what it anchors — hero backgrounds, headers, CTAs]
- Why it works: [1 sentence]

### Secondary Color
- Hex: #______
- Name: [descriptive name]
- Use: [supporting role]
- Why it works: [1 sentence]

### Accent Color
- Hex: #______
- Name: [descriptive name]
- Use: [pops, highlights, interactive elements]
- Why it works: [1 sentence]

### Neutral / Background
- Hex: #______
- Name: [descriptive name]
- Use: [base layer, text backgrounds]

### Text Color
- Hex: #______
- Use: [body text, fine print]

### Palette Psychology
[2-3 sentences on why this combination works for the mood and industry]

### What to Avoid
[Colors or combinations that would undermine this palette]

Fill all hex values with real, specific codes."""

    return f"Unknown tool: {name}"


def _is_ollama_model(model: str) -> bool:
    return not model.startswith("claude-")


def _convert_tools_for_ollama(tools: list[dict]) -> list[dict]:
    """Convert Anthropic tool format to Ollama/OpenAI tool format."""
    ollama_tools = []
    for t in tools:
        ollama_tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t.get("input_schema", {}),
            }
        })
    return ollama_tools


async def _agent_stream(task_id: str, prompt: str, api_key: str) -> AsyncGenerator[str, None]:
    """Run the agentic loop and yield SSE events."""
    use_ollama = _is_ollama_model(settings.agent_model)

    if not use_ollama:
        client = anthropic.Anthropic(api_key=api_key)
    messages = [{"role": "user", "content": prompt}]
    turn = 0
    max_turns = 10

    _tasks[task_id]["status"] = "running"

    try:
        while turn < max_turns:
            turn += 1
            yield f"data: {json.dumps({'type': 'turn', 'turn': turn})}\n\n"

            if use_ollama:
                from services.ollama_service import chat_with_tools
                ollama_tools = _convert_tools_for_ollama(TOOLS)
                response = await chat_with_tools(
                    model=settings.agent_model,
                    messages=messages,
                    tools=ollama_tools,
                    system=AGENT_SYSTEM_PROMPT,
                )
                # Normalize to object with .content and .stop_reason
                class _Resp:
                    def __init__(self, d):
                        self.stop_reason = d["stop_reason"]
                        self.content = [type("B", (), b)() for b in d["content"]]
                response = _Resp(response)
            else:
                response = client.messages.create(
                    model=settings.agent_model,
                    max_tokens=4096,
                    system=AGENT_SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages,
                )

            # Collect text and tool uses from response
            assistant_content = []
            for block in response.content:
                if block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                    yield f"data: {json.dumps({'type': 'text', 'text': block.text})}\n\n"
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input
                    })
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': block.name, 'input': block.input})}\n\n"

            messages.append({"role": "assistant", "content": assistant_content})

            if response.stop_reason == "end_turn":
                break

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = _run_tool(block.name, block.input)
                        yield f"data: {json.dumps({'type': 'tool_result', 'tool': block.name, 'result': result[:500]})}\n\n"
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result
                        })
                messages.append({"role": "user", "content": tool_results})

        _tasks[task_id]["status"] = "done"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        _tasks[task_id]["status"] = "error"
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


class RunAgentRequest(BaseModel):
    prompt: str
    task_name: str = "Creative Task"


@router.post("/run")
async def run_agent(req: RunAgentRequest, x_user_api_key: str = fastapi.Header(default="", alias="X-User-API-Key")):
    api_key = x_user_api_key.strip() or settings.anthropic_api_key
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key. Enter your Anthropic key in the banner above.")

    task_id = str(uuid.uuid4())
    _tasks[task_id] = {
        "id": task_id,
        "name": req.task_name,
        "prompt": req.prompt,
        "status": "pending",
        "created_at": time.time()
    }

    async def event_stream():
        async for chunk in _agent_stream(task_id, req.prompt, api_key):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Task-ID": task_id
    })


@router.get("/tasks")
async def list_tasks():
    tasks = sorted(_tasks.values(), key=lambda t: t["created_at"], reverse=True)
    return tasks[:20]


IMAGE_SCORE_PROMPT = """You are an expert photo analyst and social media strategist. Analyze this image and score it on how well it will perform when posted on social media.

Return your analysis in this EXACT JSON format (no markdown, just raw JSON):
{
  "overall_score": <0-100>,
  "verdict": "<one punchy sentence — will it perform or not>",
  "scores": {
    "composition": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence specific to this image>" },
    "lighting": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence specific to this image>" },
    "color": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence specific to this image>" },
    "sharpness": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence specific to this image>" },
    "subject_clarity": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence specific to this image>" },
    "scroll_stop_power": { "score": <0-100>, "label": "<Good/Needs Work/Poor>", "note": "<1 sentence — would someone pause scrolling for this?>" }
  },
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific actionable improvement 1>", "<specific actionable improvement 2>", "<specific actionable improvement 3>"],
  "best_platform": "<Instagram/LinkedIn/Twitter/TikTok thumbnail/Pinterest>",
  "caption_tip": "<one specific tip for the caption or hashtag strategy that would help this particular image>"
}

Be honest and specific. Reference actual elements visible in the image."""


@router.post("/score-image")
async def score_image(file: UploadFile = File(...), x_user_api_key: str = fastapi.Header(default="", alias="X-User-API-Key")):
    api_key = x_user_api_key.strip() or settings.anthropic_api_key
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key. Enter your Anthropic key in the banner above.")

    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}. Use JPEG, PNG, GIF, or WebP.")

    image_data = await file.read()
    if len(image_data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 20MB.")

    b64 = base64.standard_b64encode(image_data).decode("utf-8")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=settings.agent_model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": content_type,
                        "data": b64,
                    }
                },
                {
                    "type": "text",
                    "text": IMAGE_SCORE_PROMPT
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if Claude wraps in them
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse score response: {raw[:200]}")

    return result
