from fastapi import APIRouter, Query

from services.audit_service import list_audit_events
from services.proof_service import list_proofs

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/events")
def get_audit_events(limit: int = Query(default=50, le=200), action: str | None = None):
    return list_audit_events(limit=limit, action=action)


@router.get("/proofs")
def get_proofs(limit: int = Query(default=50, le=200)):
    return list_proofs(limit=limit)
