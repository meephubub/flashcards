// app/embed/page.tsx
import { Suspense } from 'react';
import EmbedViewer from './embed-viewer';

export const dynamic = 'force-dynamic';

// Loading fallback for SSR
function EmbedLoading() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="animate-pulse text-zinc-500 text-xl">Loading embed viewer...</div>
    </main>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<EmbedLoading />}>
      <EmbedViewer />
    </Suspense>
  );
}