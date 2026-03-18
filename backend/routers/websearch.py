from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchQuery(BaseModel):
    query: str
    max_results: int = 8


@router.post("")
async def web_search(data: SearchQuery):
    """Search the web using DuckDuckGo."""
    from duckduckgo_search import DDGS

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(data.query, max_results=data.max_results))
        return {
            "query": data.query,
            "results": [
                {
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                }
                for r in results
            ],
        }
    except Exception as e:
        return {"query": data.query, "results": [], "error": str(e)}
