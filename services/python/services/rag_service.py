from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import os
import re
from typing import Any

import numpy as np

from services.redaction_service import REDACTION_VERSION, redact_sensitive
from services.storage import bulk_insert, execute, fetch_all, initialize_database, rows_to_dicts
from services.vector_store_service import DEFAULT_EMBEDDING_MODEL, VectorStoreService

_embedding_model = None
_embedding_backend = None

vector_store = VectorStoreService()


@dataclass
class RetrievedChunk:
    source_type: str
    source_label: str
    excerpt: str
    score: float


def _get_embedding_model() -> tuple[Any, str]:
    global _embedding_model, _embedding_backend
    if _embedding_backend is not None:
        return _embedding_model, _embedding_backend

    if os.getenv("FINANCE_COPILOT_TEST_MODE") == "1":
        _embedding_model = False
        _embedding_backend = "lexical"
        return _embedding_model, _embedding_backend

    if os.getenv("GEMMA_RUNTIME", "").lower() != "disabled":
        try:
            from mlx_embeddings import EmbeddingModel

            _embedding_model = EmbeddingModel.from_pretrained(DEFAULT_EMBEDDING_MODEL)
            _embedding_backend = "mlx"
            return _embedding_model, _embedding_backend
        except Exception:
            pass

    try:
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        _embedding_backend = "sentence-transformers"
        return _embedding_model, _embedding_backend
    except Exception:
        _embedding_model = False
        _embedding_backend = "lexical"
        return _embedding_model, _embedding_backend


def _normalize_embeddings(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def _coerce_embedding(value: Any) -> np.ndarray:
    if isinstance(value, dict) and "embedding" in value:
        value = value["embedding"]
    return np.asarray(value, dtype=np.float32)


def _embed_texts(texts: list[str]) -> np.ndarray:
    model, backend = _get_embedding_model()
    if backend == "mlx" and model:
        try:
            embeddings = []
            for text in texts:
                vector = model.embed(text)
                embeddings.append(_coerce_embedding(vector))
            return _normalize_embeddings(np.vstack(embeddings))
        except Exception:
            return _lexical_embeddings(texts)
    if backend == "sentence-transformers" and model:
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(embeddings, dtype=np.float32)
    return _lexical_embeddings(texts)


def _lexical_embeddings(texts: list[str], dim: int = 512) -> np.ndarray:
    matrix = np.zeros((len(texts), dim), dtype=np.float32)
    for row_index, text in enumerate(texts):
        tokens = re.findall(r"[a-zA-Z0-9_]+", text.lower())
        for token in tokens:
            matrix[row_index, hash(token) % dim] += 1.0
    return _normalize_embeddings(matrix)


def _chunk_text(text: str, max_words: int = 90, overlap: int = 15) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks = []
    step = max(max_words - overlap, 1)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start:start + max_words]).strip()
        if chunk:
            chunks.append(chunk)
        if start + max_words >= len(words):
            break
    return chunks


def _write_legacy_chunks(document_id: int, source_type: str, source_label: str, chunks: list[str]) -> None:
    execute("DELETE FROM document_chunks WHERE document_id = ? AND source_type = ?", (document_id, source_type))
    if not chunks:
        return
    bulk_insert(
        """
        INSERT INTO document_chunks (document_id, source_type, source_label, chunk_text, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        """,
        [(document_id, source_type, source_label, chunk) for chunk in chunks],
    )


def index_document_text(
    document_id: int,
    source_label: str,
    text: str,
    source_type: str = "uploaded_document",
    original_hash: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    page_number: int | None = None,
) -> None:
    initialize_database()
    redacted_text = redact_sensitive(text)
    chunks = _chunk_text(redacted_text)
    _write_legacy_chunks(document_id, source_type, source_label, chunks)
    if not chunks:
        return

    embeddings = _embed_texts(chunks)
    created_at = datetime.utcnow().isoformat()
    resolved_entity_type = entity_type or ("invoice" if source_type == "invoice_document" else "document")
    resolved_entity_id = str(entity_id or document_id)
    chunk_records = []
    for index, chunk in enumerate(chunks):
        chunk_records.append(
            {
                "vector": embeddings[index].tolist(),
                "chunk_id": f"{source_type}:{document_id}:{index}",
                "doc_id": str(document_id),
                "entity_type": resolved_entity_type,
                "entity_id": resolved_entity_id,
                "source_type": source_type,
                "source_label": source_label,
                "original_hash": original_hash or "",
                "redacted_text": chunk,
                "content_preview": chunk[:500],
                "created_at": created_at,
                "embedding_model": DEFAULT_EMBEDDING_MODEL,
                "redaction_version": REDACTION_VERSION,
                "page_number": page_number,
            }
        )

    vector_store.upsert_chunks(chunk_records)
    vector_store.mark_indexed(
        str(document_id),
        source_type,
        DEFAULT_EMBEDDING_MODEL,
        REDACTION_VERSION,
    )


def _stored_document_candidates(prefer_financial_docs: bool = True) -> list[dict[str, Any]]:
    base_rows = rows_to_dicts(
        fetch_all("SELECT source_type, source_label, chunk_text FROM document_chunks ORDER BY id DESC")
    )
    if not prefer_financial_docs:
        return base_rows

    prioritized = [
        row
        for row in base_rows
        if row["source_type"] in {"uploaded_document", "invoice_document"}
    ]
    return prioritized or base_rows


def _rank_candidates(question: str, candidates: list[dict[str, Any]], top_k: int = 8) -> list[RetrievedChunk]:
    if not candidates:
        return []

    texts = [candidate["chunk_text"] for candidate in candidates]
    embeddings = _embed_texts(texts + [question])
    doc_embeddings = embeddings[:-1]
    query_embedding = embeddings[-1]
    vector_scores = np.dot(doc_embeddings, query_embedding)
    keyword_matches = dict(_keyword_match(question, candidates))

    ranked: list[tuple[int, float]] = []
    for index in range(len(candidates)):
        vector_score = float(vector_scores[index])
        keyword_score = keyword_matches.get(index, 0.0)
        ranked.append((index, (vector_score * 0.7) + (keyword_score * 0.3)))

    ranked.sort(key=lambda item: item[1], reverse=True)
    return [
        RetrievedChunk(
            source_type=candidates[index]["source_type"],
            source_label=candidates[index]["source_label"],
            excerpt=candidates[index]["chunk_text"],
            score=float(score),
        )
        for index, score in ranked[:top_k]
    ]


def build_ledger_context_chunks() -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []

    transactions = rows_to_dicts(fetch_all("SELECT * FROM transactions ORDER BY date DESC LIMIT 30"))
    for txn in transactions:
        chunks.append(
            {
                "source_type": "transaction",
                "source_label": f"Transaction {txn['date']}",
                "chunk_text": (
                    f"Transaction on {txn['date']}: {txn['description']}. "
                    f"Direction {txn['direction']}. Amount Rs {txn['amount']:.2f}. "
                    f"Category {txn['category']}. Confidence {txn['confidence']:.2f}."
                ),
            }
        )

    invoices = rows_to_dicts(fetch_all("SELECT * FROM invoices ORDER BY issue_date DESC LIMIT 20"))
    today = date.today()
    for invoice in invoices:
        due_date = date.fromisoformat(invoice["due_date"])
        overdue_days = max((today - due_date).days, 0) if invoice["status"] != "paid" else 0
        chunks.append(
            {
                "source_type": "invoice",
                "source_label": invoice["invoice_number"],
                "chunk_text": (
                    f"Invoice {invoice['invoice_number']} for client {invoice['client_name']}. "
                    f"Status {invoice['status']}. Total Rs {invoice['total_amount']:.2f}. "
                    f"GST amount Rs {invoice['gst_amount']:.2f}. Due date {invoice['due_date']}. "
                    f"Overdue days {overdue_days}. Hash {invoice['hash']}."
                ),
            }
        )

    proofs = rows_to_dicts(fetch_all("SELECT * FROM proof_records ORDER BY anchored_at DESC LIMIT 20"))
    for proof in proofs:
        chunks.append(
            {
                "source_type": "proof",
                "source_label": f"Proof {proof['id']}",
                "chunk_text": (
                    f"Proof record {proof['id']} for {proof['entity_type']} {proof['entity_id']}. "
                    f"Hash {proof['document_hash']}. Anchor type {proof['anchor_type']}. "
                    f"Transaction reference {proof['tx_id']}. Verification status {proof['verification_status']}."
                ),
            }
        )

    profile_rows = rows_to_dicts(fetch_all("SELECT * FROM users LIMIT 1"))
    for profile in profile_rows:
        chunks.append(
            {
                "source_type": "profile",
                "source_label": profile["name"],
                "chunk_text": (
                    f"Freelancer profile {profile['name']}. Profession {profile['profession']}. "
                    f"GST registered {bool(profile['gst_registered'])}. Preferred currency {profile['preferred_currency']}. "
                    f"Wallet address {profile['wallet_address'] or 'not provided'}."
                ),
            }
        )

    extracted_invoices = rows_to_dicts(fetch_all("SELECT * FROM extracted_invoices ORDER BY created_at DESC LIMIT 20"))
    for invoice in extracted_invoices:
        chunks.append(
            {
                "source_type": "incoming_invoice",
                "source_label": invoice.get("vendor_name") or invoice["file_name"],
                "chunk_text": (
                    f"Incoming invoice {invoice.get('invoice_number') or 'unknown number'} from {invoice.get('vendor_name') or invoice['file_name']}. "
                    f"Issue date {invoice.get('issue_date') or 'unknown'}. Due date {invoice.get('due_date') or 'unknown'}. "
                    f"Total Rs {(invoice.get('total_amount') or 0):.2f}. Suggested tags {', '.join(invoice.get('suggested_tags_json', [])) or 'none'}."
                ),
            }
        )

    tax_entries = rows_to_dicts(fetch_all("SELECT * FROM tax_passport_entries ORDER BY created_at DESC LIMIT 25"))
    for entry in tax_entries:
        chunks.append(
            {
                "source_type": "tax_passport",
                "source_label": entry["title"],
                "chunk_text": (
                    f"Tax passport entry {entry['title']} on {entry['entry_date']}. "
                    f"Tax type {entry['tax_type']}. Amount Rs {entry['amount']:.2f}. "
                    f"Tags {', '.join(entry.get('tags_json', [])) or 'none'}. Summary {entry['summary']}."
                ),
            }
        )

    return chunks


def _keyword_match(query: str, candidates: list[dict[str, Any]]) -> list[tuple[int, float]]:
    query_tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    matches = []
    for i, cand in enumerate(candidates):
        cand_tokens = set(re.findall(r"[a-z0-9]+", cand["chunk_text"].lower()))
        intersection = query_tokens.intersection(cand_tokens)
        if intersection:
            score = len(intersection) / max(len(query_tokens), 1)
            matches.append((i, score))
    return sorted(matches, key=lambda x: x[1], reverse=True)


def retrieve_document_context(question: str, top_k: int = 5) -> list[RetrievedChunk]:
    initialize_database()
    query_vector = _embed_texts([redact_sensitive(question)])[0].tolist()
    results = vector_store.search_similar(query_vector, limit=top_k)
    if results:
        return [
            RetrievedChunk(
                source_type=result.get("source_type", "document"),
                source_label=result.get("source_label", "Indexed Document"),
                excerpt=result.get("redacted_text") or result.get("content_preview") or "",
                score=float(result.get("score", 0.0)),
            )
            for result in results
        ]

    candidates = _stored_document_candidates(prefer_financial_docs=True)
    if not candidates:
        return []
    return _rank_candidates(question, candidates, top_k=top_k)


def retrieve_context(question: str, top_k: int = 8) -> list[RetrievedChunk]:
    initialize_database()
    document_results = retrieve_document_context(question, top_k=min(top_k, 5))
    if len(document_results) >= top_k:
        return document_results[:top_k]

    ledger_results = _rank_candidates(question, build_ledger_context_chunks(), top_k=top_k)
    seen = {(item.source_type, item.source_label, item.excerpt) for item in document_results}
    combined = list(document_results)
    for item in ledger_results:
        key = (item.source_type, item.source_label, item.excerpt)
        if key in seen:
            continue
        combined.append(item)
        seen.add(key)
        if len(combined) >= top_k:
            break
    return combined


def _legacy_document_text(document_id: int, source_type: str) -> str:
    rows = rows_to_dicts(
        fetch_all(
            """
            SELECT chunk_text
            FROM document_chunks
            WHERE document_id = ? AND source_type = ?
            ORDER BY id ASC
            """,
            (document_id, source_type),
        )
    )
    return "\n".join(row["chunk_text"] for row in rows if row.get("chunk_text")).strip()


def _invoice_fallback_text(invoice: dict[str, Any]) -> str:
    return (
        f"Invoice {invoice['invoice_number']} for {invoice['client_name']}. "
        f"Issue date {invoice['issue_date']}. Due date {invoice['due_date']}. "
        f"Subtotal Rs {invoice['subtotal']:.2f}. GST amount Rs {invoice['gst_amount']:.2f}. "
        f"Total amount Rs {invoice['total_amount']:.2f}. Notes {invoice.get('notes') or 'None'}."
    )


def backfill_existing_records() -> None:
    initialize_database()

    documents = rows_to_dicts(fetch_all("SELECT * FROM uploaded_documents ORDER BY id ASC"))
    for document in documents:
        if vector_store.is_document_indexed(
            str(document["id"]),
            "uploaded_document",
            DEFAULT_EMBEDDING_MODEL,
            REDACTION_VERSION,
        ):
            continue
        text = _legacy_document_text(document["id"], "uploaded_document")
        if not text:
            continue
        index_document_text(
            document["id"],
            document["file_name"],
            text,
            source_type="uploaded_document",
            original_hash=document.get("hash"),
            entity_type="document",
            entity_id=str(document["id"]),
        )

    invoices = rows_to_dicts(fetch_all("SELECT * FROM invoices ORDER BY id ASC"))
    for invoice in invoices:
        if vector_store.is_document_indexed(
            str(invoice["id"]),
            "invoice_document",
            DEFAULT_EMBEDDING_MODEL,
            REDACTION_VERSION,
        ):
            continue
        text = _legacy_document_text(invoice["id"], "invoice_document") or _invoice_fallback_text(invoice)
        index_document_text(
            invoice["id"],
            invoice["invoice_number"],
            text,
            source_type="invoice_document",
            original_hash=invoice.get("hash"),
            entity_type="invoice",
            entity_id=str(invoice["id"]),
        )


def generate_actionable_insights(user_id: int) -> list[dict[str, Any]]:
    """AI logic to generate dynamic, contextual insights."""
    transactions = rows_to_dicts(
        fetch_all("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 50", (user_id,))
    )
    invoices = rows_to_dicts(fetch_all("SELECT * FROM invoices WHERE user_id = ? AND status != 'paid'", (user_id,)))

    new_insights = []

    if len(invoices) > 0:
        total_unpaid = sum(inv["total_amount"] for inv in invoices)
        oldest_invoice = min(invoices, key=lambda x: x["due_date"])
        if date.fromisoformat(oldest_invoice["due_date"]) < date.today():
            new_insights.append(
                {
                    "insight_type": "collections",
                    "title": "Stalled Pipeline Alert",
                    "explanation": f"You have Rs {total_unpaid:,.2f} tied up in unpaid invoices. {oldest_invoice['client_name']} is past due.",
                    "priority": "high",
                    "why_it_matters": "Cashflow is the lifeblood of freelancing. Stalled payments reduce your ability to take on new prepayments.",
                }
            )

    total_spend = sum(t["amount"] for t in transactions if t["direction"] == "debit")
    software_spend = sum(
        t["amount"] for t in transactions if t["direction"] == "debit" and t["category"] == "software"
    )
    if total_spend > 0 and (software_spend / total_spend) > 0.15:
        new_insights.append(
            {
                "insight_type": "spending",
                "title": "Subscription Bloat Detected",
                "explanation": f"Your software expenditure is {software_spend/total_spend:.1%} of your total outgoings.",
                "priority": "medium",
                "why_it_matters": "Optimizing recurring tool costs is the fastest way to increase your net margin without increasing rates.",
            }
        )

    return new_insights
