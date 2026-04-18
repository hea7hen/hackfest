from pathlib import Path

from services.vector_store_service import (
    DEFAULT_EMBEDDING_MODEL,
    VectorStoreService,
)


def _sample_chunk():
    return {
        "vector": [0.1, 0.2, 0.3],
        "chunk_id": "chunk-1",
        "doc_id": "doc-1",
        "entity_type": "document",
        "entity_id": "1",
        "source_type": "uploaded_document",
        "source_label": "invoice.pdf",
        "original_hash": "abc123",
        "redacted_text": "Invoice total [REDACTED]",
        "content_preview": "Invoice total [REDACTED]",
        "created_at": "2026-04-18T00:00:00",
        "embedding_model": DEFAULT_EMBEDDING_MODEL,
        "redaction_version": "v1",
    }


def test_vector_store_initializes_local_table(tmp_path):
    service = VectorStoreService(db_path=tmp_path / "vectors")

    assert service.table_name == "financial_records"
    assert Path(service.db_path).exists()


def test_upsert_and_search_round_trip(tmp_path):
    service = VectorStoreService(db_path=tmp_path / "vectors")

    service.upsert_chunks([_sample_chunk()])
    results = service.search_similar([0.1, 0.2, 0.3], limit=1)

    assert len(results) == 1
    assert results[0]["doc_id"] == "doc-1"


def test_search_returns_normalized_results(tmp_path):
    service = VectorStoreService(db_path=tmp_path / "vectors")

    service.upsert_chunks([_sample_chunk()])
    result = service.search_similar([0.1, 0.2, 0.3], limit=1)[0]

    assert result["source_label"] == "invoice.pdf"
    assert result["score"] == 1.0
    assert result["embedding_model"] == DEFAULT_EMBEDDING_MODEL
