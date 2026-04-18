import type { ParsedPdfDocument } from '@/app/actions/pdfAction';
import type { Transaction, TransactionCategory, TaxType } from '@/lib/types';
import { db } from '@/lib/db/schema';

function parseMoney(raw: string | null): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Normalize various invoice date strings to YYYY-MM-DD */
export function normalizeInvoiceDate(raw: string | null): string {
  if (!raw || raw === 'N/A') {
    return new Date().toISOString().split('T')[0];
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  const m = raw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    let yy = m[3];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }
  return new Date().toISOString().split('T')[0];
}

function guessCategory(vendor: string | null): TransactionCategory {
  const s = (vendor || '').toLowerCase();
  if (s.includes('aws') || s.includes('google') || s.includes('microsoft') || s.includes('cloud')) {
    return 'business';
  }
  if (s.includes('food') || s.includes('restaurant') || s.includes('zomato') || s.includes('swiggy')) {
    return 'food';
  }
  if (s.includes('uber') || s.includes('ola') || s.includes('fuel')) return 'transport';
  return 'business';
}

/**
 * Persist Gmail PDF extraction into Dexie so Tax Passport, chat context, and dashboard update.
 * Idempotent per message + attachment via fixed id.
 */
export async function persistGmailPdfToDexie(params: {
  messageId: string;
  attachmentId: string;
  filename: string;
  subject: string;
  parsed: ParsedPdfDocument;
}): Promise<void> {
  const { messageId, attachmentId, filename, subject, parsed } = params;
  const f = parsed.extractedFields;
  const amount = parseMoney(f.amount);
  const taxAmt = parseMoney(f.taxAmount);
  const vendor = (f.vendorName || subject || 'Unknown').slice(0, 200);
  const date = normalizeInvoiceDate(f.invoiceDate);
  const monthYear = date.slice(0, 7);
  const category = guessCategory(f.vendorName);
  const taxType: TaxType = taxAmt > 0 ? 'GST' : 'none';

  const tx: Transaction = {
    id: `gmail-${messageId}-${attachmentId}`,
    amount,
    currency: 'INR',
    vendor,
    date,
    category,
    description: `${subject} — ${filename}`,
    isTaxDeductible: category === 'business' || category === 'food',
    taxType,
    taxAmount: taxAmt > 0 ? taxAmt : null,
    confidence: 0.72,
    documentType: 'invoice',
    source: 'gmail',
    rawOcrText: parsed.fullText.slice(0, 50000),
    aiReasoning: `Gmail PDF regex extraction. Invoice #${f.invoiceNumber ?? '—'} · GSTIN ${f.gstin ?? '—'}`,
    monthYear,
    createdAt: new Date().toISOString(),
    humanReviewed: false,
  };

  await db.transactions.put(tx);
}

/** Optional: send full text to FastAPI for Chroma RAG (best-effort, does not throw). */
export async function bestEffortUploadToChroma(fullText: string, filename: string, date: string): Promise<void> {
  try {
    const { uploadDocument } = await import('@/lib/backend');
    await uploadDocument(fullText, filename, date, 'invoice');
  } catch {
    // Backend optional for local-only demo
  }
}
