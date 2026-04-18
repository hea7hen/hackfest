'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileSearch,
  Send,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Database,
  Unlock
} from 'lucide-react';
import { askFinanceCopilot, getInsights } from '@/lib/api/client';

const starterPrompts = [
  'What is my estimated GST liability?',
  'Which invoices need follow-up this week?',
  'Show me proof-backed evidence for overdue payments',
  'What is my current runway based on recent records?',
];

// Redesigned with RAG Inspector + Designer Studio Aesthetics
export default function AskCFO() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [insights, setInsights] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const evidenceChunks = answer?.supporting_evidence
    || answer?.sources?.map((source) => ({
      text: source.evidence_snippet || source.excerpt,
      sourceLabel: source.source_label,
      pageNumber: source.page_number,
      confidence: source.confidence,
    }))
    || [];

  useEffect(() => {
    getInsights()
      .then(setInsights)
      .catch((err) => setError(err.message));
  }, []);

  const submit = async (event) => {
    if (event) event.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    setShowInspector(false);

    try {
      const response = await askFinanceCopilot(question);
      setAnswer(response);
    } catch (err) {
      setAnswer({
        answer: 'Finance Copilot could not complete this request.',
        why: err.message,
        confidence: 0,
        sources: [],
        supporting_items: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-20 max-w-[1200px] mx-auto">
      <section className="grid gap-6 xl:grid-cols-[1fr,0.8fr]">
        <div className="apple-card p-10 flex flex-col justify-between">
          <div>
            <p className="eyebrow text-[#0071E3]">Intelligent Retrieval</p>
            <h1 className="mt-4 font-display text-[54px] leading-[0.95] tracking-[-0.05em] text-[#1D1D1F]">
              Grounded <span className="text-[#86868B]">Strategic</span> Assistance.
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-[#86868B] font-medium max-w-md">
              Finance Copilot queries your workspace artifacts directly. No generic training data—only the evidence you provide.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4">
             <div className="p-5 rounded-3xl bg-[#FBFBFD] border border-[#F2F2F7]">
                <FileSearch className="h-5 w-5 text-[#0071E3] mb-3" />
                <h4 className="text-[14px] font-bold text-[#1D1D1F]">Vector-Ready</h4>
                <p className="text-[12px] text-[#86868B] mt-1 font-medium">LanceDB integration enabled.</p>
             </div>
             <div className="p-5 rounded-3xl bg-[#FBFBFD] border border-[#F2F2F7]">
                <ShieldCheck className="h-5 w-5 text-emerald-500 mb-3" />
                <h4 className="text-[14px] font-bold text-[#1D1D1F]">Local LLM</h4>
                <p className="text-[12px] text-[#86868B] mt-1 font-medium">Gemma processing active.</p>
             </div>
          </div>
        </div>

        <div className="apple-card p-4 relative overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex-1 p-6 flex flex-col">
            <p className="eyebrow mb-6">Ask Assistant</p>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Query your ledger state..."
              className="flex-1 w-full resize-none bg-transparent text-[24px] font-semibold tracking-tight text-[#1D1D1F] outline-none placeholder:text-[#E8E8ED]"
            />
            
            <div className="mt-8 flex flex-wrap gap-2">
              {starterPrompts.slice(0, 3).map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className="px-4 py-2 rounded-full border border-[#E8E8ED] text-[11px] font-bold text-[#86868B] hover:bg-[#1D1D1F] hover:text-white transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="mt-auto p-6 flex items-center justify-between border-t border-[#F2F2F7]">
             <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest">Studio Engine Active</span>
             </div>
             <button 
               onClick={submit}
               disabled={loading || !question.trim()} 
               className="h-14 px-8 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center gap-3 hover:bg-[#0071E3] transition-all disabled:opacity-20"
             >
                <span className="text-[14px] font-bold">Query</span>
                <Send className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
             </button>
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {answer && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="apple-card overflow-hidden relative"
          >
            <div className="p-10 md:p-14">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 border-b border-[#F2F2F7] pb-12">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#86868B] mb-6">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Assistant Generation complete
                  </div>
                  <h2 className="text-[32px] md:text-[42px] font-display leading-[1.1] tracking-tight text-[#1D1D1F]">
                    {answer.answer}
                  </h2>
                </div>
                
                {typeof answer.confidence === 'number' && (
                  <div className="flex shrink-0 flex-col items-center p-6 rounded-[32px] bg-[#FBFBFD] ring-1 ring-[#F2F2F7]">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#86868B] mb-4">Grounded</span>
                    <div className="text-[32px] font-semibold tracking-tighter text-[#1D1D1F]">
                      {answer.confidence}<span className="text-[16px] text-[#86868B]">%</span>
                    </div>
                  </div>
                )}
              </div>

              {answer.why && (
                <div className="mt-12 flex gap-10">
                   <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#86868B] mb-6">Supporting Evidence</p>
                      <p className="text-[18px] leading-relaxed text-[#1D1D1F] font-medium italic">
                        &quot;{answer.why}&quot;
                      </p>
                   </div>
                </div>
              )}
            </div>

            {/* RAG Inspector - Studio Console Aesthetic */}
            <div className="bg-[#1D1D1F] text-white overflow-hidden">
               <button 
                  onClick={() => setShowInspector(!showInspector)}
                  className="w-full flex items-center justify-between p-8 border-t border-white/5 hover:bg-white/5 transition-colors"
               >
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                       <Database className={`h-5 w-5 ${showInspector ? 'text-emerald-400' : 'text-white'}`} />
                    </div>
                    <div>
                       <h4 className="text-[16px] font-bold text-white tracking-tight">RAG Context Inspector</h4>
                       <p className="text-[12px] text-white/40 font-medium tracking-tight">Inspect raw vector chunks injected into the prompt</p>
                    </div>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
                    {showInspector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
               </button>

               <AnimatePresence>
                 {showInspector && (
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: 'auto' }}
                     exit={{ height: 0 }}
                     className="overflow-hidden"
                   >
                     <div className="p-10 pt-0">
                        <div className="grid gap-4 lg:grid-cols-2">
                           {!evidenceChunks.length ? (
                              <div className="col-span-2 p-12 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                                 <p className="text-[14px] text-white/40 font-bold uppercase tracking-widest">No Context Chunks Utilized</p>
                              </div>
                           ) : (
                             evidenceChunks.map((evidence, idx) => (
                               <div key={idx} className="p-6 rounded-[24px] bg-white/[0.03] border border-white/10">
                                  <div className="flex items-center justify-between mb-4">
                                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0071E3]">Chunk_{idx + 1}</span>
                                     <Unlock className="h-3 w-3 text-white/20" />
                                  </div>
                                  {(evidence.sourceLabel || evidence.pageNumber || evidence.confidence) && (
                                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                                      {evidence.sourceLabel && <span>{evidence.sourceLabel}</span>}
                                      {typeof evidence.pageNumber === 'number' && <span>Page {evidence.pageNumber}</span>}
                                      {typeof evidence.confidence === 'number' && <span>{evidence.confidence}% confidence</span>}
                                    </div>
                                  )}
                                  <p className="text-[13px] font-mono leading-relaxed text-white/60">
                                    {evidence.text}
                                  </p>
                               </div>
                             ))
                           )}
                        </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </motion.section >
        )}
      </AnimatePresence>
      
      {!answer && (
        <section className="apple-card p-10 mt-12">
          <p className="eyebrow text-[#0071E3]">Current backend insights</p>
          <h2 className="mt-3 font-display text-[40px] leading-none tracking-[-0.05em] text-[#1D1D1F]">
            Signals already available
          </h2>
          <div className="mt-6 space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={`${insight.title}-${index}`}
                className="rounded-[32px] border border-[#F2F2F7] bg-[#FBFBFD] p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[17px] font-bold text-[#1D1D1F]">{insight.title}</h3>
                  <span className="rounded-full border border-[#E8E8ED] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#86868B]">
                    {insight.priority}
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed font-medium text-[#86868B]">{insight.explanation}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
