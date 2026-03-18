import os
import shutil
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.orm import Session

from config import settings
from database import KnowledgeBase, Document
from rag.pipeline import ingest_file
from rag.retriever import delete_collection


def ensure_upload_dir():
    os.makedirs(settings.upload_dir, exist_ok=True)


async def save_and_ingest_file(db: Session, kb_id: int, file: UploadFile) -> Document:
    ensure_upload_dir()
    kb_dir = os.path.join(settings.upload_dir, str(kb_id))
    os.makedirs(kb_dir, exist_ok=True)

    filepath = os.path.join(kb_dir, file.filename)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    chunk_count = ingest_file(kb_id, filepath, file.filename)

    import hashlib
    content_hash = hashlib.sha256(content).hexdigest()[:16]

    doc = Document(
        knowledge_base_id=kb_id,
        filename=file.filename,
        source_type="local",
        content_hash=content_hash,
        chunk_count=chunk_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_knowledge_base(db: Session, kb_id: int):
    delete_collection(kb_id)

    kb_dir = os.path.join(settings.upload_dir, str(kb_id))
    if os.path.exists(kb_dir):
        shutil.rmtree(kb_dir)

    db.query(Document).filter(Document.knowledge_base_id == kb_id).delete()
    db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).delete()
    db.commit()
