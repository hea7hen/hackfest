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
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Scan Document</h1>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          Upload receipt text files. AI extracts vendor, amount, GST, and stores securely.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50 shadow-inner'
            : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-slate-200/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <Upload size={28} className="text-blue-600" />
        </div>
        <p className="text-sm font-bold text-slate-900">Drop receipt files here or click to browse</p>
        <p className="text-xs text-slate-400 mt-1 font-medium">Supports .txt and .json files</p>
      </div>

      <div className="rounded-2xl bg-blue-50/50 border border-blue-100 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">
          Gmail Smart Intelligence
        </p>
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          The extraction engine is currently bypassing authentication for this workshop.
          Extracted JSON from your simulated inbox will flow directly into this secure processor.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
            Processed Ledger ({files.length})
          </h2>
          {files.map(f => (
            <div key={f.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                </div>
                <span className="text-sm font-bold flex-1 truncate text-slate-900">{f.name}</span>
                {f.status === 'processing' && <Loader2 size={16} className="animate-spin text-blue-600" />}
                {f.status === 'done'       && <CheckCircle size={18} className="text-emerald-500" />}
                {f.status === 'error'      && <AlertCircle size={18} className="text-rose-500" />}
              </div>

              {f.status === 'done' && f.extracted && (
                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                  {detailKeys
                    .filter(k => f.extracted![k] !== undefined)
                    .map(k => (
                      <div key={k} className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">{k.replace('_', ' ')}</span>
                        <p className="font-black text-slate-900">{String(f.extracted![k])}</p>
                      </div>
                    ))}
                </div>
              )}

              {f.status === 'error' && (
                <p className="text-xs text-rose-600 mt-2 font-medium px-1">{f.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
