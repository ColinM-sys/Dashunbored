from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, Conversation, Message, KnowledgeBase, Document, ConnectorConfig

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
@router.get("/summary")
def get_analytics(db: Session = Depends(get_db)):
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    total_user_messages = db.query(func.count(Message.id)).filter(Message.role == "user").scalar() or 0
    total_ai_messages = db.query(func.count(Message.id)).filter(Message.role == "assistant").scalar() or 0
    total_kbs = db.query(func.count(KnowledgeBase.id)).scalar() or 0
    total_docs = db.query(func.count(Document.id)).scalar() or 0
    active_connectors = db.query(func.count(ConnectorConfig.id)).filter(ConnectorConfig.is_active == True).scalar() or 0

    # Model usage
    model_usage = (
        db.query(Conversation.model, func.count(Conversation.id))
        .group_by(Conversation.model)
        .all()
    )

    # Recent conversations
    recent = (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "total_user_messages": total_user_messages,
        "total_ai_messages": total_ai_messages,
        "total_knowledge_bases": total_kbs,
        "total_documents": total_docs,
        "active_connectors": active_connectors,
        "model_usage": [{"model": m, "count": c} for m, c in model_usage],
        "recent_conversations": [
            {"id": c.id, "title": c.title, "model": c.model, "message_count": len(c.messages)}
            for c in recent
        ],
    }
