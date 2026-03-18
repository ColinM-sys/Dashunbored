import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from database import Conversation, Message
from services.ollama_service import chat_stream as ollama_chat_stream
from services.claude_service import chat_stream as claude_chat_stream, is_claude_model
from rag.pipeline import retrieve_and_build_prompt

DEFAULT_SYSTEM_PROMPT = """You are DashBored AI, a helpful and knowledgeable assistant built into the AdminDashbored platform.

You can help with any topic. When the user has selected knowledge bases (emails, documents, files), relevant context from those sources will be provided to you automatically. Use that context to answer questions accurately.

Be direct, helpful, and conversational.

SCHEDULING MEETINGS:
When a user asks you to schedule a meeting, Zoom call, or any calendar event with someone, extract the details and respond with a SCHEDULE_MEETING block. The block MUST be valid JSON inside an HTML comment, like this:

<!-- SCHEDULE_MEETING {"title":"Meeting with Sarah","start_time":"2026-02-23T14:00:00","end_time":"2026-02-23T15:00:00","invitees":["sarah@example.com"],"create_zoom":true} -->

Rules:
- Always include title, start_time (ISO 8601), end_time (ISO 8601), invitees (array of emails), and create_zoom (boolean).
- If the user doesn't specify a duration, default to 1 hour.
- If the user says "tomorrow at 3pm", calculate the actual date.
- Today's date is provided by the system. Use it to calculate relative dates.
- You can include a brief message before or after the block to explain what you're doing.
- If you don't have enough info (no email or no time), ask the user to clarify instead of guessing."""


async def process_chat_message(
    db: Session,
    conversation_id: int,
    user_message: str,
    kb_ids: list[int] = None,
    system_prompt: str = None,
):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return

    # Use default system prompt if none provided
    if not system_prompt:
        system_prompt = DEFAULT_SYSTEM_PROMPT

    # Inject current date for scheduling
    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
    system_prompt = system_prompt.replace(
        "Today's date is provided by the system.",
        f"Today's date is {today}."
    )

    # Save user message
    user_msg = Message(conversation_id=conversation_id, role="user", content=user_message)
    db.add(user_msg)
    db.commit()

    # Update conversation title from first message
    if len(conversation.messages) <= 1:
        conversation.title = user_message[:100]
        db.commit()

    # Get conversation history
    history = [{"role": m.role, "content": m.content} for m in conversation.messages]

    # If knowledge bases selected, use RAG
    if kb_ids:
        rag_messages = retrieve_and_build_prompt(user_message, kb_ids, system_prompt)
        # Merge: RAG system prompt + conversation history + RAG user prompt
        system_msg = next((m for m in rag_messages if m["role"] == "system"), None)
        if system_msg:
            messages = [system_msg] + history
        else:
            messages = history
    else:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.extend(history)

    # Route to correct provider
    full_response = ""
    if is_claude_model(conversation.model):
        # Stream response from Claude API
        async for token in claude_chat_stream(conversation.model, messages):
            full_response += token
            yield token
    else:
        # Stream response from Ollama
        async for line in ollama_chat_stream(conversation.model, messages):
            try:
                data = json.loads(line)
                token = data.get("message", {}).get("content", "")
                full_response += token
                yield token
            except json.JSONDecodeError:
                continue

    # Save assistant response
    if full_response:
        assistant_msg = Message(conversation_id=conversation_id, role="assistant", content=full_response)
        db.add(assistant_msg)
        db.commit()
