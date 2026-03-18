import anthropic
from config import settings

CLAUDE_MODELS = [
    {"id": "claude-opus-4-6", "name": "Claude Opus 4.6"},
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
    {"id": "claude-opus-4-20250514", "name": "Claude Opus 4"},
    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
]


def is_claude_model(model: str) -> bool:
    return model.startswith("claude-")


def get_available_models() -> list[dict]:
    if not settings.anthropic_api_key:
        return []
    return [
        {
            "name": m["id"],
            "model": m["id"],
            "display_name": m["name"],
            "provider": "anthropic",
        }
        for m in CLAUDE_MODELS
    ]


async def chat_stream(model: str, messages: list[dict], system: str = None):
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Separate system message from conversation messages
    system_text = system or ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            chat_messages.append({"role": m["role"], "content": m["content"]})

    # Ensure messages alternate user/assistant and start with user
    if not chat_messages or chat_messages[0]["role"] != "user":
        chat_messages.insert(0, {"role": "user", "content": "Hello"})

    with client.messages.stream(
        model=model,
        max_tokens=4096,
        system=system_text if system_text else anthropic.NOT_GIVEN,
        messages=chat_messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
