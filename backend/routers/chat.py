import json
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, Conversation, Message, KnowledgeBase, SessionLocal
from services.chat_service import process_chat_message

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ConversationCreate(BaseModel):
    model: str = "claude-sonnet-4-6"
    title: str = "New Chat"
    system_prompt: str = ""


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    convos = db.query(Conversation).order_by(Conversation.updated_at.desc()).all()
    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "model": c.model,
                "system_prompt": c.system_prompt or "",
                "message_count": len(c.messages),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in convos
        ]
    }


@router.post("/conversations")
def create_conversation(data: ConversationCreate, db: Session = Depends(get_db)):
    convo = Conversation(model=data.model, title=data.title, system_prompt=data.system_prompt)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return {"id": convo.id, "model": convo.model, "title": convo.title}


@router.patch("/conversations/{convo_id}")
def update_conversation(convo_id: int, data: ConversationUpdate, db: Session = Depends(get_db)):
    convo = db.query(Conversation).filter(Conversation.id == convo_id).first()
    if not convo:
        return {"error": "Not found"}
    if data.title is not None:
        convo.title = data.title
    if data.system_prompt is not None:
        convo.system_prompt = data.system_prompt
    db.commit()
    return {"id": convo.id, "title": convo.title, "system_prompt": convo.system_prompt or ""}


@router.get("/conversations/{convo_id}/messages")
def get_messages(convo_id: int, db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(Message.conversation_id == convo_id).order_by(Message.created_at).all()
    return {
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat() if m.created_at else None}
            for m in msgs
        ]
    }


@router.delete("/conversations/{convo_id}")
def delete_conversation(convo_id: int, db: Session = Depends(get_db)):
    db.query(Message).filter(Message.conversation_id == convo_id).delete()
    db.query(Conversation).filter(Conversation.id == convo_id).delete()
    db.commit()
    return {"message": "Conversation deleted"}


@router.get("/conversations/{convo_id}/export")
def export_conversation(convo_id: int, db: Session = Depends(get_db)):
    convo = db.query(Conversation).filter(Conversation.id == convo_id).first()
    if not convo:
        return PlainTextResponse("Conversation not found", status_code=404)
    msgs = db.query(Message).filter(Message.conversation_id == convo_id).order_by(Message.created_at).all()
    lines = [f"# {convo.title}", f"Model: {convo.model}", f"Date: {convo.created_at}", ""]
    for m in msgs:
        prefix = "You" if m.role == "user" else "AI"
        lines.append(f"**{prefix}**: {m.content}")
        lines.append("")
    return PlainTextResponse("\n".join(lines), headers={"Content-Disposition": f'attachment; filename="chat_{convo_id}.md"'})


@router.delete("/messages/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db)):
    db.query(Message).filter(Message.id == message_id).delete()
    db.commit()
    return {"message": "Message deleted"}


@router.websocket("/ws/{convo_id}")
async def chat_websocket(websocket: WebSocket, convo_id: int):
    await websocket.accept()
    db = SessionLocal()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            user_message = msg.get("message", "")
            kb_ids = msg.get("kb_ids", [])
            system_prompt = msg.get("system_prompt")

            async for token in process_chat_message(db, convo_id, user_message, kb_ids, system_prompt):
                await websocket.send_text(json.dumps({"type": "token", "content": token}))

            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(e)}))
        except Exception:
            pass
    finally:
        db.close()
