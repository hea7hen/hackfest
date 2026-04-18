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
from typing import Any, Optional

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


def _coerce_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, bool):
        return float(int(val))
    if isinstance(val, (int, float)):
        return float(val)
    s = re.sub(r"[₹,\s]", "", str(val).strip())
    if not s:
        return default
    try:
        return float(s)
    except ValueError:
        return default


def _coerce_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        s = val.strip().lower()
        if s in ("false", "0", "no", "n"):
            return False
        return s in ("true", "1", "yes", "y")
    return bool(val)


def _extract_json_object(s: str) -> Optional[str]:
    """Find a balanced {...} substring when the model adds prose around JSON."""
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    for i, ch in enumerate(s[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    return None


def normalize_llm_receipt_dict(parsed: Any, raw_text: str) -> dict[str, Any]:
    """LLMs often return strings for numbers or omit keys — coerce before Pydantic."""
    if isinstance(parsed, list) and len(parsed) > 0:
        parsed = parsed[0]
    if not isinstance(parsed, dict):
        parsed = {}

    return {
        "vendor": str(parsed.get("vendor") or "Unknown")[:500],
        "amount": _coerce_float(parsed.get("amount")),
        "gst_amount": _coerce_float(parsed.get("gst_amount")),
        "gst_rate": _coerce_float(parsed.get("gst_rate")),
        "date": str(parsed.get("date") or "")[:32],
        "category": str(parsed.get("category") or "Other")[:120],
        "sac_code": str(parsed.get("sac_code") or "")[:32],
        "description": str(parsed.get("description") or "")[:2000],
        "itc_eligible": _coerce_bool(parsed.get("itc_eligible", True)),
        "raw_text": raw_text,
    }


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
    raw_text = content.decode("utf-8", errors="replace").strip()

    if len(raw_text) < 8:
        raise HTTPException(
            status_code=400,
            detail="No readable text in upload. For PDFs, ensure the file has a text layer (not scan-only); try another export.",
        )

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

    llm_output = None
    try:
        response = lm_client.chat.completions.create(
            model=LM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": f"Receipt text:\n{raw_text[:24000]}"}
            ],
            temperature=0.0,
            max_tokens=512,
        )
        llm_output = response.choices[0].message.content

        # Strip markdown fences if present
        clean = re.sub(r"```json|```", "", llm_output or "").strip()
        if not clean.startswith("{"):
            extracted = _extract_json_object(clean)
            if extracted:
                clean = extracted

        parsed = json.loads(clean)
        normalized = normalize_llm_receipt_dict(parsed, raw_text)
        return ReceiptExtractResponse(**normalized)

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"LLM returned invalid JSON for receipt. Raw (truncated): {(llm_output or '')[:400]!r} — {e!s}",
        )
    except Exception as e:
        err = str(e)
        if "Connection" in err or "refused" in err.lower() or "ConnectError" in err:
            raise HTTPException(
                status_code=503,
                detail="LM Studio unreachable. Start LM Studio (or set LM_STUDIO_URL) and load a chat model matching LM_STUDIO_MODEL in .env.",
            )
        raise HTTPException(status_code=500, detail=f"Receipt analysis failed: {err}")


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
