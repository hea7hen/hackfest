from datetime import date, datetime

from services.finance_service import ask_cfo
from services.storage import execute, initialize_database


def _seed_invoice():
    execute(
        """
        INSERT INTO invoices (
            user_id, invoice_number, client_name, client_email, issue_date, due_date,
            subtotal, gst_percent, gst_amount, total_amount, status, notes, pdf_path, hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            "INV-001",
            "Acme Client",
            "client@example.com",
            date.today().isoformat(),
            date.today().isoformat(),
            1000.0,
            18.0,
            180.0,
            1180.0,
            "draft",
            "Test invoice",
            "/tmp/invoice.pdf",
            "hash-1",
            datetime.utcnow().isoformat(),
        ),
    )


def test_finance_copilot_response_keeps_required_fields():
    initialize_database()

    result = ask_cfo("Give me an overview")

    assert "answer" in result
    assert "why" in result
    assert "supporting_items" in result
    assert "sources" in result
    assert "confidence" in result
    assert "redacted_items" in result
    assert "reasoning_steps" in result


def test_gst_question_uses_deterministic_finance_values():
    initialize_database()
    _seed_invoice()

    result = ask_cfo("What is my GST due?")

    assert "180" in result["answer"]
    assert result["confidence"] >= 0


def test_follow_up_question_routes_to_collections_mode():
    initialize_database()
    _seed_invoice()

    result = ask_cfo("Which invoices need follow-up this week?")

    assert "Clients needing follow-up" in result["answer"]
