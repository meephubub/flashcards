"use client"

import { useEffect } from "react"

export default function PwaInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      // Register service worker after window load to avoid blocking
      const onLoad = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      }
      if (document.readyState === 'complete') onLoad()
      else window.addEventListener('load', onLoad, { once: true })
    }
  }, [])
  return null
}
