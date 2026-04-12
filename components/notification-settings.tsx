"use client"

import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react"

export function NotificationSettings() {
  const { permission, isSupported, subscription, loading, subscribe, unsubscribe, requestPermission } = usePushNotifications()

  if (!isSupported) {
    return (
      <Card className="border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BellOff className="w-4 h-4 text-neutral-500" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-neutral-500">
            Push notifications are not supported in this browser.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-neutral-200 dark:border-neutral-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="w-4 h-4 text-neutral-500" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading...
          </div>
        ) : subscription ? (
          <>
            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <BellRing className="w-3 h-3 text-neutral-500" />
              Push notifications enabled
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={unsubscribe}
            >
              Disable Notifications
            </Button>
          </>
        ) : permission === "denied" ? (
          <p className="text-xs text-neutral-500">
            Notification permission was denied. Please enable it in your browser settings.
          </p>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Get notified when you have exam sessions due.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={requestPermission}
            >
              Enable Notifications
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
