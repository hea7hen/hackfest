'use client';

export default function ChatPage() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#F0F4FF' }}>Ask 2ASK</h2>
        <p className="text-sm" style={{ color: '#8899AA' }}>Phase 3 — Voice chat in 11 Indian languages coming next</p>
      </div>
    </div>
  );
}
