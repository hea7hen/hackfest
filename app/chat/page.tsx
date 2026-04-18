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
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-[#1E2A3A] border border-white/[0.08] text-[#F0F4FF] rounded-bl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.tool_used && TOOL_LABELS[msg.tool_used] && (
                <div className="flex items-center gap-1 mt-2 opacity-60">
                  {TOOL_LABELS[msg.tool_used].icon}
                  <span className="text-xs">via {TOOL_LABELS[msg.tool_used].label}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1E2A3A] border border-white/[0.08] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <Loader2 size={14} className="animate-spin text-[#8899AA]" />
                <span className="text-xs text-[#8899AA]">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q}
            type="button"
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full border border-white/[0.12] text-[#CBD5E1] hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
          placeholder="Ask about your finances, GST, TDS..."
          className="flex-1 rounded-xl border border-white/[0.12] bg-[#131929] text-[#F0F4FF] placeholder:text-[#8899AA] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-4 py-3 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
