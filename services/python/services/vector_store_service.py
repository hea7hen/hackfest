from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import lancedb

DEFAULT_EMBEDDING_MODEL = "google/embeddinggemma-300m"
DEFAULT_EMBEDDING_RUNTIME = os.getenv("EMBEDDING_RUNTIME", "mlx")
DEFAULT_TABLE_NAME = "financial_records"
DEFAULT_DB_PATH = Path(os.getenv("LANCEDB_URI", Path(__file__).resolve().parents[1] / "vector_db"))


class VectorStoreService:
    def __init__(
        self,
        db_path: str | Path | None = None,
        table_name: str = DEFAULT_TABLE_NAME,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        embedding_runtime: str = DEFAULT_EMBEDDING_RUNTIME,
    ):
        self.db_path = str(Path(db_path or DEFAULT_DB_PATH))
        self.table_name = table_name
        self.embedding_model = embedding_model
        self.embedding_runtime = embedding_runtime

        Path(self.db_path).mkdir(parents=True, exist_ok=True)
        self.db = lancedb.connect(self.db_path)
        self.manifest_path = Path(self.db_path) / "index_manifest.json"

    def _table(self):
        try:
            return self.db.open_table(self.table_name)
        except Exception:
            return None

    def upsert_chunks(self, chunks: list[dict[str, Any]]) -> None:
        if not chunks:
            return

        table = self._table()
        normalized = [self._normalize_chunk(chunk) for chunk in chunks]

        if table is None:
            self.db.create_table(self.table_name, data=normalized)
            return

        chunk_ids = [chunk["chunk_id"] for chunk in normalized if chunk.get("chunk_id")]
        if chunk_ids:
            quoted = ", ".join(f"'{chunk_id}'" for chunk_id in chunk_ids)
            try:
                table.delete(f"chunk_id IN ({quoted})")
            except Exception:
                pass
        table.add(normalized)

    def search_similar(self, query_vector: list[float], limit: int = 6) -> list[dict[str, Any]]:
        table = self._table()
        if table is None:
            return []

        results = table.search(query_vector).limit(limit).to_list()
        return [self._normalize_result(row) for row in results]

    def mark_indexed(
        self,
        doc_id: str,
        source_type: str,
        embedding_model: str,
        redaction_version: str,
    ) -> None:
        manifest = self._load_manifest()
        manifest[self._manifest_key(doc_id, source_type)] = {
            "embedding_model": embedding_model,
            "redaction_version": redaction_version,
        }
        self._save_manifest(manifest)

    def is_document_indexed(
        self,
        doc_id: str,
        source_type: str,
        embedding_model: str,
        redaction_version: str,
    ) -> bool:
        manifest = self._load_manifest()
        entry = manifest.get(self._manifest_key(doc_id, source_type))
        if not entry:
            return False
        return (
            entry.get("embedding_model") == embedding_model
            and entry.get("redaction_version") == redaction_version
        )

    def _normalize_chunk(self, chunk: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(chunk)
        normalized.setdefault("embedding_model", self.embedding_model)
        normalized.setdefault("page_number", None)
        return normalized

    def _normalize_result(self, row: dict[str, Any]) -> dict[str, Any]:
        distance = float(row.get("_distance", 0.0) or 0.0)
        score = 1.0 / (1.0 + distance)
        return {
            "chunk_id": row.get("chunk_id"),
            "doc_id": row.get("doc_id"),
            "entity_type": row.get("entity_type"),
            "entity_id": row.get("entity_id"),
            "source_type": row.get("source_type"),
            "source_label": row.get("source_label"),
            "original_hash": row.get("original_hash"),
            "redacted_text": row.get("redacted_text"),
            "content_preview": row.get("content_preview"),
            "created_at": row.get("created_at"),
            "embedding_model": row.get("embedding_model", self.embedding_model),
            "redaction_version": row.get("redaction_version"),
            "page_number": row.get("page_number"),
            "score": round(score, 6),
        }

    def _manifest_key(self, doc_id: str, source_type: str) -> str:
        return f"{source_type}:{doc_id}"

    def _load_manifest(self) -> dict[str, Any]:
        if not self.manifest_path.exists():
            return {}
        try:
            return json.loads(self.manifest_path.read_text())
        except Exception:
            return {}

    def _save_manifest(self, manifest: dict[str, Any]) -> None:
        self.manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
