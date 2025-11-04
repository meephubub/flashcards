"use client"

import { useEffect, useState } from "react"

export default function PwaInit() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      console.log('PWA is already installed');
      setShowIosHint(false);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
      console.log('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS: no beforeinstallprompt; show manual A2HS hint
    const ua = window.navigator.userAgent;
    const isIOS = /iP(hone|od|ad)/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && !isStandalone) {
      setShowIosHint(true);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(registration => {
            console.log('Service Worker registered successfully:', registration)
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error)
          })
      }
      if (document.readyState === 'complete') onLoad()
      else window.addEventListener('load', onLoad, { once: true })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [])

  // Debug button (remove in production)
  const handleInstall = async () => {
    if (!installPrompt) return;
    
    const result = await installPrompt.prompt();
    console.log('Install prompt result:', result);
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  return (
    <>
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          background: 'black', 
          color: 'white', 
          padding: '10px',
          zIndex: 9999,
          fontSize: '12px'
        }}>
          PWA: {isInstallable ? 'Installable' : 'Not Ready'}
          {isInstallable && (
            <button onClick={handleInstall} style={{ marginLeft: '10px' }}>
              Install Now (only visible in dev mode)
            </button>
          )}
        </div>
      )}

      {/* iOS install hint (no beforeinstallprompt on iOS) */}
      {showIosHint && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 9998,
          background: 'rgba(255,255,255,0.96)',
          color: '#111',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: 12,
          padding: '12px 14px',
          boxShadow: '0 6px 24px rgba(0,0,0,.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
            <div style={{ fontSize: 14, lineHeight: 1.35 }}>
              <strong>Add to Home Screen</strong>
              <div style={{ opacity: 0.9, marginTop: 4 }}>
                Open the Share menu
                {' '}(<span aria-hidden>□↑</span>) and choose
                {' '}<strong>Add to Home Screen</strong> to install the app.
              </div>
            </div>
            <button
              aria-label="Dismiss install hint"
              onClick={() => setShowIosHint(false)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}
            >×</button>
          </div>
        </div>
      )}
    </>
  );
}