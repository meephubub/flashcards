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
          .then(async (registration) => {
            console.log('Service Worker registered successfully:', registration)
            
            // Check for existing subscription
            const existingSub = await registration.pushManager.getSubscription()
            if (existingSub) {
              console.log('Existing push subscription found')
              return
            }

            // Auto-subscribe if standalone (PWA) and permission granted
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            if (isStandalone && Notification.permission === 'granted') {
              subscribeUser(registration)
            }
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

  const subscribeUser = async (registration: ServiceWorkerRegistration) => {
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.error('VAPID public key not found in env')
        return
      }

      // Convert VAPID key to Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      })

      console.log('User subscribed:', subscription)

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      })
    } catch (error) {
      console.error('Failed to subscribe user:', error)
    }
  }

  // Helper to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

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