'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface CashFlowData {
  monthYear: string;
  income: number;
  expenses: number;
}

interface Props {
  data: CashFlowData[];
}

function formatMonth(monthYear: string) {
  const [year, month] = monthYear.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} '${year.slice(2)}`;
}

function formatCurrency(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl px-5 py-4 min-w-[180px] shadow-xl shadow-slate-200/50">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400">{label}</p>
      <div className="space-y-3">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: item.dataKey === 'income' ? '#2563EB' : '#F43F5E' }}
              />
              <span className="text-xs font-semibold text-slate-600">
                {item.dataKey === 'income' ? 'Income' : 'Expenses'}
              </span>
            </div>
            <span className="font-financial text-xs font-bold text-slate-900">
              {'\u20B9'}{item.value.toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CashFlowChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    name: formatMonth(d.monthYear),
  }));

  return (
    <div className="bento-card h-[400px]">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
            Cash Projection
          </h3>
          <p className="text-2xl font-black tracking-tight text-slate-900">Market Flow</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expenses</span>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              dy={15}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }} 
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#2563EB"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorIncome)"
              animationBegin={500}
              animationDuration={2000}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#F43F5E"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorExpenses)"
              animationBegin={800}
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
