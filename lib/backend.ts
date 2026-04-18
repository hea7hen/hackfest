// lib/backend.ts — centralizes all backend API calls

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface Transaction {
  id?: string;
  vendor?: string;
  amount: number;
  gst_amount?: number;
  date?: string;
  category?: string;
  vendor_type?: string;
  description?: string;
}

export interface AskResponse {
  answer: string;
  tool_used: string;
  contexts: Array<{
    source: string;
    section: string;
    text: string;
    relevance: number;
  }>;
}

// Main RAG chat — called from chat component
export async function askAgent(
  question: string,
  transactions: Transaction[] = []
): Promise<AskResponse> {
  const res = await fetch(`${BACKEND}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, transactions }),
  });
  if (!res.ok) throw new Error(`/ask failed: ${res.status}`);
  return res.json();
}

// Redact text locally before storing — called before any ChromaDB upload
export async function redactText(rawText: string) {
  const res = await fetch(`${BACKEND}/gateway/redact-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_data: rawText, task: 'redact', dry_run: true }),
  });
  if (!res.ok) throw new Error(`/gateway/redact-only failed: ${res.status}`);
  return res.json() as Promise<{
    redacted_text: string;
    redaction_count: number;
    sensitivity_score: number;
  }>;
}

// Upload redacted receipt to ChromaDB
export async function uploadDocument(
  text: string,
  filename: string,
  date = '',
  docType = 'receipt'
) {
  const { redacted_text } = await redactText(text);   // redact first, always

  const formData = new FormData();
  formData.append('file', new Blob([redacted_text], { type: 'text/plain' }), filename);
  formData.append('date', date);
  formData.append('doc_type', docType);

  const res = await fetch(`${BACKEND}/upload-document`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`/upload-document failed: ${res.status}`);
  return res.json() as Promise<{ doc_id: string; status: string }>;
}

// Fast receipt → structured JSON for dashboard
export async function analyzeReceipt(text: string, filename: string) {
  const formData = new FormData();
  formData.append('file', new Blob([text], { type: 'text/plain' }), filename);

  const res = await fetch(`${BACKEND}/analyze-receipt`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = (await res.json()) as { detail?: string };
      if (typeof j?.detail === 'string') detail = ` — ${j.detail}`;
    } catch {
      /* ignore */
    }
    throw new Error(`/analyze-receipt failed: ${res.status}${detail}`);
  }
  return res.json();
}

// Complex task that needs Gemini + web search
export async function gatewayProcess(rawData: string, task: string) {
  const res = await fetch(`${BACKEND}/gateway/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_data: rawData, task, use_web_search: true }),
  });
  if (!res.ok) throw new Error(`/gateway/process failed: ${res.status}`);
  return res.json();
}

// Health check
export async function checkBackendHealth() {
  const res = await fetch(`${BACKEND}/health`);
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json() as Promise<{ status: string; lm_studio: boolean; chromadb: boolean }>;
}
