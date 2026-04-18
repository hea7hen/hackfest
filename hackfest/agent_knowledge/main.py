"""
main.py
-------
FastAPI backend for 2ASK.
Exposes:
  POST /ask              — main agent Q&A endpoint
  POST /upload-document  — add receipt/doc to ChromaDB user store
  GET  /health           — liveness check
  POST /analyze-receipt  — lightweight OCR-structured extraction (no RAG, just LLM)
"""

import json
import os
import re
import sys
import uuid
from typing import Any

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

from project_env import load_project_dotenv

load_project_dotenv()

from agent import add_document_to_store, run_agent

# LM Studio client for receipt analysis
lm_client = OpenAI(
    base_url=os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1"),
    api_key="lm-studio"
)
LM_MODEL = os.getenv("LM_STUDIO_MODEL", "mlx-community/gemma-3-4b-it-4bit")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="2ASK Tax Agent API",
    description="RAG-powered Indian tax assistant for freelancers.",
    version="1.0.0"
)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'privacy_hf'))
from privacy_gateway import get_gateway_router  # noqa: E402

app.include_router(get_gateway_router(), prefix="/gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LM_STUDIO_BASE = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1").rstrip("/")


# ── Request / Response models ─────────────────────────────────────────────────

class Transaction(BaseModel):
    id:          str  = ""
    vendor:      str  = ""
    amount:      Any  = 0       # float or str with ₹
    gst_amount:  Any  = 0
    date:        str  = ""
    category:    str  = ""
    vendor_type: str  = ""
    description: str  = ""


class AskRequest(BaseModel):
    question:     str
    transactions: list[Transaction] = []


class AskResponse(BaseModel):
    answer:    str
    tool_used: str
    contexts:  list[dict]


class ReceiptExtractResponse(BaseModel):
    vendor:      str
    amount:      float
    gst_amount:  float
    gst_rate:    float
    date:        str
    category:    str
    sac_code:    str
    description: str
    itc_eligible: bool
    raw_text:    str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Check that LM Studio and ChromaDB are reachable."""
    lm_studio_ok = False
    chroma_ok    = False

    try:
        requests.get(f"{LM_STUDIO_BASE}/models", timeout=3).raise_for_status()
        lm_studio_ok = True
    except Exception:
        pass

    try:
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_db")
        client.list_collections()
        chroma_ok = True
    except Exception:
        pass

    return {
        "status":     "ok" if (lm_studio_ok and chroma_ok) else "degraded",
        "lm_studio":  lm_studio_ok,
        "chromadb":   chroma_ok,
        "model":      LM_MODEL
    }


@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    """
    Main RAG Q&A endpoint.
    The frontend sends the question + all transactions from IndexedDB.
    The agent decides which tool to use and returns a grounded answer.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    txn_dicts = [t.model_dump() for t in req.transactions]

    try:
        result = run_agent(
            question=req.question,
            transactions=txn_dicts
        )
        return AskResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@app.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    date: str        = Form(default=""),
    doc_type: str    = Form(default="receipt")
):
    """
    Accept a text/plain or application/json extracted receipt.
    Embeds and stores in the ChromaDB user_documents collection.
    """
    content = await file.read()
    text    = content.decode("utf-8", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    doc_id  = str(uuid.uuid4())
    success = add_document_to_store(
        doc_id=doc_id,
        text=text,
        filename=file.filename or "unknown",
        date=date,
        doc_type=doc_type
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to store document.")

    return {"doc_id": doc_id, "filename": file.filename, "status": "stored"}


@app.post("/analyze-receipt", response_model=ReceiptExtractResponse)
async def analyze_receipt(file: UploadFile = File(...)):
    """
    Extract structured data from a receipt image/text.
    Uses the LLM directly (no RAG) — fast extraction for the dashboard pipeline.
    The frontend can then store this JSON in IndexedDB.
    """
    content  = await file.read()
    raw_text = content.decode("utf-8", errors="replace")

    system_prompt = """You are a receipt parser for an Indian freelancer finance app.
Extract structured data from the receipt text provided.
Return ONLY valid JSON with these exact fields (no explanation, no markdown):
{
  "vendor":       "vendor name",
  "amount":       0.00,
  "gst_amount":   0.00,
  "gst_rate":     18.0,
  "date":         "YYYY-MM-DD",
  "category":     "Cloud Services|Software|Marketing|Workspace|Transport|Food|Telecom|Other",
  "sac_code":     "998314",
  "description":  "brief description of service",
  "itc_eligible": true
}

ITC eligibility rules:
- Cloud/software/workspace/telecom/marketing → true
- Food/personal transport → false
- If unsure → true

GST rates: Cloud/Software/Workspace/Telecom/Marketing = 18%, Food = 5%, Transport = 5%
Common SAC codes: Cloud=998315, Software=998314, Marketing=998361, Workspace=997212, Telecom=998412, Food=9963, Transport=9964
"""

    try:
        response = lm_client.chat.completions.create(
            model=LM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": f"Receipt text:\n{raw_text}"}
            ],
            temperature=0.0,
            max_tokens=512,
        )
        llm_output = response.choices[0].message.content

        # Strip markdown fences if present
        clean = re.sub(r"```json|```", "", llm_output or "").strip()
        parsed = json.loads(clean)

        return ReceiptExtractResponse(**parsed, raw_text=raw_text)

    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="LLM returned invalid JSON for receipt.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Receipt analysis failed: {str(e)}")


@app.post("/batch-analyze")
async def batch_analyze(files: list[UploadFile] = File(...)):
    """
    Analyze multiple receipts at once.
    Returns a list of extracted transaction objects + stores each in ChromaDB.
    """
    results = []
    for f in files:
        try:
            content  = await f.read()
            raw_text = content.decode("utf-8", errors="replace")

            system_prompt = """Extract receipt data as JSON only. Fields: vendor, amount, gst_amount, gst_rate, date (YYYY-MM-DD), category, sac_code, description, itc_eligible."""

            response = lm_client.chat.completions.create(
                model=LM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": raw_text}
                ],
                temperature=0.0,
                max_tokens=512,
            )
            clean  = re.sub(r"```json|```", "", response.choices[0].message.content or "").strip()
            parsed = json.loads(clean)
            parsed["filename"] = f.filename
            parsed["raw_text"] = raw_text[:200]

            # Also store in ChromaDB
            doc_id = str(uuid.uuid4())
            add_document_to_store(doc_id, raw_text, f.filename, parsed.get("date", ""))

            results.append({"status": "ok", "data": parsed, "doc_id": doc_id})
        except Exception as e:
            results.append({"status": "error", "filename": f.filename, "error": str(e)})

    return {"results": results, "total": len(results)}
