from fastapi import APIRouter

from models.schemas import AskCfoRequest, AskCfoResponse
from services.finance_service import ask_cfo

router = APIRouter(prefix="/cfo", tags=["AI CFO"])


@router.post("/ask", response_model=AskCfoResponse)
def ask_cfo_question(payload: AskCfoRequest):
    return ask_cfo(payload.question)
