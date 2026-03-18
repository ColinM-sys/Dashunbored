import os
import json
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db, Conversation, Message, Document, KnowledgeBase

router = APIRouter(prefix="/api/homepage", tags=["homepage"])

IMAGES_DIR = os.path.join(Path(settings.upload_dir).parent, "images")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}
DOC_EXTS = {".pdf", ".docx", ".doc", ".txt", ".md", ".csv", ".json", ".jsonl",
            ".html", ".htm", ".xlsx", ".pptx", ".rtf", ".xml", ".yaml", ".yml"}


@router.get("/history")
def recent_history(db: Session = Depends(get_db)):
    """Last 5 conversations with their first user message."""
    convos = db.query(Conversation).order_by(Conversation.updated_at.desc()).limit(5).all()
    items = []
    for c in convos:
        first_msg = db.query(Message).filter(
            Message.conversation_id == c.id,
            Message.role == "user",
        ).order_by(Message.created_at).first()
        items.append({
            "id": c.id,
            "title": c.title,
            "preview": (first_msg.content[:120] + "...") if first_msg and len(first_msg.content) > 120 else (first_msg.content if first_msg else ""),
            "model": c.model,
            "message_count": len(c.messages),
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })
    return {"history": items}


@router.get("/documents")
def recent_documents(db: Session = Depends(get_db)):
    """All non-image documents across knowledge bases."""
    docs = db.query(Document).order_by(Document.created_at.desc()).limit(20).all()
    items = []
    for d in docs:
        ext = Path(d.filename).suffix.lower()
        if ext in IMAGE_EXTS:
            continue  # skip images — they go in the images panel
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == d.knowledge_base_id).first()
        items.append({
            "id": d.id,
            "filename": d.filename,
            "source_type": d.source_type,
            "chunk_count": d.chunk_count,
            "knowledge_base": kb.name if kb else "Unknown",
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })
    sources = sorted(set(d["source_type"] for d in items if d.get("source_type")))
    return {"documents": items[:10], "total": len(items), "sources": sources}


@router.get("/images")
def list_images(db: Session = Depends(get_db)):
    """List images from connected services + local gallery."""
    images = []
    sources = set()

    # 1. Images from knowledge bases (connected services)
    docs = db.query(Document).order_by(Document.created_at.desc()).limit(50).all()
    for d in docs:
        ext = Path(d.filename).suffix.lower()
        if ext in IMAGE_EXTS:
            kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == d.knowledge_base_id).first()
            images.append({
                "filename": d.filename,
                "url": None,  # no direct URL for service images
                "source_type": d.source_type,
                "knowledge_base": kb.name if kb else "Unknown",
                "uploaded_at": d.created_at.isoformat() if d.created_at else None,
                "origin": "service",
            })
            if d.source_type:
                sources.add(d.source_type)

    # 2. Local gallery images
    os.makedirs(IMAGES_DIR, exist_ok=True)
    for f in sorted(Path(IMAGES_DIR).iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.suffix.lower() in IMAGE_EXTS:
            images.append({
                "filename": f.name,
                "url": f"/api/homepage/images/{f.name}",
                "source_type": "local",
                "knowledge_base": None,
                "uploaded_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
                "origin": "local",
            })
    sources.add("local")

    return {"images": images[:12], "total": len(images), "sources": sorted(sources)}


@router.post("/images/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image to the gallery."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}
    ext = Path(file.filename).suffix.lower()
    if ext not in image_exts:
        return {"error": f"Unsupported image type: {ext}"}

    filepath = os.path.join(IMAGES_DIR, file.filename)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    return {"filename": file.filename, "url": f"/api/homepage/images/{file.filename}", "size": len(content)}


@router.get("/images/{filename}")
def serve_image(filename: str):
    """Serve an uploaded image."""
    filepath = os.path.join(IMAGES_DIR, filename)
    if not os.path.exists(filepath):
        return {"error": "Not found"}
    return FileResponse(filepath)


@router.get("/apps")
def list_apps():
    """List all available app squares for the homepage."""
    apps = [
        # Creative Tools
        {"id": "adobe_cc", "name": "Adobe CC", "icon": "adobe_cc", "emoji": "🅰", "description": "Lightroom, CC Libraries", "category": "creative"},
        {"id": "figma", "name": "Figma", "icon": "figma", "emoji": "🎨", "description": "Design files & components", "category": "creative"},
        {"id": "frameio", "name": "Frame.io", "icon": "frameio", "emoji": "🎬", "description": "Video review & comments", "category": "creative"},
        {"id": "behance", "name": "Behance", "icon": "behance", "emoji": "✦", "description": "Portfolio & inspiration", "category": "creative"},
        {"id": "stable_diffusion", "name": "Stable Diffusion", "icon": "stable_diffusion", "emoji": "🖼", "description": "AI image generation", "category": "creative"},
        {"id": "unsplash", "name": "Unsplash", "icon": "unsplash", "emoji": "📷", "description": "Stock photography", "category": "creative"},
        {"id": "notion", "name": "Notion", "icon": "notion", "emoji": "📓", "description": "Briefs & docs", "category": "creative"},
        # Storage & Files
        {"id": "dropbox", "name": "Dropbox", "icon": "dropbox", "emoji": "D", "description": "Cloud files", "category": "storage"},
        {"id": "google_drive", "name": "Google Drive", "icon": "google_drive", "emoji": "G", "description": "Drive files", "category": "storage"},
        {"id": "sharepoint", "name": "SharePoint", "icon": "sharepoint", "emoji": "S", "description": "Microsoft 365", "category": "storage"},
        {"id": "aws_s3", "name": "AWS S3", "icon": "aws_s3", "emoji": "S3", "description": "S3 buckets", "category": "storage"},
        # Communication
        {"id": "email", "name": "Email", "icon": "mail", "emoji": "E", "description": "Gmail & Outlook", "category": "communication"},
        {"id": "slack", "name": "Slack", "icon": "slack", "emoji": "Sl", "description": "Channels & DMs", "category": "communication"},
        # Business
        {"id": "hubspot", "name": "HubSpot", "icon": "hubspot", "emoji": "H", "description": "Marketing CRM", "category": "business"},
        {"id": "web_scraper", "name": "Web Scraper", "icon": "web_scraper", "emoji": "W", "description": "Scrape URLs", "category": "business"},
    ]
    return {"apps": apps}
