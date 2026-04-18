import numpy as np

from services import rag_service


def test_index_document_text_redacts_before_upsert(mocker):
    upsert = mocker.patch.object(rag_service.vector_store, "upsert_chunks")
    mark_indexed = mocker.patch.object(rag_service.vector_store, "mark_indexed")
    mocker.patch.object(rag_service, "_embed_texts", return_value=np.array([[0.1, 0.2, 0.3]], dtype=np.float32))

    rag_service.index_document_text(
        1,
        "invoice.pdf",
        "Client GSTIN is 22AAAAA0000A1Z5",
        source_type="uploaded_document",
        original_hash="hash-1",
    )

    payload = upsert.call_args[0][0]
    assert "[REDACTED]" in payload[0]["redacted_text"]
    mark_indexed.assert_called_once()


def test_retrieve_context_returns_normalized_evidence(mocker):
    mocker.patch.object(
        rag_service.vector_store,
        "search_similar",
        return_value=[
            {
                "source_type": "uploaded_document",
                "source_label": "invoice.pdf",
                "redacted_text": "Invoice total [REDACTED]",
                "content_preview": "Invoice total [REDACTED]",
                "score": 0.87,
            }
        ],
    )
    mocker.patch.object(rag_service, "_embed_texts", return_value=np.array([[0.1, 0.2, 0.3]], dtype=np.float32))

    results = rag_service.retrieve_document_context("What is in the invoice?", top_k=1)

    assert len(results) == 1
    assert results[0].source_label == "invoice.pdf"
    assert results[0].score == 0.87


def test_backfill_skips_already_indexed_rows(mocker):
    mocker.patch.object(
        rag_service,
        "rows_to_dicts",
        side_effect=[
            [{"id": 1, "file_name": "invoice.pdf", "hash": "hash-1"}],
            [],
        ],
    )
    mocker.patch.object(rag_service, "fetch_all", return_value=[])
    mocker.patch.object(rag_service.vector_store, "is_document_indexed", return_value=True)
    index_document_text = mocker.patch.object(rag_service, "index_document_text")

    rag_service.backfill_existing_records()

    index_document_text.assert_not_called()
