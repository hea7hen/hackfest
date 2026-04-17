'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface TopBarProps {
  modelLoading?: boolean;
  modelProgress?: number;
}

export default function TopBar({ modelLoading, modelProgress }: TopBarProps) {
  const router = useRouter();

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center justify-between px-6"
      style={{
        background: 'rgba(10,15,30,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: '#F0F4FF' }}>
          2ASK
        </h1>
        <p className="text-xs" style={{ color: '#8899AA' }}>
          AI Personal Finance Agent
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => router.push('/dashboard')}
          style={{
            background: 'rgba(59,130,246,0.1)',
            borderColor: 'rgba(59,130,246,0.3)',
            color: '#3B82F6',
          }}
        >
          <Mail size={14} />
          Open Gmail JSON
        </Button>
      </div>

      {modelLoading && (
        <div
          className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
          style={{
            width: `${modelProgress || 0}%`,
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
          }}
        />
      )}
    </header>
  );
}
