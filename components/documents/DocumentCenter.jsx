'use client';

import React, { useEffect, useState } from 'react';
import {
  Database,
  FileArchive,
  Fingerprint,
  Lock,
  ScanSearch,
  Upload,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDocuments, uploadDocument } from '@/lib/api/client';

const currency = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const intakeSteps = [
  {
    icon: Upload,
    title: 'Accept PDF and CSV evidence',
    body: 'The product starts from actual uploaded artifacts instead of manual dashboard entries.',
  },
  {
    icon: Lock,
    title: 'Redact before indexing',
    body: 'Sensitive identifiers are protected before vectors or model context are generated.',
  },
  {
    icon: Fingerprint,
    title: 'Hash and anchor',
    body: 'Every important artifact can be tied to a verifiable proof record and audit event.',
  },
  {
    icon: Database,
    title: 'Store for retrieval',
    body: 'Chunks become retrievable memories so Finance Copilot answers from evidence already in the workspace.',
  },
];

const STAGES = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  CHUNKING: 'chunking',
  EMBEDDING: 'embedding',
  INDEXING: 'indexing',
  DONE: 'done'
};

const stageInfo = {
  [STAGES.UPLOADING]: { icon: Upload, text: 'Transferring artifact...', color: 'text-blue-500' },
  [STAGES.CHUNKING]: { icon: Layers, text: 'Parsing & chunking content...', color: 'text-purple-500' },
  [STAGES.EMBEDDING]: { icon: Cpu, text: 'Generating vector embeddings via LLM...', color: 'text-amber-500' },
  [STAGES.INDEXING]: { icon: Database, text: 'Inserting into LanceDB...', color: 'text-emerald-500' },
};

// Redesigned with Pipeline Visualization + Designer Studio Aesthetics
export default function UploadCenter() {
  const [documents, setDocuments] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uploadStage, setUploadStage] = useState(STAGES.IDLE);

  const load = () => getDocuments().then(setDocuments).catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setResult(null);
    setUploadStage(STAGES.UPLOADING);

    // Simulated visualization timing
    const visualPipeline = async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      await wait(1000); setUploadStage(STAGES.CHUNKING);
      await wait(1500); setUploadStage(STAGES.EMBEDDING);
      await wait(1200); setUploadStage(STAGES.INDEXING);
      await wait(800);
    };

    try {
      const uploadPromise = uploadDocument(file);
      await Promise.all([uploadPromise, visualPipeline()]);
      const response = await uploadPromise;
      
      setResult(response);
      setUploadStage(STAGES.DONE);
      await load();
    } catch (err) {
      setError(err.message);
      setUploadStage(STAGES.IDLE);
    }
  };

  const renderStageVisualizer = () => {
    if (uploadStage === STAGES.IDLE || uploadStage === STAGES.DONE) return null;
    const currentInfo = stageInfo[uploadStage];
    const Icon = currentInfo.icon;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="h-32 w-32 rounded-full border border-dashed border-[#0071E3]/30"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`h-10 w-10 ${currentInfo.color}`} />
          </div>
        </div>
        
        <div className="mt-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#86868B] mb-2">Extraction Pipeline</p>
          <motion.h2 
            key={uploadStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-[32px] tracking-tight text-[#1D1D1F]"
          >
            {currentInfo.text}
          </motion.h2>
        </div>
        
        <div className="mt-12 flex items-center gap-3">
          {[STAGES.UPLOADING, STAGES.CHUNKING, STAGES.EMBEDDING, STAGES.INDEXING].map((s, i) => {
            const stagesList = [STAGES.UPLOADING, STAGES.CHUNKING, STAGES.EMBEDDING, STAGES.INDEXING];
            const currentIndex = stagesList.indexOf(uploadStage);
            const thisIndex = i;
            const isCompleted = thisIndex < currentIndex;
            const isCurrent = thisIndex === currentIndex;

            return (
              <div key={s} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500 scale-110' : isCurrent ? 'bg-[#0071E3] scale-125' : 'bg-[#E8E8ED]'}`} />
                {i < 3 && <div className="h-[1px] w-6 bg-[#E8E8ED]" />}
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-10 pb-20 max-w-[1200px] mx-auto">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="apple-card p-10 flex flex-col justify-between">
          <div>
            <p className="eyebrow text-[#0071E3]">Trust Acquisition</p>
            <h1 className="mt-4 font-display text-[54px] leading-[0.95] tracking-[-0.05em] text-[#1D1D1F]">
              Artifact Ingestion <span className="text-[#86868B]">&</span> Evidence Indexing.
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-[#86868B] font-medium max-w-md">
              The studio accepts raw PDF and CSV records, creating a verifiable link between source evidence and financial answers.
            </p>
          </div>

          <div className="mt-12 space-y-4">
             {intakeSteps.slice(0, 3).map((step, i) => (
               <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#FBFBFD] border border-[#F2F2F7]">
                  <div className="h-10 w-10 rounded-xl bg-white border border-[#E8E8ED] flex items-center justify-center shadow-sm">
                    <step.icon className="h-4 w-4 text-[#1D1D1F]" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-[#1D1D1F]">{step.title}</h4>
                    <p className="text-[12px] text-[#86868B] font-medium leading-normal">{step.body}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>

        <div className="apple-card p-4 relative overflow-hidden group">
          <AnimatePresence>
            {renderStageVisualizer()}
          </AnimatePresence>

          <label className="flex flex-col items-center justify-center h-[500px] rounded-[24px] border-2 border-dashed border-[#E8E8ED] bg-[#FBFBFD] group-hover:border-[#0071E3] group-hover:bg-white transition-all cursor-pointer">
            <div className="h-20 w-20 rounded-[28px] bg-[#1D1D1F] text-white flex items-center justify-center shadow-2xl mb-8 group-hover:scale-110 transition-transform">
              <Upload className="h-8 w-8" />
            </div>
            <h2 className="font-display text-[32px] tracking-tight text-[#1D1D1F]">Source Attachment</h2>
            <p className="text-[14px] text-[#86868B] mt-2 font-medium">Select a PDF statement or CSV record</p>
            
            <div className="mt-10 px-6 py-3 rounded-full bg-[#F5F5F7] text-[#1D1D1F] text-[13px] font-bold group-hover:bg-[#1D1D1F] group-hover:text-white transition-colors">
              Access Local Drive
            </div>
            <input type="file" className="hidden" onChange={handleUpload} accept=".csv,.pdf" />
          </label>

          {error && (
            <div className="absolute bottom-10 left-10 right-10 bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-rose-500 flex items-center justify-center text-white shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-bold text-rose-700">{error}</p>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {result && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="apple-card p-10 bg-[#1D1D1F] text-white overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-10">
               <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                 <ScanSearch className="h-8 w-8 text-emerald-400" />
               </div>
            </div>

            <p className="eyebrow text-[#86868B]">Ingestion Result</p>
            <h2 className="font-display text-[40px] tracking-tight mt-4">Evidence Matched <span className="text-emerald-400">&</span> Indexed.</h2>
            
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 p-8 rounded-3xl bg-white/5 border border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Post-Ingestion Analysis</p>
                <p className="text-[18px] font-medium leading-relaxed italic">
                  &quot;{result.ai_analysis || result.document.extracted_summary}&quot;
                </p>
                
                {result.extracted_transactions?.length > 0 && (
                  <div className="mt-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Structured Payload</p>
                    <div className="grid gap-3">
                       {result.extracted_transactions.slice(0, 3).map((tx, i) => (
                         <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                            <span className="text-[13px] font-bold text-white/80">{tx.description || tx.merchant}</span>
                            <span className="font-mono text-[13px] font-bold text-emerald-400">{currency(tx.amount)}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="p-8 rounded-3xl bg-[#0071E3] text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60 mb-4 text-center">Status</p>
                  <p className="text-[24px] font-bold text-center tracking-tight capitalize">{result.document.parsed_status}</p>
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[12px] font-bold">RAG Ready</span>
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Audit Signature</p>
                  <p className="font-mono text-[11px] break-all text-[#86868B] leading-relaxed">
                    {result.proof_record?.tx_id || "VERIFICATION_PENDING_0x"}
                  </p>
                  <button className="w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-[12px] font-bold">View Audit Trail</button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="apple-card p-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow">Studio Archive</p>
            <h3 className="font-display text-[32px] tracking-tight">Recent Artifacts</h3>
          </div>
          <button className="text-[13px] font-bold text-[#0071E3] hover:underline">Batch Management</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="p-6 rounded-3xl border border-[#F2F2F7] bg-[#FBFBFD] hover:bg-white hover:shadow-xl transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-white border border-[#E8E8ED] flex items-center justify-center">
                  <FileArchive className="h-5 w-5 text-[#1D1D1F]" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#E8E8ED] text-[#1D1D1F]">
                  {doc.document_type}
                </span>
              </div>
              <h4 className="text-[15px] font-bold text-[#1D1D1F] truncate">{doc.filename}</h4>
              <p className="text-[12px] text-[#86868B] mt-1 font-medium italic">
                {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              
              <div className="mt-6 pt-6 border-t border-[#F2F2F7] flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-bold text-[#1D1D1F]">Verifiable</span>
                <ArrowRight className="h-4 w-4 text-[#0071E3]" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
