from fastapi import APIRouter

from services.workspace_service import build_tax_passport_summary

router = APIRouter(prefix="/tax-passport", tags=["Tax Passport"])


@router.get("/summary")
def get_tax_passport_summary():
    return build_tax_passport_summary()
