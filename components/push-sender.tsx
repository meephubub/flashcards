"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Bell, Send, Loader2 } from "lucide-react"

export default function PushSender() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("/")
  const [isSending, setIsSending] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !body) {
      toast.error("Please fill in both title and body")
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Notification sent! (${data.sentCount} delivered, ${data.removedCount} removed)`)
        setTitle("")
        setBody("")
      } else {
        toast.error(data.error || "Failed to send notification")
      }
    } catch (error) {
      console.error("Error sending notification:", error)
      toast.error("An error occurred while sending notification")
    } finally {
      setIsSending(false)
    }
  }

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        toast.success("Notification permission granted!")
        // PwaInit will handle the subscription logic on the next load or if we trigger it
        window.location.reload()
      } else {
        toast.error("Notification permission denied")
      }
    } catch (error) {
      console.error("Error requesting permission:", error)
      toast.error("Failed to request permission")
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Web Push
        </h2>
        <Button variant="outline" size="sm" onClick={requestPermission}>
          Test Permission
        </Button>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            placeholder="Notification Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSending}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Body</label>
          <Textarea
            placeholder="Notification Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            disabled={isSending}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Click URL (optional)</label>
          <Input
            placeholder="/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isSending}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Notification
            </>
          )}
        </Button>
      </form>

      <div className="bg-muted p-4 rounded-lg text-xs text-muted-foreground">
        <p><strong>Note:</strong> Push notifications will only be delivered to devices that have:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Installed the app as a PWA</li>
          <li>Granted notification permission</li>
          <li>A working internet connection</li>
        </ul>
      </div>
    </div>
  )
}
