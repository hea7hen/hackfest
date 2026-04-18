from __future__ import annotations

from datetime import datetime
from pathlib import Path

import fitz

from models.schemas import InvoiceCreateRequest
from services.audit_service import create_audit_event
from services.proof_service import create_proof_record, hash_file
from services.rag_service import index_document_text
from services.storage import GENERATED_DIR, fetch_one, insert_and_get_id, row_to_dict, execute


def _invoice_number() -> str:
    return f"2ASK-{datetime.utcnow().strftime('%Y')}-{datetime.utcnow().strftime('%H%M%S')}"


def _generate_pdf(invoice_number: str, payload: InvoiceCreateRequest) -> str:
    pdf_path = GENERATED_DIR / f"{invoice_number}.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    lines = [
        "2ASK Ledger",
        "AI CFO Trust Invoice",
        "",
        f"Invoice Number: {invoice_number}",
        f"Client: {payload.client_name}",
        f"Client Email: {payload.client_email or 'Not provided'}",
        f"Issue Date: {payload.issue_date.isoformat()}",
        f"Due Date: {payload.due_date.isoformat()}",
        "",
        f"Subtotal: Rs {payload.subtotal:,.2f}",
        f"GST ({payload.gst_percent:.1f}%): Rs {(payload.subtotal * payload.gst_percent / 100):,.2f}",
        f"Total: Rs {(payload.subtotal * (1 + payload.gst_percent / 100)):,.2f}",
        "",
        "Trust metadata:",
        "- Final PDF will be hashed with SHA-256",
        "- Proof record will be anchored to the mock decentralized ledger adapter",
        "- Audit trail events are created for generate, send, reminder, payment, and verification",
        "",
        f"Notes: {payload.notes or 'Professional services rendered'}",
    ]
    y = 72
    for line in lines:
        page.insert_text((72, y), line, fontsize=12 if line else 8, fontname="helv")
        y += 24 if line else 12

    doc.save(pdf_path)
    doc.close()
    return str(pdf_path.resolve())


def create_invoice(payload: InvoiceCreateRequest, user_id: int = 1) -> dict:
    invoice_number = _invoice_number()
    pdf_path = _generate_pdf(invoice_number, payload)
    gst_amount = round(payload.subtotal * payload.gst_percent / 100, 2)
    total_amount = round(payload.subtotal + gst_amount, 2)
    doc_hash = hash_file(pdf_path)
    user = row_to_dict(fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))) or {}

    invoice_id = insert_and_get_id(
        """
        INSERT INTO invoices (
            user_id, invoice_number, client_name, client_email, issue_date, due_date,
            subtotal, gst_percent, gst_amount, total_amount, status, notes, pdf_path, hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            invoice_number,
            payload.client_name,
            payload.client_email,
            payload.issue_date.isoformat(),
            payload.due_date.isoformat(),
            payload.subtotal,
            payload.gst_percent,
            gst_amount,
            total_amount,
            "draft",
            payload.notes,
            pdf_path,
            doc_hash,
            datetime.utcnow().isoformat(),
        ),
    )

    proof = create_proof_record("invoice", str(invoice_id), doc_hash, signer=user.get("wallet_address"))
    execute("UPDATE invoices SET proof_id = ? WHERE id = ?", (proof["id"], invoice_id))
    index_document_text(
        invoice_id,
        invoice_number,
        (
            f"Invoice {invoice_number} for {payload.client_name}. "
            f"Issue date {payload.issue_date.isoformat()}. Due date {payload.due_date.isoformat()}. "
            f"Subtotal Rs {payload.subtotal:.2f}. GST percent {payload.gst_percent:.2f}. "
            f"GST amount Rs {gst_amount:.2f}. Total amount Rs {total_amount:.2f}. "
            f"Notes {payload.notes or 'None'}."
        ),
        source_type="invoice_document",
        original_hash=doc_hash,
        entity_type="invoice",
        entity_id=str(invoice_id),
    )

    create_audit_event(
        user_id,
        "invoice",
        str(invoice_id),
        "invoice_generated",
        {"invoice_number": invoice_number, "total_amount": total_amount},
    )
    invoice = row_to_dict(fetch_one("SELECT * FROM invoices WHERE id = ?", (invoice_id,)))
    from services.workspace_service import sync_outgoing_invoice_artifacts

    sync_outgoing_invoice_artifacts(invoice, user_id=user_id)
    return invoice


def update_invoice_status(invoice_id: int, status: str, user_id: int = 1) -> dict:
    execute("UPDATE invoices SET status = ? WHERE id = ?", (status, invoice_id))
    action_map = {
        "sent": "invoice_sent",
        "reminder_sent": "payment_reminder_sent",
        "paid": "payment_marked_paid",
        "draft": "invoice_updated",
    }
    create_audit_event(user_id, "invoice", str(invoice_id), action_map.get(status, "invoice_updated"), {"status": status})
    invoice = row_to_dict(fetch_one("SELECT * FROM invoices WHERE id = ?", (invoice_id,)))
    from services.workspace_service import sync_outgoing_invoice_artifacts

    sync_outgoing_invoice_artifacts(invoice, user_id=user_id)
    return invoice
