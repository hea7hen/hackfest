from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: int = 1
    name: str
    email: Optional[str] = None
    profession: str
    gst_registered: bool
    preferred_currency: str = "INR"
    wallet_address: Optional[str] = None
    created_at: datetime


class UserProfileUpdate(BaseModel):
    name: str
    email: Optional[str] = None
    profession: str
    gst_registered: bool
    preferred_currency: str = "INR"
    wallet_address: Optional[str] = None


class UploadedDocumentRecord(BaseModel):
    id: int
    user_id: int
    file_name: str
    file_type: str
    document_type: str
    file_path: str
    hash: str
    parsed_status: str
    extracted_summary: str
    created_at: datetime


class TransactionRecord(BaseModel):
    id: int
    user_id: int
    document_id: Optional[int] = None
    date: date
    description: str
    amount: float
    direction: Literal["credit", "debit"]
    category: str
    confidence: float
    created_at: datetime


class InvoiceCreateRequest(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    issue_date: date
    due_date: date
    subtotal: float
    gst_percent: float = 18.0
    notes: Optional[str] = None


class InvoiceStatusUpdateRequest(BaseModel):
    status: Literal["draft", "sent", "reminder_sent", "paid"]


class InvoiceRecord(BaseModel):
    id: int
    user_id: int
    invoice_number: str
    client_name: str
    client_email: Optional[str] = None
    issue_date: date
    due_date: date
    subtotal: float
    gst_percent: float
    gst_amount: float
    total_amount: float
    status: str
    notes: Optional[str] = None
    pdf_path: str
    hash: str
    proof_id: Optional[int] = None
    created_at: datetime


class AuditEventRecord(BaseModel):
    id: int
    user_id: int
    entity_type: str
    entity_id: str
    action: str
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class ProofRecord(BaseModel):
    id: int
    entity_type: str
    entity_id: str
    document_hash: str
    anchored_at: datetime
    anchor_type: str
    tx_id: Optional[str] = None
    ipfs_cid: Optional[str] = None
    signer: Optional[str] = None
    verification_status: str


class InsightRecord(BaseModel):
    id: int
    user_id: int
    insight_type: str
    title: str
    explanation: str
    priority: str
    why_it_matters: str
    created_at: datetime


class UploadResponse(BaseModel):
    document: UploadedDocumentRecord
    extracted_transactions: List[TransactionRecord]
    proof_record: Optional[ProofRecord] = None
    ai_analysis: Optional[str] = None
    extraction_json: Dict[str, Any] = Field(default_factory=dict)
    extraction_meta: Dict[str, Any] = Field(default_factory=dict)
    pipeline_steps: List[Dict[str, Any]] = Field(default_factory=list)


class HealthScoreFactor(BaseModel):
    name: str
    score: int
    weight: int
    explanation: str


class HealthScoreResponse(BaseModel):
    score: int
    status: str
    factors: List[HealthScoreFactor]


class ForecastPoint(BaseModel):
    day: str
    projected_balance: float


class ForecastResponse(BaseModel):
    current_balance_estimate: float
    projected_30_day_balance: float
    warning: Optional[str] = None
    series: List[ForecastPoint]


class DashboardSummaryResponse(BaseModel):
    profile: Optional[UserProfile] = None
    totals: Dict[str, float]
    health_score: HealthScoreResponse
    forecast: ForecastResponse
    insights: List[InsightRecord]
    recent_audit_events: List[AuditEventRecord]
    outstanding_invoices: List[InvoiceRecord]
    recurring_expenses: List[Dict[str, Any]]
    unusual_transactions: List[Dict[str, Any]]


class AskCfoRequest(BaseModel):
    question: str


class RagSource(BaseModel):
    source_type: str
    source_label: str
    excerpt: str
    score: float
    confidence: Optional[int] = None
    evidence_snippet: Optional[str] = None
    page_number: Optional[int] = None


class AskCfoResponse(BaseModel):
    answer: str
    why: str
    supporting_items: List[str]
    sources: List[RagSource] = Field(default_factory=list)
    confidence: int = 0
    redacted_items: List[str] = Field(default_factory=list)
    reasoning_steps: List[str] = Field(default_factory=list)


class VerificationResponse(BaseModel):
    verified: bool
    document_hash: str
    proof_record: Optional[ProofRecord] = None
    message: str
    semantic_tamper_status: Optional[str] = None
    semantic_confidence: Optional[float] = None
    tamper_signals: List[Dict[str, Any]] = Field(default_factory=list)
