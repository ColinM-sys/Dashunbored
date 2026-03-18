import chromadb
from config import settings
from rag.embeddings import embed_query

_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_dir)
    return _client


def get_or_create_collection(kb_id: int) -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"kb_{kb_id}", metadata={"hnsw:space": "cosine"})


def add_chunks(kb_id: int, chunks: list[str], embeddings: list[list[float]], metadatas: list[dict], ids: list[str]):
    collection = get_or_create_collection(kb_id)
    collection.add(documents=chunks, embeddings=embeddings, metadatas=metadatas, ids=ids)


def query_knowledge_base(kb_id: int, query: str, top_k: int = None) -> list[dict]:
    if top_k is None:
        top_k = settings.top_k
    collection = get_or_create_collection(kb_id)
    if collection.count() == 0:
        return []
    query_embedding = embed_query(query)
    results = collection.query(query_embeddings=[query_embedding], n_results=min(top_k, collection.count()))
    docs = []
    for i, doc in enumerate(results["documents"][0]):
        docs.append({
            "content": doc,
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "distance": results["distances"][0][i] if results["distances"] else 0,
        })
    return docs


def query_all_knowledge_bases(kb_ids: list[int], query: str, top_k: int = None) -> list[dict]:
    all_results = []
    for kb_id in kb_ids:
        results = query_knowledge_base(kb_id, query, top_k)
        all_results.extend(results)
    all_results.sort(key=lambda x: x["distance"])
    if top_k is None:
        top_k = settings.top_k
    return all_results[:top_k]


def delete_collection(kb_id: int):
    client = get_chroma_client()
    try:
        client.delete_collection(name=f"kb_{kb_id}")
    except ValueError:
        pass
