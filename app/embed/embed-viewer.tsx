// app/embed/embed-viewer.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function EmbedViewer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [url, setUrl] = useState('');
    const [proxy, setProxy] = useState(false); // Default OFF since proxy causes issues
    const [spoof, setSpoof] = useState(true);
    const [hideCursor, setHideCursor] = useState(true);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [clickProtection, setClickProtection] = useState(true);
    const [error, setError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Load from URL params on first visit
    useEffect(() => {
        const u = searchParams.get('url') || searchParams.get('u') || '';
        if (u) {
            setUrl(u);
            setTimeout(() => setControlsVisible(false), 2000);
        }
        setProxy(searchParams.get('proxy') === '1');
        setSpoof(searchParams.get('spoof') !== '0');
        setHideCursor(searchParams.get('cursor') !== '0');
    }, [searchParams]);

    // Update URL whenever settings change
    useEffect(() => {
        if (!url) return;
        const params = new URLSearchParams();
        params.set('url', url);
        if (proxy) params.set('proxy', '1');
        if (!spoof) params.set('spoof', '0');
        if (!hideCursor) params.set('cursor', '0');
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [url, proxy, spoof, hideCursor, router]);

    // Hide cursor functionality
    useEffect(() => {
        if (!hideCursor || controlsVisible) {
            document.body.style.cursor = 'default';
            return;
        }

        let timer: NodeJS.Timeout;
        const hide = () => { document.body.style.cursor = 'none'; };
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
    }, [hideCursor, controlsVisible]);

    // Fullscreen state tracking
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            containerRef.current?.requestFullscreen?.().catch(() => {
                document.documentElement.requestFullscreen?.().catch(() => { });
            });
        }
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'f' || e.key === 'F') toggleFullscreen();
            if (e.key === 'h' || e.key === 'H') setControlsVisible(v => !v);
            if (e.key === 'p' || e.key === 'P') setClickProtection(v => !v);
            if (e.key === 'Escape' && !controlsVisible) setControlsVisible(true);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggleFullscreen, controlsVisible]);

    const finalSrc = proxy && url
        ? `/api/embedproxy?url=${encodeURIComponent(url)}${spoof ? '&spoof=1' : ''}`
        : url;

    const handleIframeError = () => {
        setError('Failed to load stream. Try toggling proxy mode or checking the URL.');
    };

    // Disable click protection temporarily for interaction
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Briefly disable protection to allow center click through
        setClickProtection(false);
        setTimeout(() => setClickProtection(true), 500);
    }, []);

    return (
        <main
            ref={containerRef}
            className="min-h-screen bg-black text-white flex flex-col"
            style={{ height: '100vh', overflow: 'hidden' }}
        >
            {/* Toggle button to show/hide controls */}
            {!controlsVisible && url && (
                <button
                    onClick={() => setControlsVisible(true)}
                    className="absolute top-4 right-4 z-50 px-4 py-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition-all backdrop-blur-sm border border-zinc-700/50"
                >
                    Show Controls (H)
                </button>
            )}

            {/* Top control bar */}
            {controlsVisible && (
                <div className="p-4 md:p-6 space-y-4 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm z-40">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                setError('');
                            }}
                            placeholder="Paste embed URL (e.g., https://embedsports.top/embed/...)"
                            className="flex-1 px-5 py-4 text-base bg-zinc-900 border border-zinc-700 rounded-xl focus:outline-none focus:border-zinc-400 transition placeholder:text-zinc-600"
                            autoFocus
                        />
                        <button
                            onClick={toggleFullscreen}
                            className="px-5 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition text-zinc-300 hover:text-white whitespace-nowrap"
                        >
                            {isFullscreen ? 'Exit FS' : 'Fullscreen'}
                        </button>
                        {url && (
                            <button
                                onClick={() => setControlsVisible(false)}
                                className="px-5 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition text-zinc-300 hover:text-white"
                            >
                                Hide
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Toggles */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Toggle label="Proxy mode" checked={proxy} onChange={setProxy} />
                        <Toggle label="Spoof headers" checked={spoof} onChange={setSpoof} />
                        <Toggle label="Hide cursor" checked={hideCursor} onChange={setHideCursor} />
                        <Toggle label="Block clicks (P)" checked={clickProtection} onChange={setClickProtection} />
                    </div>

                    {/* Help text */}
                    <div className="text-xs text-zinc-600 space-y-1">
                        <p>
                            Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">F</kbd> fullscreen,
                            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 ml-2">H</kbd> hide controls,
                            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 ml-2">P</kbd> toggle click protection
                        </p>
                        <p className="text-zinc-500">
                            💡 If video is blank with Proxy ON, try turning it OFF. Click protection blocks redirect ads.
                        </p>
                    </div>
                </div>
            )}

            {/* Player */}
            {finalSrc ? (
                <div className="flex-1 relative" style={{ minHeight: 0 }}>
                    <iframe
                        ref={iframeRef}
                        src={finalSrc}
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
                        referrerPolicy="no-referrer"
                        onError={handleIframeError}
                    />

                    {/* Click protection overlay - blocks ad redirects */}
                    {clickProtection && (
                        <div
                            className="absolute inset-0 z-10"
                            onClick={handleOverlayClick}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Transparent center area for clicking play button */}
                            <div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
                                style={{ pointerEvents: 'none' }}
                            />
                            {/* Status indicator */}
                            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-green-900/80 text-green-300 text-xs rounded-full">
                                🛡️ Click protection ON (click to interact, press P to toggle)
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4 px-6">
                        <p className="text-zinc-500 text-xl">Paste an embed URL to begin</p>
                        <p className="text-zinc-700 text-sm">Example: https://embedsports.top/embed/admin/ppv-event/1</p>
                        <div className="pt-4 text-zinc-600 text-sm max-w-md mx-auto">
                            <p className="font-medium mb-2">AirPlay Tips:</p>
                            <ul className="text-left space-y-1 text-xs">
                                <li>• Turn OFF proxy mode for most embed sites</li>
                                <li>• Enable click protection to block redirect ads</li>
                                <li>• Use fullscreen mode for best TV viewing</li>
                                <li>• Press H to hide controls for cleaner display</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div className="relative">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                />
                <div className={`w-12 h-7 rounded-full transition ${checked ? 'bg-white' : 'bg-zinc-700'}`}>
                    <div className={`w-5 h-5 bg-black rounded-full transition-transform translate-x-1 translate-y-1 ${checked ? 'translate-x-6' : ''}`} />
                </div>
            </div>
            <span className="text-zinc-400 group-hover:text-zinc-200 transition text-sm">{label}</span>
        </label>
    );
}
