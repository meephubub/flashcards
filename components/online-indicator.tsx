"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { syncAllMetadata } from "@/lib/sync"

export default function OnlineIndicator() {
  const { user } = useAuth()
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const updateFromNavigator = () => setOnline(navigator.onLine)
    const probe = async () => {
      try {
        // Probe a local asset to avoid CORS/ DNS issues; treat 200 as online
        const resp = await fetch('/manifest.json', { cache: 'no-store' })
        if (!cancelled) setOnline(resp.ok)
      } catch {
        if (!cancelled) setOnline(false)
      }
    }
    const onOnline = () => { updateFromNavigator(); void probe() }
    const onVisibility = () => { if (document.visibilityState === 'visible') void probe() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', updateFromNavigator)
    document.addEventListener('visibilitychange', onVisibility)
    void probe()
    const id = window.setInterval(probe, 15000)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', updateFromNavigator)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id) return
      if (!online) return
      try {
        setSyncing(true)
        await syncAllMetadata(user.id)
        const e = new Event('app-sync')
        window.dispatchEvent(e)
      } finally {
        if (mounted) setSyncing(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [user?.id, online])

  if (online) return null

  return (
    <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 9999 }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        background: 'rgba(107,114,128,.15)',
        color: 'rgb(107,114,128)',
        border: '1px solid rgba(107,114,128,.35)',
        backdropFilter: 'saturate(120%) blur(4px)'
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: 'rgb(107,114,128)'
        }} />
        <span>Offline mode</span>
      </div>
    </div>
  )
}

