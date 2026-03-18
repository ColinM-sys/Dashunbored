def build_rag_prompt(query: str, context_docs: list[dict], system_prompt: str = None) -> list[dict]:
    if not context_docs:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": query})
        return messages

    context_text = "\n\n---\n\n".join(
        f"[Source: {doc['metadata'].get('filename', 'unknown')}]\n{doc['content']}"
        for doc in context_docs
    )

    rag_system = f"""You are a helpful AI assistant. Use the following context documents to answer the user's question. If the context doesn't contain relevant information, say so and answer based on your general knowledge.

CONTEXT DOCUMENTS:
{context_text}"""

    if system_prompt:
        rag_system = f"{system_prompt}\n\n{rag_system}"

    return [
        {"role": "system", "content": rag_system},
        {"role": "user", "content": query},
    ]
