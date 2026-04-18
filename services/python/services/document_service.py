from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import fitz

from services.rag_service import index_document_text
from services.audit_service import create_audit_event
from services.gemma_service import GemmaService
from services.proof_service import create_proof_record, hash_bytes
from services.storage import UPLOAD_DIR, fetch_one, insert_and_get_id, row_to_dict

gemma_service = GemmaService()


def classify_document(file_name: str, content: bytes) -> str:
    lowered = file_name.lower()
    text_sample = ""
    if lowered.endswith(".pdf"):
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:
                preview_pages = []
                for index, page in enumerate(doc):
                    if index >= 2:
                        break
                    preview_pages.append(page.get_text())
                text_sample = " ".join(preview_pages).lower()
        except Exception:
            text_sample = ""
    if "invoice" in lowered or "invoice" in text_sample:
        return "invoice_pdf"
    if lowered.endswith(".csv"):
        return "bank_statement_csv"
    if "statement" in lowered or "account" in text_sample or "withdrawal" in text_sample:
        return "bank_statement_pdf"
    if "gst" in lowered or "gst" in text_sample:
        return "gst_supporting_doc"
    return "expense_doc"


def save_upload(file_name: str, content: bytes) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", file_name)
    path = UPLOAD_DIR / f"{timestamp}_{safe_name}"
    path.write_bytes(content)
    return str(path.resolve())


def parse_transactions_from_csv(content: bytes) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    transactions = []
    for row in reader:
        description = (
            row.get("description")
            or row.get("narration")
            or row.get("particulars")
            or row.get("details")
            or "Bank transaction"
        )
        amount_raw = row.get("amount") or row.get("debit") or row.get("credit") or "0"
        amount = _safe_amount(amount_raw)
        direction = _infer_direction(row, amount)
        txn_date = row.get("date") or row.get("txn_date") or row.get("transaction_date") or datetime.utcnow().date().isoformat()
        transactions.append(
            {
                "date": _normalize_date(txn_date),
                "description": description.strip(),
                "amount": abs(amount),
                "direction": direction,
            }
        )
    return transactions


def parse_transactions_from_pdf(content: bytes) -> list[dict[str, Any]]:
    lines: list[str] = []
    with fitz.open(stream=content, filetype="pdf") as doc:
        for page in doc:
            lines.extend(page.get_text().splitlines())
    transactions = []
    date_pattern = re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")
    amount_pattern = re.compile(r"(-?\d[\d,]*\.?\d{0,2})")
    for line in lines:
        if not date_pattern.search(line):
            continue
        amounts = amount_pattern.findall(line.replace("₹", ""))
        if not amounts:
            continue
        raw_amount = amounts[-1]
        amount = abs(_safe_amount(raw_amount))
        if amount == 0:
            continue
        date_match = date_pattern.search(line)
        description = line[date_match.end():].strip(" -") if date_match else line.strip()
        direction = "credit" if any(token in line.lower() for token in ["cr", "credit", "deposit", "received"]) else "debit"
        transactions.append(
            {
                "date": _normalize_date(date_match.group(1) if date_match else datetime.utcnow().date().isoformat()),
                "description": description or "Statement line item",
                "amount": amount,
                "direction": direction,
            }
        )
    return transactions[:100]


def _normalize_date(value: str) -> str:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return datetime.utcnow().date().isoformat()


def _safe_amount(value: str) -> float:
    cleaned = re.sub(r"[^\d.\-]", "", str(value))
    try:
        return float(cleaned or 0)
    except ValueError:
        return 0.0


def _infer_direction(row: dict[str, Any], amount: float) -> str:
    if row.get("credit"):
        return "credit"
    if row.get("debit"):
        return "debit"
    value = " ".join(str(v).lower() for v in row.values())
    if re.search(r"\b(credit|received|deposit|cr)\b", value):
        return "credit"
    if re.search(r"\b(debit|dr|expense|paid|purchase|subscription)\b", value):
        return "debit"
    return "debit" if amount >= 0 else "credit"


def summarize_document(document_type: str, transactions_count: int) -> str:
    if document_type.startswith("bank_statement"):
        return f"Parsed {transactions_count} bank transactions and prepared them for categorization."
    if document_type == "invoice_pdf":
        return "Indexed uploaded invoice PDF and created a tamper-evident document hash."
    return "Stored supporting financial document with proof-ready hashing."


def extract_text_for_indexing(file_name: str, content: bytes, document_type: str, parsed_transactions: list[dict[str, Any]]) -> str:
    if document_type == "bank_statement_csv":
        lines = [
            f"{txn['date']} | {txn['description']} | {txn['direction']} | Rs {txn['amount']:.2f}"
            for txn in parsed_transactions[:200]
        ]
        return "\n".join(lines)

    if file_name.lower().endswith(".pdf"):
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:
                pages = [page.get_text() for page in doc]
            return "\n".join(page for page in pages if page.strip())
        except Exception:
            return ""
    return ""


def register_document(user_id: int, file_name: str, content: bytes) -> dict[str, Any]:
    document_type = classify_document(file_name, content)
    path = save_upload(file_name, content)
    doc_hash = hash_bytes(content)

    parsed_transactions = []
    if document_type == "bank_statement_csv":
        parsed_transactions = parse_transactions_from_csv(content)
    elif document_type == "bank_statement_pdf":
        parsed_transactions = parse_transactions_from_pdf(content)

    doc_id = insert_and_get_id(
        """
        INSERT INTO uploaded_documents (user_id, file_name, file_type, document_type, file_path, hash, parsed_status, extracted_summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            file_name,
            Path(file_name).suffix.lower().replace(".", "") or "bin",
            document_type,
            path,
            doc_hash,
            "parsed" if document_type.startswith("bank_statement") else "stored",
            summarize_document(document_type, len(parsed_transactions)),
            datetime.utcnow().isoformat(),
        ),
    )

    proof = None
    if document_type in {"invoice_pdf", "bank_statement_pdf"}:
        user = row_to_dict(fetch_one("SELECT * FROM users WHERE id = ?", (user_id,)))
        proof = create_proof_record("document", str(doc_id), doc_hash, signer=user.get("wallet_address"))

    create_audit_event(
        user_id,
        "document",
        str(doc_id),
        "document_uploaded",
        {"file_name": file_name, "document_type": document_type},
    )
    if parsed_transactions:
        create_audit_event(
            user_id,
            "document",
            str(doc_id),
            "document_parsed",
            {"transactions_count": len(parsed_transactions)},
        )

    extracted_text = extract_text_for_indexing(file_name, content, document_type, parsed_transactions)
    extraction_json = {}
    extraction_meta = {
        "runtime": gemma_service.runtime,
        "model": gemma_service.model,
        "used_llm": False,
        "fallback_mode": "none",
        "document_type": document_type,
        "text_characters": len(extracted_text or ""),
    }

    if extracted_text.strip():
        extraction_json, extraction_meta = gemma_service.extract_document_json(
            file_name=file_name,
            document_type=document_type,
            text=extracted_text,
            document_hash=doc_hash,
        )
        if extracted_text.strip():
            index_document_text(
                doc_id,
                file_name,
                extracted_text,
                source_type="uploaded_document",
                original_hash=doc_hash,
                entity_type="document",
                entity_id=str(doc_id),
            )

    document = row_to_dict(fetch_one("SELECT * FROM uploaded_documents WHERE id = ?", (doc_id,)))
    pipeline_steps = [
        {"id": "upload", "label": "Upload", "status": "completed", "detail": f"Stored {file_name} locally."},
        {
            "id": "parse",
            "label": "Parse",
            "status": "completed",
            "detail": f"Detected {document_type} and parsed {len(parsed_transactions)} transactions." if parsed_transactions else f"Detected {document_type} and extracted source text.",
        },
        {
            "id": "redact",
            "label": "Redact",
            "status": "completed" if extracted_text.strip() else "skipped",
            "detail": "Prepared text for safe indexing and model context.",
        },
        {
            "id": "llm_extract",
            "label": "LLM extract",
            "status": "completed" if extraction_meta.get("used_llm") else "fallback",
            "detail": "Structured JSON extracted from the local model." if extraction_meta.get("used_llm") else f"Structured JSON built via {extraction_meta.get('fallback_mode', 'heuristic parser')}.",
        },
        {
            "id": "embed",
            "label": "Embed",
            "status": "completed" if extracted_text.strip() else "skipped",
            "detail": "Generated retrieval chunks for local semantic search." if extracted_text.strip() else "No text was available for embedding.",
        },
        {
            "id": "vector_db",
            "label": "Vector DB",
            "status": "completed" if extracted_text.strip() else "skipped",
            "detail": "Indexed into the local vector store for Finance Copilot grounding." if extracted_text.strip() else "Vector indexing skipped.",
        },
    ]
    return {
        "document": document,
        "parsed_transactions": parsed_transactions,
        "proof_record": proof,
        "extraction_json": extraction_json,
        "extraction_meta": extraction_meta,
        "pipeline_steps": pipeline_steps,
    }
