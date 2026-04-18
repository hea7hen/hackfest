from fastapi import APIRouter
from fastapi import File, UploadFile

from models.schemas import InvoiceCreateRequest, InvoiceRecord, InvoiceStatusUpdateRequest
from services.invoice_service import create_invoice, update_invoice_status
from services.proof_service import get_proof_by_id
from services.storage import fetch_all, fetch_one, row_to_dict, rows_to_dicts
from services.workspace_service import list_extracted_invoices, register_incoming_invoice

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("")
def list_invoices():
    return rows_to_dicts(fetch_all("SELECT * FROM invoices ORDER BY created_at DESC"))


@router.post("", response_model=InvoiceRecord)
def generate_invoice(payload: InvoiceCreateRequest):
    return create_invoice(payload)


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int):
    invoice = row_to_dict(fetch_one("SELECT * FROM invoices WHERE id = ?", (invoice_id,)))
    proof = get_proof_by_id(invoice["proof_id"]) if invoice and invoice.get("proof_id") else None
    return {"invoice": invoice, "proof_record": proof}


@router.post("/{invoice_id}/status")
def change_invoice_status(invoice_id: int, payload: InvoiceStatusUpdateRequest):
    invoice = update_invoice_status(invoice_id, payload.status)
    proof = get_proof_by_id(invoice["proof_id"]) if invoice.get("proof_id") else None
    return {"invoice": invoice, "proof_record": proof}


@router.get("/intake")
def list_invoice_intake():
    return list_extracted_invoices()


@router.post("/intake")
async def intake_invoice(file: UploadFile = File(...)):
    content = await file.read()
    result = register_incoming_invoice(1, file.filename or "incoming-invoice.bin", content)
    return {
        "document": result["document"],
        "extracted_transactions": result["parsed_transactions"],
        "proof_record": result["proof_record"],
        "ai_analysis": result["extraction_json"].get("summary") or result["document"]["extracted_summary"],
        "extraction_json": result.get("extraction_json", {}),
        "extraction_meta": result.get("extraction_meta", {}),
        "pipeline_steps": result.get("pipeline_steps", []),
        "extracted_invoice": result.get("extracted_invoice"),
    }
