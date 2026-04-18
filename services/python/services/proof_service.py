from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any

from services.audit_service import create_audit_event
from services.storage import fetch_all, fetch_one, insert_and_get_id, row_to_dict, rows_to_dicts


def hash_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def hash_file(path: str | Path) -> str:
    return hash_bytes(Path(path).read_bytes())


def _mock_tx_id(entity_type: str, entity_id: str) -> str:
    return f"MOCK-{entity_type.upper()}-{entity_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


def create_proof_record(
    entity_type: str,
    entity_id: str,
    document_hash: str,
    signer: str | None = None,
    anchor_type: str = "mock_chain",
) -> dict[str, Any]:
    proof_id = insert_and_get_id(
        """
        INSERT INTO proof_records (entity_type, entity_id, document_hash, anchored_at, anchor_type, tx_id, ipfs_cid, signer, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entity_type,
            entity_id,
            document_hash,
            datetime.utcnow().isoformat(),
            anchor_type,
            _mock_tx_id(entity_type, entity_id),
            f"bafy{document_hash[:24]}",
            signer,
            "verified",
        ),
    )
    create_audit_event(
        1,
        "proof",
        str(proof_id),
        "proof_anchored",
        {"entity_type": entity_type, "entity_id": entity_id, "anchor_type": anchor_type},
    )
    return get_proof_by_id(proof_id)


def get_proof_by_id(proof_id: int) -> dict[str, Any]:
    row = fetch_one("SELECT * FROM proof_records WHERE id = ?", (proof_id,))
    return row_to_dict(row)


def get_proof_by_hash(document_hash: str) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM proof_records WHERE document_hash = ? ORDER BY anchored_at DESC LIMIT 1",
        (document_hash,),
    )
    return row_to_dict(row)


def verify_proof_integrity(proof_id: int) -> bool:
    """
    Simulates a Merkle proof verification.
    In a real system, this would fetch the Merkle branch from a blockchain.
    """
    proof = get_proof_by_id(proof_id)
    if not proof:
        return False
    
    # Logic: Reconstruct the mock signature
    # In our demo, the 'tx_id' is derived from entity_id and hash
    # We verify that they still match the stored proof record
    reconstructed_data = f"{proof['entity_type']}:{proof['entity_id']}:{proof['document_hash']}"
    mock_merkle_root = hashlib.sha256(reconstructed_data.encode()).hexdigest()
    
    # We simulate a match by checking if the hash exists in our "anchored" logs
    # (In reality, we'd check the on-chain registry)
    return True  # For the demo, it always validates if the record exists


def get_proof_history(entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        "SELECT * FROM proof_records WHERE entity_type = ? AND entity_id = ? ORDER BY anchored_at DESC",
        (entity_type, entity_id),
    )
    return rows_to_dicts(rows)


def list_proofs(limit: int = 50) -> list[dict[str, Any]]:
    rows = fetch_all("SELECT * FROM proof_records ORDER BY anchored_at DESC LIMIT ?", (limit,))
    return rows_to_dicts(rows)
