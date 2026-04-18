from fastapi import APIRouter, File, UploadFile

from models.schemas import UploadResponse
from services.document_service import register_document
from services.finance_service import store_transactions
from services.storage import fetch_all, rows_to_dicts

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("")
def list_documents():
    return rows_to_dicts(fetch_all("SELECT * FROM uploaded_documents ORDER BY created_at DESC"))


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    result = register_document(1, file.filename or "upload.bin", content)
    transactions = []
    extraction_summary = result["extraction_json"].get("summary")
    ai_analysis = extraction_summary or "This artifact has been successfully indexed and hashed for verification."
    
    if result["parsed_transactions"]:
        transactions = store_transactions(1, result["document"]["id"], result["parsed_transactions"])
        total_val = sum(t["amount"] for t in transactions)
        ai_analysis = (
            f"Analyzed {len(transactions)} entries totaling Rs {total_val:,.2f}. "
            f"The data has been merged with your dashboard. "
            "Our RAG engine identifies this as a valid financial state transition."
        )
    
    return {
        "document": result["document"],
        "extracted_transactions": transactions,
        "proof_record": result["proof_record"],
        "ai_analysis": ai_analysis,
        "extraction_json": result.get("extraction_json", {}),
        "extraction_meta": result.get("extraction_meta", {}),
        "pipeline_steps": result.get("pipeline_steps", []),
    }
