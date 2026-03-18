from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    app_name: str = "Dashunbored"
    ollama_url: str = "http://100.121.201.104:11434"
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'dashunbored.db'}"
    chroma_dir: str = str(BASE_DIR / "data" / "chroma")
    upload_dir: str = str(BASE_DIR / "data" / "uploads")
    anthropic_api_key: str = ""  # Set via Admin → API Keys or ANTHROPIC_API_KEY env var
    agent_model: str = "claude-haiku-4-5-20251001"
    embedding_model: str = "all-MiniLM-L6-v2"
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 5
    host: str = "0.0.0.0"
    port: int = 3000
    secret_key: str = "dashunbored-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

settings = Settings()
