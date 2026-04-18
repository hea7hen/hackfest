'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, DollarSign, Percent, Tag } from 'lucide-react';
import { parseInvoicePdf } from '@/app/actions/pdfAction';
import { analyzeInvoiceSimple } from '@/app/actions/invoiceAnalysisAction';
import Tesseract from 'tesseract.js';

interface InvoiceAnalysis {
  id: string;
  fileName: string;
  status: 'processing' | 'done' | 'error';
  extracted?: {
    vendor?: string;
    amount?: number;
    discount?: number;
    gst_amount?: number;
    gst_rate?: number;
    tax_amount?: number;
    category?: string;
    date?: string;
    description?: string;
    invoice_number?: string;
    [key: string]: any;
  };
  error?: string;
  rawText?: string;
}

export default function InvoiceAnalyzerPage() {
  const [analyses, setAnalyses] = useState<InvoiceAnalysis[]>([]);

  const processImage = useCallback(async (file: File) => {
    const id = Math.random().toString(36).substr(2, 9);
    const entry: InvoiceAnalysis = { id, fileName: file.name, status: 'processing' };
    setAnalyses(prev => [...prev, entry]);

    try {
      let text = '';
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

      if (isPdf) {
        // Handle PDF using server-side PDF parsing
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        
        // Convert to base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64String = btoa(binary);
        
        const result = await parseInvoicePdf(base64String);
        
        if (!result.success || !result.document) {
          throw new Error(result.error || 'Failed to extract text from PDF');
        }
        text = result.document.fullText;
      } else {
        // Handle image using Tesseract OCR
        const { data: { text: ocrText } } = await Tesseract.recognize(
          file,
          'eng',
          {
            logger: (m: any) => {
              if (m.progress) {
                console.log('OCR Progress:', (m.progress * 100).toFixed(0) + '%');
              }
            },
          }
        );
        text = ocrText;
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text could be extracted from the file. Please try with a clearer image or PDF.');
      }

      // Analyze the extracted text using simple regex-based extraction
      const extracted = await analyzeInvoiceSimple(text, file.name);

      setAnalyses(prev => prev.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'done',
              extracted: extracted as any,
              rawText: text,
            }
          : a
      ));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      setAnalyses(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'error', error: message } : a
      ));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    onDrop: acceptedFiles => acceptedFiles.forEach(f => void processImage(f)),
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Invoice Analyzer</h1>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          Upload invoice images or PDFs. AI extracts and analyzes spending, tax, discounts, and GST.
        </p>
      </div>

      {/* Upload Section */}
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
          <Upload size={32} className="text-blue-600" />
        </div>
        <p className="text-lg font-bold text-slate-900">Drop invoice images here or click to browse</p>
        <p className="text-sm text-slate-400 mt-2 font-medium">Supports JPG, PNG, GIF, WebP, and PDF files</p>
      </div>

      {/* Analysis Results */}
      {analyses.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Analysis Results</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyses.map(analysis => (
              <div key={analysis.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                      <FileText size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{analysis.fileName}</p>
                      <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <div>
                    {analysis.status === 'processing' && <Loader2 size={20} className="animate-spin text-blue-600" />}
                    {analysis.status === 'done' && <CheckCircle size={20} className="text-emerald-500" />}
                    {analysis.status === 'error' && <AlertCircle size={20} className="text-rose-500" />}
                  </div>
                </div>

                {/* Processing State */}
                {analysis.status === 'processing' && (
                  <div className="py-8">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
                      <p className="text-sm text-slate-600 font-medium">
                        {analysis.fileName.endsWith('.pdf') ? 'Extracting from PDF...' : 'Running OCR on image...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {analysis.status === 'error' && (
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                    <p className="text-sm font-semibold text-rose-900 mb-1">Analysis Failed</p>
                    <p className="text-xs text-rose-700">{analysis.error}</p>
                  </div>
                )}

                {/* Success State */}
                {analysis.status === 'done' && analysis.extracted && (
                  <div className="space-y-4">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Total Amount */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign size={14} className="text-blue-600" />
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Amount</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          ₹{(analysis.extracted.amount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>

                      {/* GST Amount */}
                      <div className="bg-gradient-to-br from-purple-50 to-purple-50/50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Percent size={14} className="text-purple-600" />
                          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">GST</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          ₹{(analysis.extracted.gst_amount || 0).toLocaleString('en-IN')}
                        </p>
                        {analysis.extracted.gst_rate && (
                          <p className="text-xs text-slate-600 mt-1">@ {analysis.extracted.gst_rate}%</p>
                        )}
                      </div>

                      {/* Discount */}
                      {analysis.extracted.discount && (
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Tag size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Discount</span>
                          </div>
                          <p className="text-2xl font-black text-slate-900">
                            ₹{analysis.extracted.discount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}

                      {/* Tax Amount */}
                      {analysis.extracted.tax_amount && (
                        <div className="bg-gradient-to-br from-orange-50 to-orange-50/50 rounded-xl p-4 border border-orange-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Percent size={14} className="text-orange-600" />
                            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Tax</span>
                          </div>
                          <p className="text-2xl font-black text-slate-900">
                            ₹{analysis.extracted.tax_amount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                      <div className="grid grid-cols-2 gap-3">
                        {analysis.extracted.vendor && (
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vendor</p>
                            <p className="text-sm font-semibold text-slate-900">{analysis.extracted.vendor}</p>
                          </div>
                        )}
                        {analysis.extracted.invoice_number && (
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice #</p>
                            <p className="text-sm font-semibold text-slate-900">{analysis.extracted.invoice_number}</p>
                          </div>
                        )}
                        {analysis.extracted.date && (
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                            <p className="text-sm font-semibold text-slate-900">
                              {new Date(analysis.extracted.date).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        )}
                        {analysis.extracted.category && (
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                            <p className="text-sm font-semibold text-slate-900 capitalize">{analysis.extracted.category}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {analysis.extracted.description && (
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Description</p>
                        <p className="text-sm text-blue-900 leading-relaxed">{analysis.extracted.description}</p>
                      </div>
                    )}

                    {/* Tax Deductibility */}
                    {analysis.extracted.itc_eligible !== undefined && (
                      <div className={`rounded-xl p-4 border ${
                        analysis.extracted.itc_eligible
                          ? 'bg-emerald-50 border-emerald-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}>
                        <p className={`text-sm font-bold ${
                          analysis.extracted.itc_eligible ? 'text-emerald-900' : 'text-amber-900'
                        }`}>
                          {analysis.extracted.itc_eligible ? '✓ ITC Eligible' : '⚠ Not ITC Eligible'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {analyses.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-600">No invoices analyzed yet</p>
          <p className="text-sm text-slate-500 mt-2">Upload an invoice image or PDF to get started</p>
        </div>
      )}
    </div>
  );
}
