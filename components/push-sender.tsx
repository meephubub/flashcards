"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Bell, Send, Loader2, Search, X, Users, Clock,
  CheckCircle2, XCircle, CalendarClock, Smartphone, Trash2
} from "lucide-react"

interface PushUser {
  id: string
  email: string
  deviceCount: number
  lastSignIn: string | null
}

interface ScheduledNotification {
  id: string
  title: string
  body: string | null
  url: string
  target_user_ids: string[] | null
  scheduled_at: string
  status: string
  result: any
  created_at: string
  sent_at: string | null
}

export default function PushSender() {
  // Send Now state
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("/")
  const [isSending, setIsSending] = useState(false)
  const [sendToAll, setSendToAll] = useState(true)

  // User search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PushUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<PushUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Schedule state
  const [schedTitle, setSchedTitle] = useState("")
  const [schedBody, setSchedBody] = useState("")
  const [schedUrl, setSchedUrl] = useState("/")
  const [schedDate, setSchedDate] = useState("")
  const [schedTime, setSchedTime] = useState("")
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([])
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(true)
  const [schedSendToAll, setSchedSendToAll] = useState(true)
  const [schedSelectedUsers, setSchedSelectedUsers] = useState<PushUser[]>([])
  const [schedSearchQuery, setSchedSearchQuery] = useState("")
  const [schedSearchResults, setSchedSearchResults] = useState<PushUser[]>([])
  const [isSchedSearching, setIsSchedSearching] = useState(false)
  const [showSchedResults, setShowSchedResults] = useState(false)
  const schedSearchRef = useRef<HTMLDivElement>(null)
  const schedDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch users with debounce
  const fetchUsers = useCallback(async (query: string, setResults: (u: PushUser[]) => void, setLoading: (b: boolean) => void) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/push/users?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok) {
        setResults(data.users || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Search handler for Send Now
  useEffect(() => {
    if (sendToAll) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchUsers(searchQuery, setSearchResults, setIsSearching)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, sendToAll, fetchUsers])

  // Search handler for Schedule
  useEffect(() => {
    if (schedSendToAll) return
    if (schedDebounceRef.current) clearTimeout(schedDebounceRef.current)
    schedDebounceRef.current = setTimeout(() => {
      fetchUsers(schedSearchQuery, setSchedSearchResults, setIsSchedSearching)
    }, 300)
    return () => { if (schedDebounceRef.current) clearTimeout(schedDebounceRef.current) }
  }, [schedSearchQuery, schedSendToAll, fetchUsers])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
      if (schedSearchRef.current && !schedSearchRef.current.contains(e.target as Node)) setShowSchedResults(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Fetch scheduled notifications
  const fetchScheduled = useCallback(async () => {
    try {
      const res = await fetch("/api/push/schedule")
      const data = await res.json()
      if (res.ok) setScheduled(data.notifications || [])
    } catch { /* silently fail */ }
    finally { setIsLoadingScheduled(false) }
  }, [])

  useEffect(() => { fetchScheduled() }, [fetchScheduled])

  // Send Now handler
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) { toast.error("Title is required"); return }
    if (!sendToAll && selectedUsers.length === 0) { toast.error("Select at least one user"); return }

    setIsSending(true)
    try {
      const payload: any = { title, body, url }
      if (!sendToAll) payload.targetUserIds = selectedUsers.map(u => u.id)

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Sent to ${data.sentCount} device${data.sentCount !== 1 ? 's' : ''}`)
        setTitle(""); setBody("")
      } else {
        toast.error(data.error || "Failed to send")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsSending(false)
    }
  }

  // Schedule handler
  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedTitle) { toast.error("Title is required"); return }
    if (!schedDate || !schedTime) { toast.error("Date and time are required"); return }
    if (!schedSendToAll && schedSelectedUsers.length === 0) { toast.error("Select at least one user"); return }

    const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString()

    setIsScheduling(true)
    try {
      const payload: any = { title: schedTitle, body: schedBody, url: schedUrl, scheduledAt }
      if (!schedSendToAll) payload.targetUserIds = schedSelectedUsers.map(u => u.id)

      const res = await fetch("/api/push/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success("Notification scheduled")
        setSchedTitle(""); setSchedBody(""); setSchedDate(""); setSchedTime("")
        fetchScheduled()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to schedule")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsScheduling(false)
    }
  }

  // Cancel scheduled notification
  const handleCancel = async (id: string) => {
    try {
      const res = await fetch("/api/push/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        toast.success("Notification cancelled")
        fetchScheduled()
      } else {
        toast.error("Failed to cancel")
      }
    } catch {
      toast.error("An error occurred")
    }
  }

  // Toggle user selection
  const toggleUser = (
    user: PushUser,
    selected: PushUser[],
    setSelected: (u: PushUser[]) => void
  ) => {
    if (selected.find(u => u.id === user.id)) {
      setSelected(selected.filter(u => u.id !== user.id))
    } else {
      setSelected([...selected, user])
    }
  }

  // User search + select component
  const UserSelector = ({
    allMode,
    setAllMode,
    query,
    setQuery,
    results,
    isLoading,
    selected,
    setSelected,
    showDrop,
    setShowDrop,
    containerRef,
  }: {
    allMode: boolean
    setAllMode: (b: boolean) => void
    query: string
    setQuery: (s: string) => void
    results: PushUser[]
    isLoading: boolean
    selected: PushUser[]
    setSelected: (u: PushUser[]) => void
    showDrop: boolean
    setShowDrop: (b: boolean) => void
    containerRef: React.RefObject<HTMLDivElement | null>
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Recipients</label>
        <button
          type="button"
          onClick={() => { setAllMode(!allMode); setSelected([]) }}
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
            ${allMode
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
        >
          <Users className="w-3 h-3" />
          All Users
        </button>
      </div>

      {!allMode && (
        <>
          {/* Selected users */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(user => (
                <Badge
                  key={user.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 font-normal text-xs"
                >
                  {user.email}
                  <button
                    type="button"
                    onClick={() => setSelected(selected.filter(u => u.id !== user.id))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Search input */}
          <div ref={containerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowDrop(true) }}
                onFocus={() => setShowDrop(true)}
                className="pl-9 bg-background"
              />
            </div>

            {showDrop && !allMode && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm">Searching...</span>
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {results.map(user => {
                      const isSelected = selected.some(u => u.id === user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleUser(user, selected, setSelected)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2.5 text-left text-sm 
                            transition-colors hover:bg-accent
                            ${isSelected ? 'bg-accent/50' : ''}
                          `}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{user.email}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              {user.deviceCount} device{user.deviceCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  // Format scheduled time
  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'pending') return <Badge variant="outline" className="text-xs font-normal"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    if (status === 'sent') return <Badge variant="secondary" className="text-xs font-normal"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>
    if (status === 'failed') return <Badge variant="destructive" className="text-xs font-normal"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
    return <Badge variant="outline" className="text-xs font-normal">{status}</Badge>
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="send" className="gap-2">
            <Send className="w-4 h-4" />
            Send Now
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <CalendarClock className="w-4 h-4" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        {/* ─── Send Now ────────────────────────────────── */}
        <TabsContent value="send">
          <form onSubmit={handleSend} className="space-y-5">
            <UserSelector
              allMode={sendToAll}
              setAllMode={setSendToAll}
              query={searchQuery}
              setQuery={setSearchQuery}
              results={searchResults}
              isLoading={isSearching}
              selected={selectedUsers}
              setSelected={setSelectedUsers}
              showDrop={showResults}
              setShowDrop={setShowResults}
              containerRef={searchRef}
            />

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSending}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Body</label>
              <Textarea
                placeholder="Optional message body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                disabled={isSending}
                className="bg-background resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">URL</label>
              <Input
                placeholder="/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSending}
                className="bg-background"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSending}>
              {isSending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Notification</>
              )}
            </Button>
          </form>
        </TabsContent>

        {/* ─── Scheduled ───────────────────────────────── */}
        <TabsContent value="scheduled" className="space-y-6">
          {/* Schedule form */}
          <form onSubmit={handleSchedule} className="space-y-5">
            <UserSelector
              allMode={schedSendToAll}
              setAllMode={setSchedSendToAll}
              query={schedSearchQuery}
              setQuery={setSchedSearchQuery}
              results={schedSearchResults}
              isLoading={isSchedSearching}
              selected={schedSelectedUsers}
              setSelected={setSchedSelectedUsers}
              showDrop={showSchedResults}
              setShowDrop={setShowSchedResults}
              containerRef={schedSearchRef}
            />

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Notification title"
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                disabled={isScheduling}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Body</label>
              <Textarea
                placeholder="Optional message body"
                value={schedBody}
                onChange={(e) => setSchedBody(e.target.value)}
                rows={3}
                disabled={isScheduling}
                className="bg-background resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">URL</label>
              <Input
                placeholder="/"
                value={schedUrl}
                onChange={(e) => setSchedUrl(e.target.value)}
                disabled={isScheduling}
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  disabled={isScheduling}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  disabled={isScheduling}
                  required
                  className="bg-background"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isScheduling}>
              {isScheduling ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scheduling...</>
              ) : (
                <><CalendarClock className="mr-2 h-4 w-4" />Schedule Notification</>
              )}
            </Button>
          </form>

          <Separator />

          {/* Scheduled list */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Queue
            </h3>

            {isLoadingScheduled ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : scheduled.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No scheduled notifications
              </div>
            ) : (
              <div className="space-y-2">
                {scheduled.map(notif => (
                  <div
                    key={notif.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-background transition-colors hover:bg-accent/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{notif.title}</span>
                        <StatusBadge status={notif.status} />
                      </div>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground truncate mb-1">{notif.body}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(notif.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {notif.target_user_ids ? `${notif.target_user_ids.length} user${notif.target_user_ids.length !== 1 ? 's' : ''}` : 'All'}
                        </span>
                        {notif.result && notif.status === 'sent' && (
                          <span>{notif.result.sentCount} delivered</span>
                        )}
                      </div>
                    </div>
                    {notif.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(notif.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
