import json
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, ConnectorConfig, KnowledgeBase, Document
from connectors.base import get_all_connectors, get_connector
from rag.pipeline import chunk_text
from rag.embeddings import embed_texts
from rag.retriever import add_chunks

router = APIRouter(prefix="/api/connectors", tags=["connectors"])


class ConnectorConnect(BaseModel):
    name: str
    config: dict = {}


@router.get("")
def list_connectors(db: Session = Depends(get_db)):
    all_types = get_all_connectors()
    configs = db.query(ConnectorConfig).all()
    config_map = {c.connector_type: c for c in configs}

    result = []
    for ctype, connector in all_types.items():
        cfg = config_map.get(ctype)
        result.append({
            "type": ctype,
            "display_name": connector.display_name,
            "description": connector.description,
            "icon": connector.icon,
            "is_connected": cfg.is_active if cfg else False,
            "config_id": cfg.id if cfg else None,
            "last_sync": cfg.last_sync.isoformat() if cfg and cfg.last_sync else None,
            "config_schema": connector.get_config_schema(),
        })
    return {"connectors": result}


@router.post("/{connector_type}/connect")
async def connect_source(connector_type: str, data: ConnectorConnect, db: Session = Depends(get_db)):
    connector = get_connector(connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail=f"Connector type '{connector_type}' not found")

    valid = await connector.validate_connection(data.config)
    if not valid:
        raise HTTPException(status_code=400, detail="Connection validation failed. Check your credentials and make sure IMAP is enabled.")

    cfg = ConnectorConfig(
        connector_type=connector_type,
        name=data.name,
        config_json=json.dumps(data.config),
        is_active=True,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return {"id": cfg.id, "message": f"Connected to {connector.display_name}"}


@router.post("/{config_id}/sync")
async def sync_connector(config_id: int, db: Session = Depends(get_db)):
    """Fetch documents from a connector and ingest them into a knowledge base."""
    cfg = db.query(ConnectorConfig).filter(ConnectorConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Connector config not found")

    connector = get_connector(cfg.connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector type not found")

    config = json.loads(cfg.config_json)

    # Fetch documents from the connector
    try:
        documents = await connector.fetch_documents(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch: {str(e)}")

    if not documents:
        cfg.last_sync = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Sync complete - no documents found", "documents_synced": 0, "chunks_created": 0}

    # Find or create a knowledge base for this connector
    kb_name = f"{cfg.name} ({connector.display_name})"
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.name == kb_name).first()
    if not kb:
        kb = KnowledgeBase(name=kb_name, description=f"Auto-synced from {connector.display_name}")
        db.add(kb)
        db.commit()
        db.refresh(kb)

    # Ingest each document
    total_chunks = 0
    docs_synced = 0
    for doc in documents:
        if not doc.content.strip():
            continue

        content_hash = hashlib.sha256(doc.content.encode()).hexdigest()[:16]

        # Skip if already ingested (same content hash)
        existing = db.query(Document).filter(
            Document.knowledge_base_id == kb.id,
            Document.content_hash == content_hash,
        ).first()
        if existing:
            continue

        # Chunk and embed
        chunks = chunk_text(doc.content)
        if not chunks:
            continue

        embeddings = embed_texts(chunks)
        ids = [f"{content_hash}_{i}" for i in range(len(chunks))]
        metadatas = [{
            "filename": doc.filename,
            "chunk_index": i,
            "kb_id": kb.id,
            **(doc.metadata or {}),
        } for i in range(len(chunks))]

        add_chunks(kb.id, chunks, embeddings, metadatas, ids)

        # Record in database
        db_doc = Document(
            knowledge_base_id=kb.id,
            filename=doc.filename,
            source_type=cfg.connector_type,
            content_hash=content_hash,
            chunk_count=len(chunks),
        )
        db.add(db_doc)
        total_chunks += len(chunks)
        docs_synced += 1

    # Update last_sync timestamp
    cfg.last_sync = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": f"Sync complete! {docs_synced} documents indexed with {total_chunks} chunks.",
        "documents_synced": docs_synced,
        "chunks_created": total_chunks,
        "knowledge_base_id": kb.id,
        "knowledge_base_name": kb_name,
    }


@router.get("/active-kb")
def get_active_kb(db: Session = Depends(get_db)):
    """Get or create the KB for the first active connector (for drag-drop uploads)."""
    cfg = db.query(ConnectorConfig).filter(ConnectorConfig.is_active == True).first()
    if not cfg:
        return {"kb_id": None, "message": "No active connector"}

    connector = get_connector(cfg.connector_type)
    if not connector:
        return {"kb_id": None, "message": "Connector type not found"}

    kb_name = f"{cfg.name} ({connector.display_name})"
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.name == kb_name).first()
    if not kb:
        kb = KnowledgeBase(name=kb_name, description=f"Auto-synced from {connector.display_name}")
        db.add(kb)
        db.commit()
        db.refresh(kb)

    return {"kb_id": kb.id, "kb_name": kb.name, "connector_type": cfg.connector_type}


@router.get("/email/preview")
async def email_preview(db: Session = Depends(get_db)):
    """Fetch a quick preview of the last 10 emails from connected email account."""
    cfg = db.query(ConnectorConfig).filter(
        ConnectorConfig.connector_type == "email",
        ConnectorConfig.is_active == True,
    ).first()

    if not cfg:
        # Fall back to demo emails seeded in app_settings
        from database import AppSettings
        demo = db.query(AppSettings).filter(AppSettings.key == 'demo_emails').first()
        if demo:
            emails = json.loads(demo.value)
            return {"connected": True, "demo": True, "account": "maya@velaskincare.com", "provider": "demo", "total": len(emails), "emails": emails}
        return {"connected": False, "emails": [], "message": "No email account connected"}

    connector = get_connector("email")
    config = json.loads(cfg.config_json)

    # Override max_emails to just fetch 10 for preview
    config["max_emails"] = 10

    try:
        documents = await connector.fetch_documents(config)
    except Exception as e:
        return {"connected": True, "emails": [], "error": str(e)}

    emails = []
    for doc in documents:
        meta = doc.metadata or {}
        emails.append({
            "subject": meta.get("subject", "(No Subject)"),
            "from": meta.get("from", "Unknown"),
            "date": meta.get("date", ""),
            "preview": doc.content[:200].replace("\n", " ").strip(),
        })

    return {
        "connected": True,
        "account": config.get("email", ""),
        "provider": config.get("provider", ""),
        "total": len(emails),
        "emails": emails,
    }


@router.get("/email/{email_index}")
async def get_full_email(email_index: int, db: Session = Depends(get_db)):
    """Fetch the full content of a single email by its index."""
    cfg = db.query(ConnectorConfig).filter(
        ConnectorConfig.connector_type == "email",
        ConnectorConfig.is_active == True,
    ).first()

    if not cfg:
        raise HTTPException(status_code=404, detail="No email account connected")

    connector = get_connector("email")
    config = json.loads(cfg.config_json)
    config["max_emails"] = 10

    try:
        documents = await connector.fetch_documents(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if email_index < 0 or email_index >= len(documents):
        raise HTTPException(status_code=404, detail="Email index out of range")

    doc = documents[email_index]
    meta = doc.metadata or {}
    return {
        "subject": meta.get("subject", "(No Subject)"),
        "from": meta.get("from", "Unknown"),
        "to": meta.get("to", ""),
        "date": meta.get("date", ""),
        "body": doc.content,
    }


@router.delete("/{config_id}")
def disconnect_source(config_id: int, db: Session = Depends(get_db)):
    cfg = db.query(ConnectorConfig).filter(ConnectorConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Connector config not found")
    db.delete(cfg)
    db.commit()
    return {"message": "Disconnected"}
