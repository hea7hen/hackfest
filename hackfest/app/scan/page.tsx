'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { uploadDocument, analyzeReceipt } from '@/lib/backend';
import { db } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import type { TransactionCategory, TaxType, DocumentType, DocumentSource } from '@/lib/types';

interface ProcessedFile {
  id: string;
  name: string;
  status: 'processing' | 'done' | 'error';
  extracted?: Record<string, unknown>;
  error?: string;
}

function mapExtractedCategory(raw: string): TransactionCategory {
  const s = raw.toLowerCase();
  if (s.includes('cloud') || s.includes('software') || s.includes('workspace') || s.includes('telecom') || s.includes('marketing')) {
    return 'business';
  }
  if (s.includes('food')) return 'food';
  if (s.includes('transport')) return 'transport';
  if (s.includes('salary')) return 'salary';
  if (s.includes('medical')) return 'medical';
  if (s.includes('tax')) return 'tax';
  if (s.includes('shopping')) return 'shopping';
  if (s.includes('entertainment')) return 'entertainment';
  if (s.includes('utilities') || s.includes('utility')) return 'utilities';
  if (s.includes('rent')) return 'rent';
  return 'other';
}

export default function ScanPage() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);

  const processFile = useCallback(async (file: File) => {
    const id = nanoid();
    const entry: ProcessedFile = { id, name: file.name, status: 'processing' };
    setFiles(prev => [...prev, entry]);

    try {
      const text = await file.text();

      const extracted = await analyzeReceipt(text, file.name);

      const category = mapExtractedCategory(String(extracted.category || 'other'));
      const gstAmount = Number(extracted.gst_amount) || 0;
      const gstRate = Number(extracted.gst_rate) || 0;
      const taxType: TaxType = gstAmount > 0 || gstRate > 0 ? 'GST' : 'none';

      await db.transactions.add({
        id: nanoid(),
        amount:        Number(extracted.amount) || 0,
        currency:      'INR' as const,
        vendor:        String(extracted.vendor || ''),
        date:          String(extracted.date || new Date().toISOString().split('T')[0]),
        category:      (extracted.category as string || 'other') as TransactionCategory,
        description:   String(extracted.description || file.name),
        isTaxDeductible: Boolean(extracted.itc_eligible),
        taxType:       (extracted.gst_rate ? 'GST' : 'none') as TaxType,
        taxAmount:     Number(extracted.gst_amount) || null,
        confidence:    0.85,
        documentType:  'receipt' as DocumentType,
        source:        'upload' as DocumentSource,
        rawOcrText:    text,
        aiReasoning:   `SAC: ${extracted.sac_code ?? 'unknown'}`,
        monthYear:     (String(extracted.date || '')).slice(0, 7) || new Date().toISOString().slice(0, 7),
        createdAt:     new Date().toISOString(),
        humanReviewed: false,
      });

      await uploadDocument(text, file.name, String(extracted.date || ''), 'receipt');

      setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'done', extracted: { ...extracted } as Record<string, unknown> } : f
      ));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      setFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, status: 'error', error: message }
          : f
      ));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/plain': ['.txt'], 'application/json': ['.json'] },
    onDrop: acceptedFiles => acceptedFiles.forEach(f => void processFile(f)),
  });

  const detailKeys = ['vendor', 'amount', 'gst_amount', 'category', 'date', 'sac_code'] as const;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4FF]">Scan Document</h1>
        <p className="text-sm text-[#8899AA] mt-1">
          Upload receipt text files. AI extracts vendor, amount, GST, and stores securely.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-white/[0.12] hover:border-white/25'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={32} className="mx-auto mb-3 text-[#8899AA]" />
        <p className="text-sm font-medium text-[#F0F4FF]">Drop receipt files here or click to browse</p>
        <p className="text-xs text-[#8899AA] mt-1">Supports .txt and .json files</p>
      </div>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
          Gmail PDF extraction
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Use the &quot;Open Gmail JSON&quot; button on the Dashboard to extract PDFs directly from your inbox.
          Extracted text is automatically sent here for processing.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-[#8899AA] uppercase tracking-wide">
            Processed ({files.length})
          </h2>
          {files.map(f => (
            <div key={f.id} className="rounded-xl border border-white/[0.08] bg-[#131929]/50 p-4">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-[#8899AA] shrink-0" />
                <span className="text-sm font-medium flex-1 truncate text-[#F0F4FF]">{f.name}</span>
                {f.status === 'processing' && <Loader2 size={16} className="animate-spin text-blue-500" />}
                {f.status === 'done'       && <CheckCircle size={16} className="text-green-500" />}
                {f.status === 'error'      && <AlertCircle size={16} className="text-red-500" />}
              </div>

              {f.status === 'done' && f.extracted && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {detailKeys
                    .filter(k => f.extracted![k] !== undefined)
                    .map(k => (
                      <div key={k} className="bg-[#0A0F1E] rounded-lg p-2 border border-white/[0.06]">
                        <span className="text-[#8899AA] capitalize">{k.replace('_', ' ')}</span>
                        <p className="font-medium mt-0.5 text-[#F0F4FF]">{String(f.extracted![k])}</p>
                      </div>
                    ))}
                </div>
              )}

              {f.status === 'error' && (
                <p className="text-xs text-red-500 mt-2">{f.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
