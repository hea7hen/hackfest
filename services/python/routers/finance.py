from fastapi import APIRouter

from models.schemas import AskCfoResponse, ForecastResponse, HealthScoreResponse, InsightRecord
from services.finance_service import (
    ask_cfo,
    compute_gst_summary,
    compute_health_score,
    compute_totals,
    forecast_30_days,
    generate_insights,
    list_transactions,
    recurring_expenses,
    unusual_transactions,
)

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get("/transactions")
def get_transactions():
    return list_transactions()


@router.get("/summary")
def get_finance_summary():
    return {
        "totals": compute_totals(),
        "gst": compute_gst_summary(),
        "recurring_expenses": recurring_expenses(),
        "unusual_transactions": unusual_transactions(),
    }


@router.get("/health-score", response_model=HealthScoreResponse)
def get_health_score():
    return compute_health_score()


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast():
    return forecast_30_days()


@router.get("/insights")
def get_insights():
    return generate_insights()
