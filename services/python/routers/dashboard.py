from fastapi import APIRouter

from models.schemas import DashboardSummaryResponse
from services.audit_service import list_audit_events
from services.finance_service import (
    compute_health_score,
    compute_totals,
    forecast_30_days,
    generate_insights,
    list_invoices,
    recurring_expenses,
    unusual_transactions,
)
from services.storage import fetch_one, row_to_dict
from services.gemma_service import GemmaService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary():
    invoices = list_invoices()
    outstanding = [invoice for invoice in invoices if invoice["status"] != "paid"]
    return {
        "profile": row_to_dict(fetch_one("SELECT * FROM users WHERE id = 1")),
        "totals": compute_totals(),
        "health_score": compute_health_score(),
        "forecast": forecast_30_days(),
        "insights": generate_insights(),
        "recent_audit_events": list_audit_events(limit=8),
        "outstanding_invoices": outstanding[:5],
        "recurring_expenses": recurring_expenses(),
        "unusual_transactions": unusual_transactions(),
    }

@router.get("/llm-status")
def get_llm_status():
    import os

    base_url = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    runtime = os.getenv("GEMMA_RUNTIME", "disabled")
    configured_model = os.getenv("GEMMA_MODEL", "gemma-4-local")

    service = GemmaService(runtime=runtime, model=configured_model, base_url=base_url)
    status = {
        "runtime": runtime,
        "resolved_runtime": service.resolved_runtime(),
        "base_url": base_url,
        "configured_model": configured_model,
        "connected": False,
        "models": [],
    }

    try:
        models = service.list_models()
        status["models"] = [m.get("id") for m in models]
        status["connected"] = True
    except Exception as exc:
        status["error"] = str(exc)

    return status


@router.post("/llm-status/connect")
def connect_llm_status():
    import os

    base_url = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    runtime = os.getenv("GEMMA_RUNTIME", "disabled")
    configured_model = os.getenv("GEMMA_MODEL", "gemma-4-local")

    service = GemmaService(runtime=runtime, model=configured_model, base_url=base_url)
    attempt = service.ensure_lmstudio_server()

    response = {
        "runtime": runtime,
        "resolved_runtime": service.resolved_runtime(),
        "base_url": base_url,
        "configured_model": configured_model,
        "connected": False,
        "models": [],
        "attempt": attempt,
    }

    try:
        models = service.list_models()
        response["models"] = [m.get("id") for m in models]
        response["connected"] = True
    except Exception as exc:
        response["error"] = str(exc)

    return response
