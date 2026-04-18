from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any

from services.gemma_service import GemmaService
from services.rag_service import retrieve_context, retrieve_document_context
from services.audit_service import create_audit_event
from services.storage import fetch_all, fetch_one, insert_and_get_id, row_to_dict, rows_to_dicts


CATEGORY_RULES = {
    "rent": ["rent", "cowork", "office"],
    "software": ["figma", "adobe", "aws", "hosting", "software", "subscription", "notion"],
    "food": ["food", "zomato", "swiggy", "cafe"],
    "travel": ["travel", "uber", "ola", "flight", "train"],
    "tax": ["gst", "tax", "tds"],
    "transfer": ["transfer", "upi", "neft", "imps"],
    "equipment": ["laptop", "repair", "monitor", "device"],
    "income": ["client payment", "invoice", "received", "deposit"],
}

gemma_service = GemmaService()


def categorize_transaction(description: str, direction: str) -> tuple[str, float]:
    text = description.lower()
    if direction == "credit":
        return "income", 0.98
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in text for keyword in keywords):
            return category, 0.88
    return ("transfers" if direction == "credit" else "general_expense", 0.62)


def store_transactions(user_id: int, document_id: int | None, raw_transactions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    created = []
    for txn in raw_transactions:
        category, confidence = categorize_transaction(txn["description"], txn["direction"])
        txn_id = insert_and_get_id(
            """
            INSERT INTO transactions (user_id, document_id, date, description, amount, direction, category, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                document_id,
                txn["date"],
                txn["description"],
                txn["amount"],
                txn["direction"],
                category,
                confidence,
                datetime.utcnow().isoformat(),
            ),
        )
        created.append(row_to_dict(fetch_one("SELECT * FROM transactions WHERE id = ?", (txn_id,))))

    if created:
        create_audit_event(
            user_id,
            "transaction_batch",
            str(document_id or "manual"),
            "transactions_categorized",
            {"count": len(created)},
        )
        from services.workspace_service import sync_transaction_tax_entries

        sync_transaction_tax_entries(created, user_id=user_id)
    return created


def list_transactions() -> list[dict[str, Any]]:
    rows = fetch_all("SELECT * FROM transactions ORDER BY date DESC, id DESC")
    return rows_to_dicts(rows)


def compute_totals() -> dict[str, float]:
    rows = list_transactions()
    income = sum(row["amount"] for row in rows if row["direction"] == "credit")
    expense = sum(row["amount"] for row in rows if row["direction"] == "debit")
    return {
        "income": round(income, 2),
        "expense": round(expense, 2),
        "savings_delta": round(income - expense, 2),
    }


def recurring_expenses(limit: int = 5) -> list[dict[str, Any]]:
    expense_rows = [row for row in list_transactions() if row["direction"] == "debit"]
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in expense_rows:
        grouped[row["category"]].append(row["amount"])
    recurring = [
        {"category": category, "average_amount": round(mean(values), 2), "occurrences": len(values)}
        for category, values in grouped.items()
        if len(values) >= 2
    ]
    recurring.sort(key=lambda item: item["average_amount"], reverse=True)
    return recurring[:limit]


def unusual_transactions(limit: int = 5) -> list[dict[str, Any]]:
    rows = list_transactions()
    debit_amounts = [row["amount"] for row in rows if row["direction"] == "debit"]
    baseline = mean(debit_amounts) if debit_amounts else 0
    unusual = [
        row for row in rows
        if row["direction"] == "debit" and row["amount"] > max(baseline * 1.8, 10000)
    ]
    return unusual[:limit]


def list_invoices() -> list[dict[str, Any]]:
    return rows_to_dicts(fetch_all("SELECT * FROM invoices ORDER BY created_at DESC"))


def compute_gst_summary() -> dict[str, float]:
    invoices = list_invoices()
    taxable = sum(invoice["subtotal"] for invoice in invoices)
    gst_due = sum(invoice["gst_amount"] for invoice in invoices if invoice["status"] != "paid")
    return {"taxable_value": round(taxable, 2), "estimated_gst_liability": round(gst_due, 2)}


def compute_health_score() -> dict[str, Any]:
    totals = compute_totals()
    invoices = list_invoices()
    income_rows = [row for row in list_transactions() if row["direction"] == "credit"]
    overdue = [
        invoice for invoice in invoices
        if invoice["status"] != "paid" and date.fromisoformat(invoice["due_date"]) < date.today()
    ]

    income_regularity = 85 if len(income_rows) >= 3 else 55
    expense_ratio = 100 if totals["income"] == 0 else max(15, int(100 - min((totals["expense"] / max(totals["income"], 1)) * 100, 85)))
    overdue_score = max(30, 100 - len(overdue) * 25)
    cash_buffer = 90 if totals["savings_delta"] > 20000 else 65 if totals["savings_delta"] > 0 else 35
    gst = compute_gst_summary()
    compliance_readiness = 88 if gst["estimated_gst_liability"] < max(totals["income"] * 0.2, 1) else 62

    factors = [
        {"name": "Income regularity", "score": income_regularity, "weight": 25, "explanation": "Repeated client inflows improve stability."},
        {"name": "Expense ratio", "score": expense_ratio, "weight": 20, "explanation": "Lower expense load preserves freelancer margin."},
        {"name": "Overdue payments", "score": overdue_score, "weight": 20, "explanation": "Outstanding invoices reduce collection confidence."},
        {"name": "Cash buffer", "score": cash_buffer, "weight": 20, "explanation": "Positive savings delta strengthens 30-day resilience."},
        {"name": "Compliance readiness", "score": compliance_readiness, "weight": 15, "explanation": "GST visibility and proof records support trust."},
    ]
    weighted = sum(item["score"] * item["weight"] for item in factors) / 100
    score = int(round(weighted))
    status = "strong" if score >= 75 else "watch" if score >= 55 else "at_risk"
    return {"score": score, "status": status, "factors": factors}


def forecast_30_days() -> dict[str, Any]:
    rows = list_transactions()
    totals = compute_totals()
    current_balance = totals["savings_delta"]
    daily_net = totals["savings_delta"] / 30 if rows else 0
    outstanding = sum(
        invoice["total_amount"]
        for invoice in list_invoices()
        if invoice["status"] != "paid"
    )
    projected = current_balance + daily_net * 30 + outstanding * 0.45
    series = []
    for offset in range(0, 31, 5):
        day_value = current_balance + daily_net * offset + outstanding * min(offset / 30, 1) * 0.45
        series.append({"day": f"Day {offset}", "projected_balance": round(day_value, 2)})
    warning = None
    if projected < 0:
        warning = "Cash flow warning: projected balance may go negative within 30 days."
    elif projected < 25000:
        warning = "Cash buffer may tighten within 30 days unless overdue invoices clear."
    return {
        "current_balance_estimate": round(current_balance, 2),
        "projected_30_day_balance": round(projected, 2),
        "warning": warning,
        "series": series,
    }


def generate_insights() -> list[dict[str, Any]]:
    from services.rag_service import generate_actionable_insights
    
    totals = compute_totals()
    overdue = [
        invoice for invoice in list_invoices()
        if invoice["status"] != "paid" and date.fromisoformat(invoice["due_date"]) < date.today()
    ]
    recurring = recurring_expenses()
    gst = compute_gst_summary()
    insights = []

    # 1. AI Actions from RAG Service
    ai_insights = generate_actionable_insights(1)
    for ai in ai_insights:
        insights.append(_insight(ai["insight_type"], ai["title"], ai["explanation"], ai["priority"], ai["why_it_matters"]))

    # 2. Logic-based insights
    if totals["income"] and totals["expense"] / max(totals["income"], 1) > 0.8:
        insights.append(
            _insight("margin", "Expenses are consuming most of your income", "Your expense ratio is above 80%, which weakens cash generation.", "high", "Low margin compresses runway and tax readiness.")
        )
    
    if overdue:
        insights.append(
            _insight("collections", f"{len(overdue)} invoice(s) need collection follow-up", "Late invoices are now the main drag on working capital.", "high", "Payment discipline is a visible trust and liquidity signal.")
        )

    if recurring:
        top = recurring[0]
        insights.append(
            _insight("cost", f"{top['category'].title()} is your biggest recurring expense bucket", f"Average recurring {top['category']} spend is about Rs {top['average_amount']:.0f}.", "medium", "Recurring costs are the fastest place to optimize runway.")
        )

    return insights[:4]


def refresh_insights() -> list[dict[str, Any]]:
    insights = generate_insights()
    existing = fetch_all("SELECT id FROM insights")
    if not existing:
        for insight in insights:
            insert_and_get_id(
                """
                INSERT INTO insights (user_id, insight_type, title, explanation, priority, why_it_matters, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    1,
                    insight["insight_type"],
                    insight["title"],
                    insight["explanation"],
                    insight["priority"],
                    insight["why_it_matters"],
                    datetime.utcnow().isoformat(),
                ),
            )
    return insights


def _source_payloads(retrieved: list[Any]) -> list[dict[str, Any]]:
    return [
        {
            "source_type": item.source_type,
            "source_label": item.source_label,
            "excerpt": item.excerpt[:240],
            "score": round(item.score, 4),
            "confidence": int(round(item.score * 100)),
            "evidence_snippet": item.excerpt[:160],
            "page_number": None,
        }
        for item in retrieved
    ]


def _build_base_response(
    question: str,
    totals: dict[str, float],
    overdue: list[dict[str, Any]],
    gst: dict[str, float],
    forecast: dict[str, Any],
    sources: list[dict[str, Any]],
    supporting_from_context: list[str],
    document_context_note: str,
) -> tuple[dict[str, Any], str]:
    q = question.lower()
    mode = "general"

    if "gst" in q:
        mode = "gst"
        response = {
            "answer": f"Your estimated GST liability from open invoices is about Rs {gst['estimated_gst_liability']:.0f}.",
            "why": f"This comes from GST amounts on current invoice records. {document_context_note}",
            "supporting_items": [
                f"Taxable invoice value: Rs {gst['taxable_value']:.0f}",
                f"Open GST payable: Rs {gst['estimated_gst_liability']:.0f}",
                *supporting_from_context,
            ],
            "sources": sources,
        }
        return response, mode

    if "late" in q or "overdue" in q or "follow up" in q or "follow-up" in q:
        mode = "collections"
        names = [invoice["client_name"] for invoice in overdue] or ["No client is currently overdue"]
        overdue_support = [
            f"{invoice['invoice_number']} overdue by {(date.today() - date.fromisoformat(invoice['due_date'])).days} day(s)"
            for invoice in overdue
        ]
        response = {
            "answer": "Clients needing follow-up: " + ", ".join(names),
            "why": f"The overdue list is driven directly by invoice due dates. {document_context_note}",
            "supporting_items": overdue_support + supporting_from_context
            if overdue_support
            else ["All invoice due dates are current.", *supporting_from_context],
            "sources": sources,
        }
        return response, mode

    if "runway" in q or "cash flow" in q:
        mode = "forecast"
        response = {
            "answer": f"Projected 30-day balance is Rs {forecast['projected_30_day_balance']:.0f}.",
            "why": f"The forecast uses current net cash delta and open invoice recovery assumptions. {document_context_note}",
            "supporting_items": [
                forecast["warning"] or "No immediate negative cash warning.",
                f"Current balance estimate: Rs {forecast['current_balance_estimate']:.0f}",
                *supporting_from_context,
            ],
            "sources": sources,
        }
        return response, mode

    if "proof" in q or "verify" in q or "hash" in q or "audit" in q:
        mode = "trust"
        response = {
            "answer": "Your trust layer is active: anchored proof records and audit events are available for invoices and proof-backed documents.",
            "why": f"This answer is grounded in retrieved proof, invoice, and audit context. {document_context_note}",
            "supporting_items": supporting_from_context
            or ["Proof and audit context is available after invoice generation or verified uploads."],
            "sources": sources,
        }
        return response, mode

    response = {
        "answer": f"Total income is Rs {totals['income']:.0f}, total expense is Rs {totals['expense']:.0f}, and savings delta is Rs {totals['savings_delta']:.0f}.",
        "why": f"This answer comes from parsed transactions, invoice records, and retrieved context snippets. {document_context_note}",
        "supporting_items": [
            f"Overdue invoices: {len(overdue)}",
            f"Estimated GST liability: Rs {gst['estimated_gst_liability']:.0f}",
            *supporting_from_context,
        ],
        "sources": sources,
    }
    return response, mode


def _build_copilot_prompt(question: str, base_response: dict[str, Any], sources: list[dict[str, Any]]) -> str:
    evidence = "\n".join(
        f"- {source['source_label']} ({source['source_type']}): {source['excerpt']}"
        for source in sources[:4]
    )
    supporting = "\n".join(f"- {item}" for item in base_response["supporting_items"][:4])
    return (
        "You are Finance Copilot for 2ASK Ledger. Use only the provided evidence and "
        "deterministic finance facts. Never invent numbers.\n\n"
        f"QUESTION:\n{question}\n\n"
        f"DETERMINISTIC ANSWER CANDIDATE:\n{base_response['answer']}\n\n"
        f"WHY:\n{base_response['why']}\n\n"
        f"SUPPORTING FACTS:\n{supporting}\n\n"
        f"EVIDENCE:\n{evidence}\n"
    )


def _merge_copilot_response(base_response: dict[str, Any], generated: dict[str, Any]) -> dict[str, Any]:
    if generated.get("confidence", 0) > 0:
        return {
            "answer": generated.get("answer") or base_response["answer"],
            "why": generated.get("why") or base_response["why"],
            "supporting_items": generated.get("supporting_items") or base_response["supporting_items"],
            "sources": base_response["sources"],
            "confidence": generated.get("confidence", 0),
            "redacted_items": generated.get("redacted_items", []),
            "reasoning_steps": generated.get("reasoning_steps", []),
        }

    return {
        **base_response,
        "confidence": 72 if base_response["sources"] else 45,
        "redacted_items": [],
        "reasoning_steps": ["Returned a deterministic fallback response because the generation runtime was unavailable."],
    }


def ask_cfo(question: str) -> dict[str, Any]:
    totals = compute_totals()
    invoices = list_invoices()
    overdue = [
        invoice for invoice in invoices
        if invoice["status"] != "paid" and date.fromisoformat(invoice["due_date"]) < date.today()
    ]
    gst = compute_gst_summary()
    forecast = forecast_30_days()
    document_retrieved = retrieve_document_context(question, top_k=4)
    retrieved = document_retrieved or retrieve_context(question, top_k=5)
    sources = _source_payloads(retrieved)
    supporting_from_context = [
        f"{item.source_label}: {item.excerpt[:120]}"
        for item in retrieved[:3]
    ]
    document_context_note = (
        "The answer is grounded in indexed invoice and uploaded document content."
        if document_retrieved
        else "The answer is grounded in the current ledger, invoice, and proof context."
    )
    base_response, mode = _build_base_response(
        question,
        totals,
        overdue,
        gst,
        forecast,
        sources,
        supporting_from_context,
        document_context_note,
    )
    generated = gemma_service.generate_structured(_build_copilot_prompt(question, base_response, sources))
    response = _merge_copilot_response(base_response, generated)
    create_audit_event(1, "cfo_query", "latest", "cfo_question_answered", {"question": question, "mode": mode})
    return response


def _insight(insight_type: str, title: str, explanation: str, priority: str, why_it_matters: str) -> dict[str, Any]:
    return {
        "id": 0,
        "user_id": 1,
        "insight_type": insight_type,
        "title": title,
        "explanation": explanation,
        "priority": priority,
        "why_it_matters": why_it_matters,
        "created_at": datetime.utcnow().isoformat(),
    }
