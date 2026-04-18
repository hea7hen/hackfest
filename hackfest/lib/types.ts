export type DocumentSource = 'camera' | 'upload' | 'gmail';
export type DocumentType = 'receipt' | 'invoice' | 'bank_statement' | 'salary_slip' | 'upi_screenshot' | 'unknown';
export type TransactionCategory = 'food' | 'transport' | 'utilities' | 'rent' | 'salary' | 'business' | 'medical' | 'entertainment' | 'tax' | 'shopping' | 'other';
export type TaxType = 'GST' | 'TDS' | 'none';
export type Language = 'hi-IN' | 'bn-IN' | 'kn-IN' | 'ml-IN' | 'mr-IN' | 'od-IN' | 'pa-IN' | 'ta-IN' | 'te-IN' | 'gu-IN' | 'en-IN';

export interface Transaction {
  id: string;
  amount: number;
  currency: 'INR';
  vendor: string | null;
  date: string;
  category: TransactionCategory;
  description: string;
  isTaxDeductible: boolean;
  taxType: TaxType;
  taxAmount: number | null;
  confidence: number;
  documentType: DocumentType;
  source: DocumentSource;
  rawOcrText: string;
  aiReasoning: string;
  monthYear: string;
  createdAt: string;
  humanReviewed: boolean;
}

export interface Document {
  id: string;
  source: DocumentSource;
  processedAt: string;
  transactionCount: number;
  gmailMessageId: string | null;
  thumbnailDataUrl: string | null;
}

export interface TaxSummary {
  monthYear: string;
  totalIncome: number;
  totalExpenses: number;
  tdsDeducted: number;
  gstPaid: number;
  deductibleAmount: number;
  estimatedTaxLiability: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  language: Language;
  timestamp: string;
  isVoice: boolean;
}

export interface Insight {
  id: string;
  type: 'spending_spike' | 'tax_deadline' | 'deductible_gap' | 'low_savings' | 'data_gap' | 'month_summary';
  headline: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  actionLabel: string | null;
  createdAt: string;
}

export interface ExtractionResult {
  documentType: DocumentType;
  transactions: Omit<Transaction, 'id' | 'source' | 'rawOcrText' | 'createdAt' | 'monthYear' | 'humanReviewed'>[];
  summary: string;
  totalAmount: number | null;
}

export interface HealthScore {
  score: number;
  label: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  color: string;
}
