"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSupport = () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window
      setIsSupported(supported)
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission)
      }
    }

    checkSupport()

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setSubscription(sub)
          setLoading(false)
        })
      })
    } else {
      setLoading(false)
    }
  }, [])

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const subscribe = useCallback(async () => {
    if (!isSupported) return null

    try {
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        console.error("VAPID public key not found")
        return null
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      })

      setSubscription(sub)
      setPermission(Notification.permission)

      // Send to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      })

      return sub
    } catch (error) {
      console.error("Failed to subscribe:", error)
      return null
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return

    try {
      await subscription.unsubscribe()
      setSubscription(null)
      
      // Optionally notify server to remove subscription
      // await fetch("/api/push/unsubscribe", { ... })
    } catch (error) {
      console.error("Failed to unsubscribe:", error)
    }
  }, [subscription])

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied"

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === "granted") {
        await subscribe()
      }
      return result
    } catch (error) {
      console.error("Error requesting permission:", error)
      return "denied"
    }
  }, [subscribe])

  return {
    permission,
    isSupported,
    subscription,
    loading,
    subscribe,
    unsubscribe,
    requestPermission,
  }
}
