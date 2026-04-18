from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from services.storage import fetch_all, insert_and_get_id, rows_to_dicts


def create_audit_event(
    user_id: int,
    entity_type: str,
    entity_id: str,
    action: str,
    metadata: dict[str, Any] | None = None,
) -> int:
    return insert_and_get_id(
        """
        INSERT INTO audit_events (user_id, entity_type, entity_id, action, metadata_json, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            entity_type,
            entity_id,
            action,
            json.dumps(metadata or {}),
            datetime.utcnow().isoformat(),
        ),
    )


def list_audit_events(limit: int = 50, action: str | None = None) -> list[dict[str, Any]]:
    if action:
        rows = fetch_all(
            """
            SELECT * FROM audit_events
            WHERE action = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (action, limit),
        )
    else:
        rows = fetch_all(
            "SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        )
    return rows_to_dicts(rows)
