// app/embed/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [url, setUrl] = useState('');
  const [proxy, setProxy] = useState(true);
  const [spoof, setSpoof] = useState(true);
  const [hideCursor, setHideCursor] = useState(true);
  const [error, setError] = useState('');

  // Load from URL params on first visit
  useEffect(() => {
    const u = searchParams.get('url') || searchParams.get('u') || '';
    if (u) setUrl(decodeURIComponent(u));
    setProxy(searchParams.get('proxy') !== '0');
    setSpoof(searchParams.get('spoof') !== '0'); // Fixed syntax error
    setHideCursor(searchParams.get('cursor') !== '0');
  }, [searchParams]);

  // Update URL whenever settings change (so you can bookmark/share)
  useEffect(() => {
    if (!url) return;
    const params = new URLSearchParams();
    params.set('url', encodeURIComponent(url));
    if (proxy) params.set('proxy', '1');
    if (spoof) params.set('spoof', '1');
    if (hideCursor) params.set('cursor', '1');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [url, proxy, spoof, hideCursor, router]);

  // Hide cursor functionality
  useEffect(() => {
    if (!hideCursor) return;

    let timer: NodeJS.Timeout;
    const hide = () => document.body.style.cursor = 'none';
    const show = () => {
      document.body.style.cursor = 'default';
      clearTimeout(timer);
      timer = setTimeout(hide, 3000);
    };

    document.addEventListener('mousemove', show);
    document.addEventListener('touchstart', show);
    hide();

    return () => {
      document.removeEventListener('mousemove', show);
      document.removeEventListener('touchstart', show);
      document.body.style.cursor = 'default';
      clearTimeout(timer);
    };
  }, [hideCursor]);

  // Auto fullscreen for TV
  useEffect(() => {
    if (!url) return;
    const timer = setTimeout(() => {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Fullscreen blocked, that's ok
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [url]);

  const finalSrc = proxy && url ? `/api/embedproxy?url=${encodeURIComponent(url)}${spoof ? '&spoof=1' : ''}` : url;

  const handleIframeError = () => {
    setError('Failed to load stream. Try toggling proxy mode or checking the URL.');
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* Top control bar */}
      <div className="p-6 space-y-6 border-b border-zinc-800">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          placeholder="Paste embed URL (e.g., https://playembed.top/embed/...)"
          className="w-full px-6 py-5 text-lg bg-zinc-950 border border-zinc-700 rounded-xl focus:outline-none focus:border-zinc-400 transition"
          autoFocus
        />

        {error && (
          <div className="px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Toggle label="Proxy mode (cast-proof)" checked={proxy} onChange={setProxy} />
          <Toggle label="Aggressive spoofing" checked={spoof} onChange={setSpoof} />
          <Toggle label="Hide mouse cursor" checked={hideCursor} onChange={setHideCursor} />
        </div>
      </div>

      {/* Player */}
      {finalSrc ? (
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={finalSrc}
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
            onError={handleIframeError}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-zinc-600 text-xl">Paste an embed URL to begin</p>
            <p className="text-zinc-700 text-sm">Example: https://playembed.top/embed/ucl/2025-12-10/lev-new</p>
          </div>
        </div>
      )}
    </main>
  );
}

// Reusable toggle component
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-4 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-14 h-8 rounded-full transition ${checked ? 'bg-white' : 'bg-zinc-700'}`}>
          <div className={`w-6 h-6 bg-black rounded-full transition-transform translate-x-1 translate-y-1 ${checked ? 'translate-x-7' : ''}`} />
        </div>
      </div>
      <span className="text-zinc-300">{label}</span>
    </label>
  );
}