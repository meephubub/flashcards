"use client"

import { useEffect, useState } from "react"

export default function PwaInit() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      console.log('PWA is already installed');
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

    // Register service worker
    if ('serviceWorker' in navigator) {
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered successfully:', registration);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
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
          background: 'red', 
          color: 'white', 
          padding: '10px',
          zIndex: 9999,
          fontSize: '12px'
        }}>
          PWA: {isInstallable ? 'Installable' : 'Not Ready'}
          {isInstallable && (
            <button onClick={handleInstall} style={{ marginLeft: '10px' }}>
              Install Now
            </button>
          )}
        </div>
      )}
    </>
  );
}