from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db, KnowledgeBase, Document
from services.knowledge_service import save_and_ingest_file, delete_knowledge_base

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KBCreate(BaseModel):
    name: str
    description: str = ""


@router.get("")
def list_knowledge_bases(db: Session = Depends(get_db)):
    kbs = db.query(KnowledgeBase).all()
    return {
        "knowledge_bases": [
            {
                "id": kb.id,
                "name": kb.name,
                "description": kb.description,
                "document_count": len(kb.documents),
                "total_chunks": sum(d.chunk_count for d in kb.documents),
                "created_at": kb.created_at.isoformat() if kb.created_at else None,
            }
            for kb in kbs
        ]
    }


@router.post("")
def create_knowledge_base(data: KBCreate, db: Session = Depends(get_db)):
    kb = KnowledgeBase(name=data.name, description=data.description)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return {"id": kb.id, "name": kb.name, "description": kb.description}


@router.post("/{kb_id}/upload")
async def upload_file(kb_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    doc = await save_and_ingest_file(db, kb_id, file)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "chunk_count": doc.chunk_count,
        "message": f"Ingested {doc.chunk_count} chunks from {doc.filename}",
    }


@router.get("/{kb_id}/documents")
def list_documents(kb_id: int, db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.knowledge_base_id == kb_id).all()
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "source_type": d.source_type,
                "chunk_count": d.chunk_count,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]
    }


@router.delete("/{kb_id}")
def delete_kb(kb_id: int, db: Session = Depends(get_db)):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    delete_knowledge_base(db, kb_id)
    return {"message": f"Knowledge base '{kb.name}' deleted"}
