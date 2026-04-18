"""
embed_knowledge.py
------------------
Run ONCE before starting the server to chunk and embed the GST knowledge base.
Uses embeddings via LM Studio (OpenAI-compatible API).

Usage:
    python embed_knowledge.py
"""

import os
import re
import chromadb
import requests
from pathlib import Path

from openai import OpenAI

from project_env import load_project_dotenv

load_project_dotenv()

_client = OpenAI(
    base_url=os.getenv("EMBED_URL", "http://localhost:1234/v1"),
    api_key="lm-studio"
)

# ── Config ──────────────────────────────────────────────────────────────────
KNOWLEDGE_FILE = Path(__file__).parent / "gst_rules.md"
CHROMA_PATH    = Path(__file__).parent / "chroma_db"
COLLECTION_TAX = "tax_knowledge"
CHUNK_SIZE     = 400   # tokens approx — ~1600 chars
CHUNK_OVERLAP  = 60    # overlap to preserve context at boundaries
# ────────────────────────────────────────────────────────────────────────────


def get_embedding(text: str) -> list[float]:
    """Get embeddings via LM Studio."""
    response = _client.embeddings.create(
        model=os.getenv("EMBED_MODEL", "text-embedding-nomic-embed-text-v1.5"),
        input=text
    )
    return response.data[0].embedding


def chunk_markdown(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """
    Smart chunking strategy:
    1. Split on level-2 (##) headers first — each section is a semantic unit.
    2. If a section is too long, split further by level-3 (###) headers.
    3. If still too long, do sliding-window character chunking.
    Returns list of {"text": ..., "section": ..., "chunk_id": ...}
    """
    chunks = []
    # Split by ## headers
    sections = re.split(r'\n(?=## )', text)

    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Extract section title
        lines = section.splitlines()
        title = lines[0].lstrip('#').strip() if lines else "Unknown"

        # If section fits in one chunk, keep it whole
        if len(section) <= chunk_size * 4:  # ~4 chars per token
            chunks.append({
                "text": section,
                "section": title,
                "chunk_id": f"{title[:40]}__0"
            })
            continue

        # Otherwise split by ### sub-headers
        subsections = re.split(r'\n(?=### )', section)
        for i, sub in enumerate(subsections):
            sub = sub.strip()
            if not sub:
                continue
            sub_lines = sub.splitlines()
            sub_title = sub_lines[0].lstrip('#').strip() if sub_lines else title

            if len(sub) <= chunk_size * 4:
                chunks.append({
                    "text": sub,
                    "section": f"{title} > {sub_title}",
                    "chunk_id": f"{title[:30]}__{sub_title[:20]}__{i}"
                })
            else:
                # Sliding window fallback for very long blocks
                words = sub.split()
                step = chunk_size - overlap
                for j in range(0, len(words), step):
                    window = " ".join(words[j: j + chunk_size])
                    chunks.append({
                        "text": window,
                        "section": f"{title} > {sub_title} (part {j // step + 1})",
                        "chunk_id": f"{title[:25]}__{sub_title[:15]}__{i}_{j}"
                    })

    return chunks


def build_tax_knowledge_collection(client: chromadb.PersistentClient):
    """Embed and store the GST rules knowledge base."""
    print(f"📖 Loading knowledge file: {KNOWLEDGE_FILE}")
    text = KNOWLEDGE_FILE.read_text(encoding="utf-8")

    # Delete existing collection to allow re-runs
    try:
        client.delete_collection(COLLECTION_TAX)
        print(f"🗑  Deleted existing '{COLLECTION_TAX}' collection.")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_TAX,
        metadata={"hnsw:space": "cosine"}
    )

    chunks = chunk_markdown(text)
    print(f"✂️  Created {len(chunks)} chunks from knowledge base.")

    ids, embeddings, documents, metadatas = [], [], [], []

    for i, chunk in enumerate(chunks):
        print(f"  Embedding chunk {i + 1}/{len(chunks)}: {chunk['section'][:60]}...")
        emb = get_embedding(chunk["text"])
        ids.append(chunk["chunk_id"])
        embeddings.append(emb)
        documents.append(chunk["text"])
        metadatas.append({"section": chunk["section"], "source": "gst_rules.md"})

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )
    print(f"\n✅ Tax knowledge base ready: {len(chunks)} chunks in '{COLLECTION_TAX}'")


def ensure_user_docs_collection(client: chromadb.PersistentClient):
    """Create the user documents collection if it doesn't exist."""
    try:
        client.get_collection("user_documents")
        print("✅ 'user_documents' collection already exists.")
    except Exception:
        client.create_collection(
            name="user_documents",
            metadata={"hnsw:space": "cosine"}
        )
        print("✅ Created empty 'user_documents' collection.")


def main():
    print("🚀 2ASK Knowledge Base Embedder")
    print("=" * 40)

    _base = os.getenv("EMBED_URL", "http://localhost:1234/v1").rstrip("/")
    try:
        requests.get(f"{_base}/models", timeout=3).raise_for_status()
        print("✅ LM Studio is running.")
    except Exception:
        print("❌ LM Studio not reachable. Check EMBED_URL / LM Studio Local Server.")
        return

    test_emb = get_embedding("test")
    print(f"✅ Embeddings working via LM Studio. Dim: {len(test_emb)}")

    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    build_tax_knowledge_collection(client)
    ensure_user_docs_collection(client)

    print("\n🎉 Done! Run: uvicorn main:app --reload")


if __name__ == "__main__":
    main()
