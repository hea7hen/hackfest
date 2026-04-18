from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from typing import Any

from services.audit_service import create_audit_event
from services.document_service import register_document
from services.storage import (
    execute,
    fetch_all,
    fetch_one,
    insert_and_get_id,
    row_to_dict,
    rows_to_dicts,
)


def _safe_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d.\-]", "", str(value))
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _normalize_date(value: Any) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _field(extraction_json: dict[str, Any], *keys: str) -> Any:
    fields = extraction_json.get("fields") if isinstance(extraction_json.get("fields"), dict) else {}
    for key in keys:
        value = fields.get(key)
        if value not in (None, ""):
            return value
    return None


def _derive_tags(*, document_type: str, gst_amount: float | None, confidence: float, has_proof: bool, total_amount: float | None) -> list[str]:
    tags: list[str] = []
    if document_type == "invoice_pdf":
        tags.append("vendor-bill")
    if document_type == "gst_supporting_doc" or (gst_amount or 0) > 0:
        tags.append("gst")
    if document_type in {"expense_doc", "invoice_pdf", "gst_supporting_doc"}:
        tags.append("deductible")
    if confidence < 0.76:
        tags.append("review-needed")
    if has_proof:
        tags.append("verified")
    if total_amount and total_amount > 75000:
        tags.append("filing-reminder")
    return sorted(set(tags))


def _warning_list(*, invoice_number: str | None, total_amount: float | None, confidence: float, due_date: str | None) -> list[str]:
    warnings: list[str] = []
    if not invoice_number:
        warnings.append("Invoice number could not be confirmed.")
    if total_amount is None:
        warnings.append("Total amount could not be extracted reliably.")
    if confidence < 0.76:
        warnings.append("Low-confidence extraction. Review before relying on this for filing.")
    if not due_date:
        warnings.append("No due date was found, so the calendar may not include a payment reminder.")
    return warnings


def _ledger_mapping(document_type: str, tags: list[str]) -> dict[str, Any]:
    if document_type == "invoice_pdf":
        return {"direction": "debit", "category": "vendor_bill", "requires_review": "review-needed" in tags}
    if "gst" in tags:
        return {"direction": "debit", "category": "tax_supporting_doc", "requires_review": "review-needed" in tags}
    return {"direction": "debit", "category": "expense_doc", "requires_review": "review-needed" in tags}


def _normalize_extracted_invoice_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "document_id": row["document_id"],
        "file_name": row["file_name"],
        "vendor_name": row.get("vendor_name"),
        "client_name": row.get("client_name"),
        "invoice_number": row.get("invoice_number"),
        "issue_date": row.get("issue_date"),
        "due_date": row.get("due_date"),
        "subtotal": row.get("subtotal"),
        "gst_amount": row.get("gst_amount"),
        "gst_percent": row.get("gst_percent"),
        "total_amount": row.get("total_amount"),
        "currency": row.get("currency") or "INR",
        "confidence": row.get("confidence") or 0,
        "warnings": row.get("warnings_json", []),
        "suggested_tags": row.get("suggested_tags_json", []),
        "ledger_mapping": row.get("ledger_mapping_json", {}),
        "raw_fields": row.get("raw_fields_json", {}),
        "created_at": row.get("created_at"),
    }


def _upsert_tax_passport_entry(
    *,
    source_type: str,
    source_id: str,
    title: str,
    entry_date: str,
    amount: float,
    tax_type: str,
    confidence: float,
    status: str,
    tags: list[str],
    summary: str,
    document_hash: str | None,
    user_id: int = 1,
) -> None:
    execute("DELETE FROM tax_passport_entries WHERE source_type = ? AND source_id = ?", (source_type, source_id))
    insert_and_get_id(
        """
        INSERT INTO tax_passport_entries (
            user_id, source_type, source_id, title, entry_date, amount, tax_type,
            confidence, status, tags_json, summary, document_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            source_type,
            source_id,
            title,
            entry_date,
            amount,
            tax_type,
            confidence,
            status,
            json.dumps(tags),
            summary,
            document_hash,
            datetime.utcnow().isoformat(),
        ),
    )


def _upsert_calendar_event(
    *,
    source_type: str,
    source_id: str,
    title: str,
    description: str,
    event_date: str,
    category: str,
    priority: str,
    origin: str,
    status: str,
    tags: list[str],
    user_id: int = 1,
) -> None:
    execute("DELETE FROM calendar_events WHERE source_type = ? AND source_id = ? AND title = ?", (source_type, source_id, title))
    insert_and_get_id(
        """
        INSERT INTO calendar_events (
            user_id, source_type, source_id, title, description, event_date,
            category, priority, origin, status, tags_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            source_type,
            source_id,
            title,
            description,
            event_date,
            category,
            priority,
            origin,
            status,
            json.dumps(tags),
            datetime.utcnow().isoformat(),
        ),
    )


def register_incoming_invoice(user_id: int, file_name: str, content: bytes) -> dict[str, Any]:
    result = register_document(user_id, file_name, content)
    extraction_json = result.get("extraction_json") or {}
    document = result["document"]

    vendor_name = _field(extraction_json, "vendor_name", "supplier_name", "merchant_name")
    client_name = _field(extraction_json, "client_name", "customer_name")
    invoice_number = _field(extraction_json, "invoice_number", "bill_number")
    issue_date = _normalize_date(_field(extraction_json, "issue_date", "invoice_date", "date"))
    due_date = _normalize_date(_field(extraction_json, "due_date"))
    subtotal = _safe_float(_field(extraction_json, "subtotal"))
    gst_amount = _safe_float(_field(extraction_json, "gst_amount", "tax_amount"))
    gst_percent = _safe_float(_field(extraction_json, "gst_percent", "tax_percent"))
    total_amount = _safe_float(_field(extraction_json, "total_amount", "amount"))
    confidence = 0.94 if result.get("extraction_meta", {}).get("used_llm") else 0.74
    tags = _derive_tags(
        document_type=document["document_type"],
        gst_amount=gst_amount,
        confidence=confidence,
        has_proof=bool(result.get("proof_record")),
        total_amount=total_amount,
    )
    warnings = _warning_list(
        invoice_number=invoice_number,
        total_amount=total_amount,
        confidence=confidence,
        due_date=due_date,
    )
    ledger_mapping = _ledger_mapping(document["document_type"], tags)

    extracted_invoice_id = insert_and_get_id(
        """
        INSERT INTO extracted_invoices (
            user_id, document_id, file_name, vendor_name, client_name, invoice_number,
            issue_date, due_date, subtotal, gst_amount, gst_percent, total_amount,
            currency, confidence, warnings_json, suggested_tags_json, ledger_mapping_json,
            raw_fields_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            document["id"],
            file_name,
            vendor_name,
            client_name,
            invoice_number,
            issue_date,
            due_date,
            subtotal,
            gst_amount,
            gst_percent,
            total_amount,
            str(_field(extraction_json, "currency") or "INR"),
            confidence,
            json.dumps(warnings),
            json.dumps(tags),
            json.dumps(ledger_mapping),
            json.dumps(extraction_json.get("fields") if isinstance(extraction_json.get("fields"), dict) else {}),
            datetime.utcnow().isoformat(),
        ),
    )

    extracted_invoice = _normalize_extracted_invoice_row(
        row_to_dict(fetch_one("SELECT * FROM extracted_invoices WHERE id = ?", (extracted_invoice_id,)))
    )

    _upsert_tax_passport_entry(
        source_type="incoming_invoice",
        source_id=str(extracted_invoice_id),
        title=vendor_name or file_name,
        entry_date=issue_date or datetime.utcnow().date().isoformat(),
        amount=float(total_amount or subtotal or 0),
        tax_type="gst" if "gst" in tags else "expense",
        confidence=confidence,
        status="review_needed" if "review-needed" in tags else "captured",
        tags=tags,
        summary=result.get("ai_analysis") or extraction_json.get("summary") or "Incoming invoice extracted for tax passport review.",
        document_hash=document.get("hash"),
        user_id=user_id,
    )

    if due_date:
        _upsert_calendar_event(
            source_type="incoming_invoice",
            source_id=str(extracted_invoice_id),
            title=f"Vendor bill due · {vendor_name or file_name}",
            description="Incoming invoice payment reminder generated from extracted bill due date.",
            event_date=due_date,
            category="bills",
            priority="high" if "review-needed" in tags else "medium",
            origin="invoice_ingestion",
            status="open",
            tags=tags,
            user_id=user_id,
        )

    create_audit_event(
        user_id,
        "incoming_invoice",
        str(extracted_invoice_id),
        "incoming_invoice_recorded",
        {
            "document_id": document["id"],
            "invoice_number": invoice_number,
            "confidence": confidence,
            "tags": tags,
        },
    )

    return {**result, "extracted_invoice": extracted_invoice}


def list_extracted_invoices(limit: int = 50) -> list[dict[str, Any]]:
    rows = fetch_all("SELECT * FROM extracted_invoices ORDER BY created_at DESC LIMIT ?", (limit,))
    return [_normalize_extracted_invoice_row(row) for row in rows_to_dicts(rows)]


def sync_outgoing_invoice_artifacts(invoice: dict[str, Any], user_id: int = 1) -> None:
    tags = ["client-invoice", "verified"]
    if (invoice.get("gst_amount") or 0) > 0:
        tags.append("gst")
    if invoice.get("status") != "paid":
        tags.append("filing-reminder")

    _upsert_tax_passport_entry(
        source_type="outgoing_invoice",
        source_id=str(invoice["id"]),
        title=invoice["invoice_number"],
        entry_date=invoice["issue_date"],
        amount=float(invoice.get("gst_amount") or 0),
        tax_type="gst_output",
        confidence=0.98,
        status=invoice.get("status", "draft"),
        tags=sorted(set(tags)),
        summary=f"Outgoing invoice for {invoice['client_name']} worth Rs {invoice['total_amount']:.2f}.",
        document_hash=invoice.get("hash"),
        user_id=user_id,
    )

    _upsert_calendar_event(
        source_type="outgoing_invoice",
        source_id=str(invoice["id"]),
        title=f"Invoice due · {invoice['client_name']}",
        description=f"Collect payment for {invoice['invoice_number']} before the due date.",
        event_date=invoice["due_date"],
        category="invoices",
        priority="high" if invoice.get("status") != "paid" else "low",
        origin="invoice_workspace",
        status=invoice.get("status", "draft"),
        tags=sorted(set(tags)),
        user_id=user_id,
    )


def sync_transaction_tax_entries(transactions: list[dict[str, Any]], user_id: int = 1) -> None:
    for txn in transactions:
        tags: list[str] = []
        tax_type = "expense"
        if txn["direction"] == "credit":
            tags.append("client-invoice")
            tax_type = "income"
        if txn["category"] == "tax":
            tags.append("gst")
            tax_type = "gst"
        if txn["category"] in {"software", "equipment", "general_expense", "travel", "rent"}:
            tags.append("deductible")
        if txn["confidence"] < 0.75:
            tags.append("review-needed")

        if not tags and tax_type == "expense":
            continue

        _upsert_tax_passport_entry(
            source_type="transaction",
            source_id=str(txn["id"]),
            title=txn["description"],
            entry_date=txn["date"],
            amount=float(txn["amount"]),
            tax_type=tax_type,
            confidence=float(txn["confidence"]),
            status="review_needed" if "review-needed" in tags else "captured",
            tags=sorted(set(tags)),
            summary=f"Transaction classified as {txn['category']} with direction {txn['direction']}.",
            document_hash=None,
            user_id=user_id,
        )


def build_tax_passport_summary(user_id: int = 1) -> dict[str, Any]:
    entries = rows_to_dicts(
        fetch_all(
            "SELECT * FROM tax_passport_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC",
            (user_id,),
        )
    )
    metrics = {
        "total_income": round(sum(entry["amount"] for entry in entries if entry["tax_type"] == "income"), 2),
        "deductible_amount": round(sum(entry["amount"] for entry in entries if "deductible" in entry.get("tags_json", [])), 2),
        "gst_exposure": round(sum(entry["amount"] for entry in entries if "gst" in entry.get("tags_json", [])), 2),
        "tds_credit": round(sum(entry["amount"] for entry in entries if "tds" in entry.get("tags_json", [])), 2),
        "review_needed": sum(1 for entry in entries if "review-needed" in entry.get("tags_json", [])),
    }
    normalized = [
        {
            "id": entry["id"],
            "source_type": entry["source_type"],
            "source_id": entry["source_id"],
            "title": entry["title"],
            "entry_date": entry["entry_date"],
            "amount": entry["amount"],
            "tax_type": entry["tax_type"],
            "confidence": entry["confidence"],
            "status": entry["status"],
            "tags": entry.get("tags_json", []),
            "summary": entry["summary"],
            "document_hash": entry.get("document_hash"),
        }
        for entry in entries
    ]
    return {"metrics": metrics, "entries": normalized}


def _deterministic_tax_events() -> list[dict[str, Any]]:
    today = datetime.utcnow().date()
    current_year = today.year
    events: list[dict[str, Any]] = []

    def add_event(source_id: str, title: str, event_date: date, category: str, description: str):
        events.append(
            {
                "id": source_id,
                "title": title,
                "description": description,
                "event_date": event_date.isoformat(),
                "category": category,
                "priority": "high",
                "source_type": "tax_rule",
                "source_id": source_id,
                "origin": "deterministic_tax_rule",
                "status": "scheduled",
                "tags": [category],
            }
        )

    for month, label in ((6, "Q1"), (9, "Q2"), (12, "Q3"), (3, "Q4")):
        year = current_year + 1 if month <= 3 else current_year
        add_event(
            f"advance-tax-{label}-{year}",
            f"Advance tax {label}",
            date(year, month, 15),
            "income_tax",
            f"Advance tax installment for {label}.",
        )

    add_event(
        f"income-tax-return-{current_year + 1}",
        "Income tax return filing",
        date(current_year + 1, 7, 31),
        "income_tax",
        "Annual income tax filing deadline.",
    )
    add_event(
        f"audit-deadline-{current_year + 1}",
        "Tax audit deadline",
        date(current_year + 1, 9, 30),
        "audit",
        "Tax audit completion deadline.",
    )
    return [event for event in events if event["event_date"] >= today.isoformat()]


def list_calendar_events(user_id: int = 1) -> list[dict[str, Any]]:
    stored = rows_to_dicts(
        fetch_all(
            "SELECT * FROM calendar_events WHERE user_id = ? ORDER BY event_date ASC, created_at ASC",
            (user_id,),
        )
    )
    normalized = [
        {
            "id": f"stored-{row['id']}",
            "title": row["title"],
            "description": row["description"],
            "event_date": row["event_date"],
            "category": row["category"],
            "priority": row["priority"],
            "source_type": row["source_type"],
            "source_id": row["source_id"],
            "origin": row["origin"],
            "status": row["status"],
            "tags": row.get("tags_json", []),
        }
        for row in stored
    ]

    combined = normalized + _deterministic_tax_events()
    combined.sort(key=lambda item: item["event_date"])
    return combined
