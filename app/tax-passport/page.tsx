'use client';

export default function TaxPassportPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#F0F4FF' }}>Tax Passport</h2>
        <p className="text-sm" style={{ color: '#8899AA' }}>Phase 4 — Full tax audit trail coming soon</p>
      </div>
    </div>
  );
}
