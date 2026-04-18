from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Sequence

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
GENERATED_DIR = BASE_DIR / "generated"
DB_PATH = DATA_DIR / "ledger.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                hashed_password TEXT,
                profession TEXT NOT NULL,
                gst_registered INTEGER NOT NULL,
                preferred_currency TEXT NOT NULL,
                wallet_address TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS uploaded_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                document_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                hash TEXT NOT NULL,
                parsed_status TEXT NOT NULL,
                extracted_summary TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                document_id INTEGER,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                direction TEXT NOT NULL,
                category TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                invoice_number TEXT NOT NULL,
                client_name TEXT NOT NULL,
                client_email TEXT,
                issue_date TEXT NOT NULL,
                due_date TEXT NOT NULL,
                subtotal REAL NOT NULL,
                gst_percent REAL NOT NULL,
                gst_amount REAL NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                pdf_path TEXT NOT NULL,
                hash TEXT NOT NULL,
                proof_id INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS proof_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                document_hash TEXT NOT NULL,
                anchored_at TEXT NOT NULL,
                anchor_type TEXT NOT NULL,
                tx_id TEXT,
                ipfs_cid TEXT,
                signer TEXT,
                verification_status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                insight_type TEXT NOT NULL,
                title TEXT NOT NULL,
                explanation TEXT NOT NULL,
                priority TEXT NOT NULL,
                why_it_matters TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER,
                source_type TEXT NOT NULL,
                source_label TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS extracted_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                document_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                vendor_name TEXT,
                client_name TEXT,
                invoice_number TEXT,
                issue_date TEXT,
                due_date TEXT,
                subtotal REAL,
                gst_amount REAL,
                gst_percent REAL,
                total_amount REAL,
                currency TEXT NOT NULL,
                confidence REAL NOT NULL,
                warnings_json TEXT NOT NULL,
                suggested_tags_json TEXT NOT NULL,
                ledger_mapping_json TEXT NOT NULL,
                raw_fields_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tax_passport_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                title TEXT NOT NULL,
                entry_date TEXT NOT NULL,
                amount REAL NOT NULL,
                tax_type TEXT NOT NULL,
                confidence REAL NOT NULL,
                status TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                summary TEXT NOT NULL,
                document_hash TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                event_date TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                origin TEXT NOT NULL,
                status TEXT NOT NULL,
                tags_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        existing_user = conn.execute("SELECT id FROM users WHERE id = 1").fetchone()
        if not existing_user:
            conn.execute(
                """
                INSERT INTO users (id, name, email, profession, gst_registered, preferred_currency, wallet_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    1,
                    "Hackfest Operator",
                    "operator@2ask.local",
                    "Freelancer / studio operator",
                    1,
                    "INR",
                    "SYSTEM_GENESIS",
                    datetime.utcnow().isoformat(),
                ),
            )

def execute(query: str, params: Sequence[Any] = ()) -> None:
    with get_db() as conn:
        conn.execute(query, params)


def fetch_one(query: str, params: Sequence[Any] = ()) -> sqlite3.Row | None:
    with get_db() as conn:
        return conn.execute(query, params).fetchone()


def fetch_all(query: str, params: Sequence[Any] = ()) -> list[sqlite3.Row]:
    with get_db() as conn:
        return conn.execute(query, params).fetchall()


def insert_and_get_id(query: str, params: Sequence[Any]) -> int:
    with get_db() as conn:
        cur = conn.execute(query, params)
        return int(cur.lastrowid)


def bulk_insert(query: str, rows: Iterable[Sequence[Any]]) -> None:
    with get_db() as conn:
        conn.executemany(query, rows)


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    for key in (
        "metadata_json",
        "warnings_json",
        "suggested_tags_json",
        "ledger_mapping_json",
        "raw_fields_json",
        "tags_json",
    ):
        if key in data and isinstance(data[key], str):
            data[key] = json.loads(data[key])
    return data


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(row) for row in rows if row is not None]
