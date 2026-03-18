import hashlib
from pathlib import Path

from rag.embeddings import embed_texts
from rag.retriever import add_chunks, query_all_knowledge_bases, get_or_create_collection
from rag.prompt_builder import build_rag_prompt
from config import settings


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    if chunk_size is None:
        chunk_size = settings.chunk_size
    if overlap is None:
        overlap = settings.chunk_overlap

    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def extract_text(filepath: str) -> str:
    path = Path(filepath)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        import fitz
        doc = fitz.open(filepath)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text

    elif suffix in (".docx", ".doc"):
        from docx import Document as DocxDocument
        doc = DocxDocument(filepath)
        return "\n".join(p.text for p in doc.paragraphs)

    elif suffix in (".txt", ".md", ".csv", ".json", ".jsonl"):
        return path.read_text(encoding="utf-8")

    elif suffix in (".html", ".htm"):
        from bs4 import BeautifulSoup
        html = path.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        return soup.get_text(separator="\n")

    elif suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return _describe_image(filepath, suffix)

    else:
        return path.read_text(encoding="utf-8")


def _describe_image(filepath: str, suffix: str) -> str:
    """Use Claude vision to describe an image for indexing."""
    import base64
    import anthropic as _anthropic

    from config import settings as _settings

    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
    media_type = mime_map.get(suffix, "image/jpeg")

    with open(filepath, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode("utf-8")

    client = _anthropic.Anthropic(api_key=_settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64}
                },
                {
                    "type": "text",
                    "text": (
                        "You are indexing this image for a creative asset library. "
                        "Describe it in detail covering: subject/scene, mood and atmosphere, "
                        "lighting quality and direction, color palette, composition style, "
                        "any visible products or props, and overall aesthetic. "
                        "Write as a single descriptive paragraph a creative director could search against."
                    )
                }
            ]
        }]
    )
    filename = Path(filepath).name
    description = response.content[0].text.strip()
    return f"Image: {filename}\n\n{description}"


def ingest_file(kb_id: int, filepath: str, filename: str) -> int:
    text = extract_text(filepath)
    if not text.strip():
        return 0

    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = embed_texts(chunks)
    content_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
    ids = [f"{content_hash}_{i}" for i in range(len(chunks))]
    metadatas = [{"filename": filename, "chunk_index": i, "kb_id": kb_id} for i in range(len(chunks))]

    add_chunks(kb_id, chunks, embeddings, metadatas, ids)
    return len(chunks)


def retrieve_and_build_prompt(query: str, kb_ids: list[int], system_prompt: str = None) -> list[dict]:
    if not kb_ids:
        return build_rag_prompt(query, [], system_prompt)

    context_docs = query_all_knowledge_bases(kb_ids, query)
    return build_rag_prompt(query, context_docs, system_prompt)
