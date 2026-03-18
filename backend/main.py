import sys
from pathlib import Path

# Ensure backend dir is on path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db, SessionLocal, User

# Import connectors to trigger registration
import connectors.local_files  # noqa: F401
import connectors.dropbox  # noqa: F401
import connectors.google_drive  # noqa: F401
import connectors.sharepoint  # noqa: F401
import connectors.database_connector  # noqa: F401
import connectors.web_scraper  # noqa: F401
import connectors.email_connector  # noqa: F401
import connectors.slack_teams  # noqa: F401
import connectors.crm_connector  # noqa: F401
import connectors.cloud_storage  # noqa: F401
import connectors.adobe_cc  # noqa: F401
import connectors.frameio  # noqa: F401
import connectors.figma  # noqa: F401
import connectors.behance  # noqa: F401
import connectors.unsplash  # noqa: F401
import connectors.notion  # noqa: F401

from routers import chat, knowledge, models, connectors as connectors_router, auth, analytics, settings as settings_router, homepage, websearch, calendar
from routers import agent

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(models.router)
app.include_router(connectors_router.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(homepage.router)
app.include_router(websearch.router)
app.include_router(calendar.router)
app.include_router(agent.router)


@app.on_event("startup")
def startup():
    init_db()

    # Create default admin user if none exists
    db = SessionLocal()
    try:
        if not db.query(User).first():
            from routers.auth import hash_password
            admin = User(username="admin", password_hash=hash_password("admin"), role="admin")
            db.add(admin)
            db.commit()
            print("Created default admin user (admin/admin)")
        # Load stored API keys from database
        try:
            import json
            from database import AppSettings
            stored = db.query(AppSettings).filter(AppSettings.key == "api_keys").first()
            if stored and stored.value:
                keys = json.loads(stored.value)
                if keys.get("anthropic"):
                    settings.anthropic_api_key = keys["anthropic"]
                    print(f"Loaded Anthropic API key from database")
        except Exception:
            pass
    finally:
        db.close()

    # Pre-warm embedding model
    from rag.embeddings import get_embedding_model
    print(f"Loading embedding model ({settings.embedding_model})...")
    get_embedding_model()
    print("Embedding model loaded!")
    print(f"\n{'='*50}")
    print(f"  {settings.app_name} is running!")
    print(f"  Backend: http://localhost:{settings.port}")
    print(f"  Ollama:  {settings.ollama_url}")
    print(f"  Default login: admin / admin")
    print(f"{'='*50}\n")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
