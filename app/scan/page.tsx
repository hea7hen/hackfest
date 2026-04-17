'use client';

export default function ScanPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#F0F4FF' }}>Scan Document</h2>
        <p className="text-sm" style={{ color: '#8899AA' }}>Phase 2 — Camera, Upload, and Gmail sync coming next</p>
      </div>
    </div>
  );
}
