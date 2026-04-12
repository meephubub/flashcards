// Push notification data operations and service worker management
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error?: Error }> {
  try {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: new Error('Service workers not supported') }
    }

    if (!('PushManager' in window)) {
      return { success: false, error: new Error('Push notifications not supported') }
    }

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: new Error('Notification permission denied') }
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready

    // Subscribe to push
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    const applicationServerKey = vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource | null | undefined
    })

    // Extract subscription data
    const subscriptionJson = subscription.toJSON()
    const keys = subscriptionJson.keys as { p256dh: string; auth: string }

    // Save to database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionJson.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      }, {
        onConflict: 'user_id,endpoint'
      })

    if (error) {
      console.error('Error saving push subscription:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('Error subscribing to push:', error)
    return { success: false, error: error as Error }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    // Get current subscription
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Unsubscribe from push manager
      await subscription.unsubscribe()
    }

    // Remove from database
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing push subscription:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error unsubscribing from push:', error)
    return false
  }
}

/**
 * Check if push notifications are enabled
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  const permission = Notification.permission
  if (permission !== 'granted') {
    return false
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  return !!subscription
}

/**
 * Get all push subscriptions for a user
 */
export async function getPushSubscriptions(
  supabase: SupabaseClient,
  userId: string
): Promise<PushSubscriptionData[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error || !data) {
    return []
  }

  return data as PushSubscriptionData[]
}

/**
 * Send a push notification (server-side use)
 * This would typically be called from an Edge Function or API route
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  title: string,
  body: string,
  url: string = '/'
): Promise<boolean> {
  try {
    // This is a client-side helper - actual sending happens server-side
    // For now, we'll use the service worker to show local notifications
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready

      // Show local notification
      await registration.showNotification(title, {
        body,
        icon: '/IMG_2251.png',
        badge: '/favicon.png',
        data: { url }
      })

      return true
    }

    return false
  } catch (error) {
    console.error('Error sending push notification:', error)
    return false
  }
}

/**
 * Show a local notification (immediate, no server needed)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  url: string = '/'
): Promise<boolean> {
  try {
    // Check permission
    if (Notification.permission !== 'granted') {
      return false
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        body,
        icon: '/IMG_2251.png',
        badge: '/favicon.png',
        data: { url }
      })
      return true
    }

    // Fallback to standard notification API
    new Notification(title, {
      body,
      icon: '/IMG_2251.png'
    })

    return true
  } catch (error) {
    console.error('Error showing notification:', error)
    return false
  }
}

/**
 * Schedule a notification for a specific time
 * Uses the browser's setTimeout - note: won't persist across page reloads
 * For persistent scheduling, use the database + edge function approach
 */
export function scheduleLocalNotification(
  title: string,
  body: string,
  scheduledTime: Date,
  url: string = '/'
): () => void {
  const now = new Date().getTime()
  const scheduled = scheduledTime.getTime()
  const delay = scheduled - now

  if (delay <= 0) {
    // Already past the scheduled time, show immediately
    showLocalNotification(title, body, url)
    return () => {}
  }

  const timeoutId = setTimeout(() => {
    showLocalNotification(title, body, url)
  }, delay)

  // Return cleanup function
  return () => clearTimeout(timeoutId)
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
