export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Could not reach the backend at ${BACKEND_BASE_URL}. Start the API server or update NEXT_PUBLIC_BACKEND_URL.`
    );
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText || 'Request failed' }));
    const detail =
      typeof error?.detail === 'string' && error.detail.trim()
        ? error.detail
        : 'Request failed';

    throw new Error(
      `${detail} (${response.status}) while requesting ${path} from ${BACKEND_BASE_URL}`
    );
  }

  return response.json() as Promise<T>;
}

export interface DashboardSummary {
  totals: { income: number; expense: number; savings_delta: number };
  health_score: { score: number; status: string; factors: Array<{ name: string; score: number; weight: number; explanation: string }> };
  forecast: { current_balance_estimate: number; projected_30_day_balance: number; warning?: string | null; series: Array<{ day: string; projected_balance: number }> };
  insights: Array<{ id?: number; title: string; explanation: string; priority: string; why_it_matters?: string }>;
  recent_audit_events: Array<{ id: number; action: string; entity_type: string; entity_id: string; metadata_json: Record<string, unknown>; timestamp: string }>;
  outstanding_invoices: Array<OutgoingInvoice>;
}

export interface DocumentRecord {
  id: number;
  file_name: string;
  document_type: string;
  parsed_status: string;
  extracted_summary: string;
  hash: string;
  created_at: string;
}

export interface TransactionRecord {
  id: number;
  date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  category: string;
  confidence: number;
}

export interface FinanceSummary {
  totals: { income: number; expense: number; savings_delta: number };
  gst: { taxable_value: number; estimated_gst_liability: number };
  recurring_expenses: Array<{ category: string; average_amount: number; occurrences: number }>;
  unusual_transactions: TransactionRecord[];
}

export interface OutgoingInvoice {
  id: number;
  invoice_number: string;
  client_name: string;
  client_email?: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  gst_percent: number;
  gst_amount: number;
  total_amount: number;
  status: string;
  notes?: string | null;
  hash: string;
  proof_id?: number | null;
  created_at: string;
}

export interface ExtractedInvoice {
  id: number;
  document_id: number;
  file_name: string;
  vendor_name?: string | null;
  client_name?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  subtotal?: number | null;
  gst_amount?: number | null;
  gst_percent?: number | null;
  total_amount?: number | null;
  currency: string;
  confidence: number;
  suggested_tags: string[];
  warnings: string[];
  ledger_mapping: Record<string, unknown>;
  raw_fields: Record<string, unknown>;
  created_at: string;
}

export interface UploadResponse {
  document: DocumentRecord;
  extracted_transactions: TransactionRecord[];
  proof_record?: ProofRecord | null;
  ai_analysis?: string | null;
  extraction_json: Record<string, unknown>;
  extraction_meta: Record<string, unknown>;
  pipeline_steps: Array<{ id: string; label: string; status: string; detail: string }>;
}

export interface InvoiceIntakeResponse extends UploadResponse {
  extracted_invoice?: ExtractedInvoice | null;
}

export interface AuditEvent {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: Record<string, unknown>;
  timestamp: string;
}

export interface ProofRecord {
  id: number;
  entity_type: string;
  entity_id: string;
  document_hash: string;
  anchored_at: string;
  anchor_type: string;
  tx_id?: string | null;
  signer?: string | null;
  verification_status: string;
}

export interface AskFinanceResponse {
  answer: string;
  why: string;
  supporting_items: string[];
  confidence: number;
  sources: Array<{
    source_type: string;
    source_label: string;
    excerpt: string;
    score: number;
    confidence?: number | null;
    evidence_snippet?: string | null;
    page_number?: number | null;
  }>;
}

export interface VerificationResponse {
  verified: boolean;
  document_hash: string;
  proof_record?: ProofRecord | null;
  message: string;
  semantic_tamper_status?: string | null;
  semantic_confidence?: number | null;
  tamper_signals: Array<{ kind: string; severity?: string; excerpt?: string; explanation: string }>;
}

export interface UserProfile {
  id?: number;
  name: string;
  email?: string | null;
  profession: string;
  gst_registered: boolean;
  preferred_currency: string;
  wallet_address?: string | null;
  created_at?: string;
}

export interface TaxPassportSummary {
  metrics: {
    total_income: number;
    deductible_amount: number;
    gst_exposure: number;
    tds_credit: number;
    review_needed: number;
  };
  entries: Array<{
    id: number | string;
    source_type: string;
    source_id: string;
    title: string;
    entry_date: string;
    amount: number;
    tax_type: string;
    confidence: number;
    status: string;
    tags: string[];
    summary: string;
    document_hash?: string | null;
  }>;
}

export interface PlanningEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  category: string;
  priority: string;
  source_type: string;
  source_id: string;
  origin: string;
  status: string;
  tags: string[];
}

export const getDashboard = () => apiFetch<DashboardSummary>('/dashboard/summary');
export const getDocuments = () => apiFetch<DocumentRecord[]>('/documents');
export const getTransactions = () => apiFetch<TransactionRecord[]>('/finance/transactions');
export const getFinanceSummary = () => apiFetch<FinanceSummary>('/finance/summary');
export const getInvoices = () => apiFetch<OutgoingInvoice[]>('/invoices');
export const getIncomingInvoices = () => apiFetch<ExtractedInvoice[]>('/invoices/intake');
export const getAuditEvents = () => apiFetch<AuditEvent[]>('/audit/events');
export const getProofs = () => apiFetch<ProofRecord[]>('/audit/proofs');
export const getInsights = () => apiFetch<Array<{ title: string; explanation: string; priority: string }>>('/finance/insights');
export const getTaxPassport = () => apiFetch<TaxPassportSummary>('/tax-passport/summary');
export const getPlanningEvents = () => apiFetch<PlanningEvent[]>('/planning/events');
export const getProfile = () => apiFetch<UserProfile | null>('/user/profile');

export const askFinanceCopilot = (question: string) =>
  apiFetch<AskFinanceResponse>('/cfo/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadResponse>('/documents/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function intakeInvoice(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<InvoiceIntakeResponse>('/invoices/intake', {
    method: 'POST',
    body: formData,
  });
}

export const createInvoice = (payload: {
  client_name: string;
  client_email?: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  gst_percent: number;
  notes?: string;
}) =>
  apiFetch<OutgoingInvoice>('/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const updateInvoiceStatus = (invoiceId: number, status: string) =>
  apiFetch<{ invoice: OutgoingInvoice; proof_record?: ProofRecord | null }>(`/invoices/${invoiceId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

export async function verifyDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<VerificationResponse>('/verification/document', {
    method: 'POST',
    body: formData,
  });
}

export const updateProfile = (payload: UserProfile) =>
  apiFetch<UserProfile>('/user/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
