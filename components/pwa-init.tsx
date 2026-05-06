"use client"

import { useEffect, useState } from "react"
import { usePushNotifications } from "@/hooks/use-push-notifications"

export default function PwaInit() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const { permission, subscribe } = usePushNotifications()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      console.log('PWA is already installed');
      setShowIosHint(false);
    } else {
      // iOS: no beforeinstallprompt; show manual A2HS hint
      const ua = window.navigator.userAgent;
      const isIOS = /iP(hone|od|ad)/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        setShowIosHint(true);
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
      console.log('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register service worker
    // Avoid "The operation is insecure" on http/file origins.
    const isSecure =
      window.isSecureContext ||
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isSecure && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Auto-subscribe if standalone (PWA) and permission granted — silently (no toast)
    if (isStandalone && Notification.permission === 'granted') {
      subscribe(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [subscribe])

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
      {/* Debug info - remove in production -- REMOVED AS REQUESTED */}
      {/* {process.env.NODE_ENV === 'development' && ( ... )} */}

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