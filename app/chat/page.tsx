'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Send, Loader2, Database, BookOpen, BarChart3 } from 'lucide-react';
import { askAgent, type Transaction } from '@/lib/backend';
import { db } from '@/lib/db/schema';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_used?: string;
  timestamp: Date;
}

const TOOL_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  tax_lookup:  { label: 'GST Knowledge Base', icon: <BookOpen size={12} /> },
  doc_search:  { label: 'Your Documents',     icon: <Database size={12} /> },
  db_query:    { label: 'Your Transactions',  icon: <BarChart3 size={12} /> },
  multi:       { label: 'Multiple Sources',   icon: <Database size={12} /> },
  multi_tool:  { label: 'Multiple Sources',   icon: <Database size={12} /> },
};

const QUICK_QUESTIONS = [
  "What's my total spending this month?",
  "How much GST did I pay?",
  "What are my tax deductibles?",
  "What is the TDS rate for professional services?",
  "Is AWS eligible for ITC?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I\'m 2ASK, your AI finance agent. I can answer questions about your transactions, GST rates, TDS rules, and tax deductions. What would you like to know?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function getTransactions(): Promise<Transaction[]> {
    try {
      const monthYear = new Date().toISOString().slice(0, 7);
      const txns = await db.transactions
        .where('monthYear').equals(monthYear)
        .toArray();
      return txns.map(t => ({
        id:          t.id,
        vendor:      t.vendor ?? '',
        amount:      t.amount,
        gst_amount:  t.taxAmount ?? 0,
        date:        t.date,
        category:    t.category,
        vendor_type: t.category,
        description: t.description ?? '',
      }));
    } catch {
      return [];
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const transactions = await getTransactions();
      const { answer, tool_used } = await askAgent(text, transactions);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        tool_used,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Backend not reachable. Make sure uvicorn is running on port 8000.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-4xl mx-auto px-4">
      <div className="flex-1 overflow-y-auto space-y-6 pb-6 no-scrollbar">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[2rem] px-6 py-4 shadow-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.tool_used && TOOL_LABELS[msg.tool_used] && (
                <div className={`flex items-center gap-2 mt-3 p-2 rounded-xl border ${
                  msg.role === 'user' 
                    ? 'bg-blue-700/30 border-blue-500/30 text-blue-100' 
                    : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                  {TOOL_LABELS[msg.tool_used].icon}
                  <span className="text-[10px] font-black uppercase tracking-widest">Context: {TOOL_LABELS[msg.tool_used].label}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-[2rem] rounded-tl-none px-6 py-4 shadow-sm">
              <div className="flex gap-2 items-center">
                <Loader2 size={14} className="animate-spin text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing Intent...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-transparent pt-4 pb-2 space-y-4">
        <div className="flex gap-2 flex-wrap justify-center">
          {QUICK_QUESTIONS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="text-[11px] font-bold px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:shadow-md transition-all disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-3 bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask about your finances, GST, or Tax rules..."
            className="flex-1 rounded-[1.8rem] bg-transparent text-slate-900 placeholder:text-slate-400 px-6 py-3 text-sm focus:outline-none"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full w-12 h-12 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-200"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
