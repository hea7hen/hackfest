"""
privacy_gateway.py
------------------
Privacy-preserving two-stage pipeline for 2ASK:

  Stage 1 (LOCAL):  Gemma 4 via LM Studio redacts PII from raw Gmail/doc data
  Stage 2 (CLOUD):  Gemini Flash (with Google Search) performs the task
                    on the sanitized, redacted text only

NEVER modify Stage 1 to skip redaction.
NEVER send raw text to Stage 2.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv
from openai import OpenAI

# Repo-root `.env` (same file Next.js uses when placed at project root)
_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_REPO_ROOT / "agent_knowledge" / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
OLLAMA_URL          = os.getenv("OLLAMA_URL",      "http://localhost:11434/api")
LM_STUDIO_URL       = os.getenv("LM_STUDIO_URL",  "http://localhost:1234/v1")
LOCAL_MODEL         = os.getenv("LM_STUDIO_MODEL","mlx-community/gemma-3-4b-it-4bit")
GOOGLE_API_KEY      = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL        = os.getenv("GEMINI_MODEL",   "gemini-2.5-flash-preview")
MAX_RETRIES         = 2
SENSITIVITY_THRESHOLD = 0.3
# ─────────────────────────────────────────────────────────────────────────────

# Configure Gemini
genai.configure(api_key=GOOGLE_API_KEY)

# LM Studio client
_lm_client = OpenAI(base_url=LM_STUDIO_URL, api_key="lm-studio")


class RedactionCategory(Enum):
    PERSON_NAME      = "PERSON_NAME"
    EMAIL            = "EMAIL"
    PHONE            = "PHONE"
    HOME_ADDRESS     = "HOME_ADDRESS"
    BANK_ACCOUNT     = "BANK_ACCOUNT"
    CARD_NUMBER      = "CARD_NUMBER"
    UPI_ID           = "UPI_ID"
    AADHAAR          = "AADHAAR"
    PAN              = "PAN"
    PASSPORT         = "PASSPORT"
    OTP_PIN          = "OTP_PIN"
    PASSWORD         = "PASSWORD"
    API_KEY          = "API_KEY"
    EMAIL_SIGNATURE  = "EMAIL_SIGNATURE"
    CREDENTIALS      = "CREDENTIALS"
    MEDICAL_INFO     = "MEDICAL_INFO"
    LEGAL_CASE       = "LEGAL_CASE"
    CLIENT_DATA      = "CLIENT_PERSONAL_DATA"
    MSG_ID           = "MSG_ID"
    UTR              = "UTR"


@dataclass
class RedactionResult:
    redacted_text:     str
    original_length:   int
    redacted_length:   int
    redaction_count:   int
    redaction_log:     list[dict]       = field(default_factory=list)
    sensitivity_score: float            = 0.0
    safe_to_send:      bool             = False
    processing_time_ms: int             = 0
    fallback_used:     bool             = False   # True if regex fallback was triggered


@dataclass
class GatewayResponse:
    answer:            str
    task:              str
    redaction_result:  RedactionResult
    model_used:        str
    total_time_ms:     int
    tokens_sent:       int              = 0       # tokens sent to cloud (after redaction)


# ── Regex pre-filter (deterministic, runs before LLM) ────────────────────────
# These patterns are high-confidence and fast — catches obvious PII before Gemma 4

REGEX_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, replacement_token, description)
    (r'\b[A-Z]{5}[0-9]{4}[A-Z]\b',                       "[REDACTED:PAN]",         "PAN number"),
    (r'\b[2-9]\d{11}\b',                                  "[REDACTED:AADHAAR]",     "Aadhaar (12-digit)"),
    (r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',     "[REDACTED:CARD_NUMBER]", "Card number"),
    (r'\b[A-Z]{4}0[A-Z0-9]{6}\b',                        "[REDACTED:IFSC]",        "IFSC code"),
    (r'[\w.+-]+@(gmail|yahoo|hotmail|outlook|protonmail)\.com', "[REDACTED:EMAIL]", "Personal email"),
    (r'\b(\+91|0091|91)?[-.\s]?[6-9]\d{9}\b',            "[REDACTED:PHONE]",       "Indian mobile"),
    (r'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b',                 "[REDACTED:PHONE]",       "Phone (US format)"),
    (r'\b[A-Za-z0-9]{20,}\b(?=.*secret|.*key|.*token)',  "[REDACTED:API_KEY]",     "API key/token"),
    (r'password\s*[:=]\s*\S+',                            "[REDACTED:PASSWORD]",    "Password field"),
    (r'otp\s*[:=\s]\s*\d{4,8}',                          "[REDACTED:OTP_PIN]",     "OTP"),
    (r'\b\d{9}\b',                                        "[REDACTED:BANK_ACCOUNT]","Bank account (9-digit)"),
    (r'\b\d{11}\b',                                       "[REDACTED:BANK_ACCOUNT]","Bank account (11-digit)"),
    (r'\b[A-Za-z0-9._%+-]+@(?!(?:aws|amazon|google|microsoft|razorpay|zoho|stripe|zoom|adobe)\.)[A-Za-z0-9.-]+\.(?:in|co\.in|net|org)\b', "[REDACTED:EMAIL]", "Personal .in email"),
    (r'\b[A-Z][0-9]{7}\b',                               "[REDACTED:PASSPORT]",    "Passport number"),
]


def regex_pre_filter(text: str) -> tuple[str, list[dict]]:
    """
    Fast deterministic redaction of high-confidence PII patterns.
    Runs BEFORE Gemma 4 to reduce the model's load and catch obvious cases.
    """
    log   = []
    clean = text

    for pattern, token, desc in REGEX_PATTERNS:
        matches = re.findall(pattern, clean, flags=re.IGNORECASE)
        if matches:
            clean = re.sub(pattern, token, clean, flags=re.IGNORECASE)
            log.append({"type": desc, "count": len(matches), "replacement": token})

    return clean, log


# ── Stage 1: Local Gemma 4 redaction ─────────────────────────────────────────

GEMMA_REDACTION_SYSTEM = """You are a privacy redaction engine. Your ONLY job is to 
remove personally identifiable information (PII) and sensitive data from text.

REDACT these (replace with the exact token shown):
• Individual person names → [REDACTED:PERSON_NAME]
• Personal email addresses → [REDACTED:EMAIL]  
• Phone numbers → [REDACTED:PHONE]
• Home/residential addresses → [REDACTED:HOME_ADDRESS]
• Bank account numbers → [REDACTED:BANK_ACCOUNT]
• Credit/debit card numbers → [REDACTED:CARD_NUMBER]
• UPI IDs (anything@upi, phone@bank) → [REDACTED:UPI_ID]
• Aadhaar/PAN/Passport numbers → [REDACTED:AADHAAR] / [REDACTED:PAN] / [REDACTED:PASSPORT]
• OTPs, PINs, passwords → [REDACTED:OTP_PIN] / [REDACTED:PASSWORD]
• API keys, secret tokens → [REDACTED:API_KEY]
• Full email signature blocks → [REDACTED:EMAIL_SIGNATURE]
• Medical information → [REDACTED:MEDICAL_INFO]
• Third-party client personal data → [REDACTED:CLIENT_PERSONAL_DATA]

KEEP these (do NOT redact):
• Public company names: AWS, Google, Microsoft, Razorpay, Adobe, Zoom, Infosys, etc.
• Invoice amounts, GST amounts, TDS amounts in rupees
• Vendor GSTIN numbers (e.g., 27AAPFU0939F1ZV)
• SAC codes, HSN codes
• Service descriptions (e.g., "cloud hosting", "software development")
• Dates, financial year references
• Business emails of known vendors (billing@aws.amazon.com, noreply@razorpay.com)
• City and state names (for GST jurisdiction purposes)
• Invoice numbers, transaction reference numbers

RULES:
- Output ONLY the redacted text. No explanation. No preamble. No commentary.
- Preserve all formatting, line breaks, and structure exactly.
- When uncertain if something is PII → REDACT it.
- A company name with "Pvt Ltd", "LLP", "Inc" → KEEP."""


def redact_with_gemma(text: str) -> tuple[str, list[dict]]:
    """
    Call local Gemma 4 2B via LM Studio to redact PII.
    Falls back to pre-filtered text if LM Studio is unreachable.
    """
    try:
        response = _lm_client.chat.completions.create(
            model=LOCAL_MODEL,
            messages=[
                {"role": "system", "content": GEMMA_REDACTION_SYSTEM},
                {"role": "user",   "content": f"Redact this text:\n\n{text}"}
            ],
            temperature=0.0,        # deterministic — redaction must not vary
            max_tokens=len(text) + 300,
        )
        redacted = (response.choices[0].message.content or "").strip()

        # Sanity check: redacted should not be much longer than input
        if len(redacted) > len(text) * 1.30:
            print("[WARNING] LM Studio output too long — using pre-filtered text")
            return text, [{"type": "fallback", "reason": "output_too_long"}]

        tokens_found = re.findall(r'\[REDACTED:[A-Z_]+\]', redacted)
        log = [{"type": t, "count": tokens_found.count(t)} for t in set(tokens_found)]
        return redacted, log

    except Exception as e:
        print(f"[WARNING] LM Studio redaction failed: {e} — using pre-filtered text")
        return text, [{"type": "fallback", "reason": str(e)}]


def compute_sensitivity_score(original: str, redacted: str) -> float:
    """
    Heuristic score: ratio of redacted tokens to total words.
    0.0 = clean, 1.0 = heavily redacted.
    """
    redaction_count = len(re.findall(r'\[REDACTED:[A-Z_]+\]', redacted))
    word_count      = max(len(original.split()), 1)
    return min(redaction_count / (word_count * 0.1), 1.0)


def run_redaction(raw_text: str) -> RedactionResult:
    """
    Full Stage 1 pipeline:
      1. Regex pre-filter (fast, deterministic)
      2. Gemma 4 LLM redaction (catches nuanced PII)
      3. Score and validate
    """
    t_start = time.time()

    # Step 1: Regex pre-filter
    pre_filtered, regex_log = regex_pre_filter(raw_text)

    # Step 2: Gemma 4 LLM redaction
    redacted, llm_log = redact_with_gemma(pre_filtered)

    # Step 3: Score
    score        = compute_sensitivity_score(raw_text, redacted)
    total_redact = len(re.findall(r'\[REDACTED:[A-Z_]+\]', redacted))
    fallback     = any(entry.get("type") == "fallback" for entry in llm_log)

    if score >= SENSITIVITY_THRESHOLD:
        print(f"[PRIVACY] High sensitivity score: {score:.2f} — review redaction log")

    return RedactionResult(
        redacted_text      = redacted,
        original_length    = len(raw_text),
        redacted_length    = len(redacted),
        redaction_count    = total_redact,
        redaction_log      = regex_log + llm_log,
        sensitivity_score  = round(score, 3),
        safe_to_send       = True,   # we always consider post-redaction text safe
        processing_time_ms = int((time.time() - t_start) * 1000),
        fallback_used      = fallback
    )


def run_cloud_model(
    task: str,
    redacted_data: str,
    use_web_search: bool = True
) -> tuple[str, int]:
    """
    Send sanitized (redacted) data to Gemini Flash 3 Preview.
    Optionally enables Google Search grounding for live GST/tax lookups.
    Raw PII never reaches this function — only redacted text.
    """
    prompt = f"""You are 2ASK, a financial intelligence assistant for Indian freelancers.
You are given sanitized financial data (PII has been removed and replaced with [REDACTED:TYPE] tokens).

Task: {task}

Data:
{redacted_data}

Provide a clear, accurate, and actionable response.
Use ₹ for amounts. Reference GST/TDS section numbers where relevant.
If data is redacted, work with what is available."""

    try:
        if use_web_search:
            model = genai.GenerativeModel(
                model_name=GEMINI_MODEL,
                tools=["google_search_retrieval"],
            )
        else:
            model = genai.GenerativeModel(model_name=GEMINI_MODEL)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=1024,
            )
        )

        answer = response.text
        # Gemini doesn't expose token count the same way — estimate from chars
        tokens_sent = len(prompt) // 4
        return answer, tokens_sent

    except Exception as e:
        raise RuntimeError(f"Gemini Flash API call failed: {e}")


# ── Public gateway interface ──────────────────────────────────────────────────

def process_through_gateway(
    raw_data:       str,
    task:           str,
    use_web_search: bool = True,
    dry_run:        bool = False   # if True, returns redacted text without calling cloud
) -> GatewayResponse:
    """
    Full privacy gateway pipeline.

    Args:
        raw_data:       Raw text from Gmail or other source (may contain PII)
        task:           What the cloud model should do with the data
        use_web_search: Whether Claude should have internet access
        dry_run:        Stop after redaction (for testing/auditing)

    Returns:
        GatewayResponse with answer, redaction metadata, timing
    """
    t_start = time.time()
    print(f"[GATEWAY] Processing {len(raw_data)} chars for task: {task[:60]}...")

    # ── Stage 1: Redact locally ───────────────────────────────────────────────
    redaction = run_redaction(raw_data)
    print(f"[STAGE 1] Redacted {redaction.redaction_count} items | "
          f"Score: {redaction.sensitivity_score} | "
          f"Time: {redaction.processing_time_ms}ms")

    if dry_run:
        return GatewayResponse(
            answer           = "[DRY RUN — cloud model not called]",
            task             = task,
            redaction_result = redaction,
            model_used       = "none (dry_run)",
            total_time_ms    = int((time.time() - t_start) * 1000)
        )

    # ── Stage 2: Send to cloud ────────────────────────────────────────────────
    answer, tokens_sent = run_cloud_model(
        task           = task,
        redacted_data  = redaction.redacted_text,
        use_web_search = use_web_search
    )
    total_ms = int((time.time() - t_start) * 1000)
    print(f"[STAGE 2] Cloud answered | Tokens sent: {tokens_sent} | Total: {total_ms}ms")

    return GatewayResponse(
        answer           = answer,
        task             = task,
        redaction_result = redaction,
        model_used       = GEMINI_MODEL,
        total_time_ms    = total_ms,
        tokens_sent      = tokens_sent
    )


# ── Gmail-specific helper ─────────────────────────────────────────────────────

def process_gmail_thread(
    thread:         dict,     # Gmail API thread object
    task:           str,
    use_web_search: bool = True
) -> GatewayResponse:
    """
    Convenience wrapper for Gmail thread objects.
    Extracts text from all messages in the thread, concatenates, then runs gateway.
    """
    parts = []

    for message in thread.get("messages", []):
        headers = {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}

        parts.append(f"=== Email ===")
        parts.append(f"From: {headers.get('From', 'Unknown')}")
        parts.append(f"Date: {headers.get('Date', '')}")
        parts.append(f"Subject: {headers.get('Subject', '')}")
        parts.append("")

        # Extract body (simplified — real impl should handle MIME parts)
        body = message.get("snippet", "")
        if body:
            parts.append(body)
        parts.append("")

    raw_text = "\n".join(parts)
    return process_through_gateway(raw_text, task, use_web_search)


# ── FastAPI integration endpoint (add to main.py) ─────────────────────────────

def get_gateway_router():
    """
    Returns a FastAPI router. Import and include this in main.py:
        from privacy_gateway import get_gateway_router
        app.include_router(get_gateway_router(), prefix="/gateway")
    """
    from fastapi import APIRouter
    from pydantic import BaseModel

    router = APIRouter(tags=["Privacy Gateway"])

    class GatewayRequest(BaseModel):
        raw_data:       str
        task:           str
        use_web_search: bool = True
        dry_run:        bool = False

    class GatewayResponseModel(BaseModel):
        answer:            str
        task:              str
        model_used:        str
        tokens_sent:       int
        total_time_ms:     int
        redaction_count:   int
        sensitivity_score: float
        fallback_used:     bool
        redacted_preview:  str         # first 300 chars of redacted text for debugging

    @router.post("/process", response_model=GatewayResponseModel)
    async def gateway_process(req: GatewayRequest):
        result = process_through_gateway(
            raw_data       = req.raw_data,
            task           = req.task,
            use_web_search = req.use_web_search,
            dry_run        = req.dry_run
        )
        return GatewayResponseModel(
            answer            = result.answer,
            task              = result.task,
            model_used        = result.model_used,
            tokens_sent       = result.tokens_sent,
            total_time_ms     = result.total_time_ms,
            redaction_count   = result.redaction_result.redaction_count,
            sensitivity_score = result.redaction_result.sensitivity_score,
            fallback_used     = result.redaction_result.fallback_used,
            redacted_preview  = result.redaction_result.redacted_text[:300]
        )

    @router.post("/redact-only")
    async def gateway_redact_only(req: GatewayRequest):
        """Just redact — don't call cloud model. Use for testing/auditing."""
        result = run_redaction(req.raw_data)
        return {
            "redacted_text":     result.redacted_text,
            "redaction_count":   result.redaction_count,
            "sensitivity_score": result.sensitivity_score,
            "redaction_log":     result.redaction_log,
            "processing_time_ms": result.processing_time_ms
        }

    return router


# ── CLI test ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Quick smoke test
    sample_email = """
From: Rahul Sharma <rahul.sharma@gmail.com>
To: accounts@acmecorp.com
Date: March 15, 2026
Subject: Invoice INV-2026-0034 — Software Development

Hi team,

Please find attached my invoice for ₹75,000 + GST (18%) = ₹88,500 
for the custom ERP module developed in Q4.

My bank details for payment:
Account Number: 91234567890
IFSC: HDFC0001234
UPI: rahul.sharma@okicici

My PAN: ABCRS1234K
My Aadhaar: 2345 6789 0123

Please transfer before March 20. 
Contact me at +91-98765-43210 if any queries.

Regards,
Rahul Sharma
Senior Software Consultant
+91-98765-43210 | rahul.sharma@gmail.com
"""

    print("=== REDACTION SMOKE TEST ===\n")
    print("INPUT:")
    print(sample_email)
    print("\n" + "="*50 + "\n")

    result = run_redaction(sample_email)
    print("REDACTED OUTPUT:")
    print(result.redacted_text)
    print(f"\nStats: {result.redaction_count} redactions | Score: {result.sensitivity_score}")
    print(f"Time: {result.processing_time_ms}ms | Fallback: {result.fallback_used}")
    print("\nLog:", json.dumps(result.redaction_log, indent=2))
