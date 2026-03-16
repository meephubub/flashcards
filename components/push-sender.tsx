"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Bell, 
  Send, 
  Loader2, 
  Search, 
  Clock, 
  Users, 
  User,
  Check,
  X,
  Calendar,
  ChevronDown,
  Trash2,
  RefreshCw
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface UserWithPush {
  id: string
  email: string
  full_name: string | null
  has_push_subscription: boolean
  subscription_count: number
  last_sign_in_at: string | null
}

interface ScheduledNotification {
  id: string
  title: string
  body: string | null
  url: string
  user_ids: string[] | null
  scheduled_for: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  created_at: string
  user_emails?: string[]
}

export default function PushSender() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("/")
  const [isSending, setIsSending] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  
  // User selection
  const [users, setUsers] = useState<UserWithPush[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [sendToAll, setSendToAll] = useState(true)
  
  // Scheduling
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([])
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(true)
  
  // UI state
  const [usersExpanded, setUsersExpanded] = useState(false)

  // Fetch users with push subscriptions
  useEffect(() => {
    fetchUsers()
    fetchScheduledNotifications()
  }, [])

  const fetchUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const response = await fetch("/api/push/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to load users")
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const fetchScheduledNotifications = async () => {
    setIsLoadingScheduled(true)
    try {
      const response = await fetch("/api/push/scheduled")
      if (response.ok) {
        const data = await response.json()
        setScheduledNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error("Error fetching scheduled notifications:", error)
    } finally {
      setIsLoadingScheduled(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const query = searchQuery.toLowerCase()
    return users.filter(
      user => 
        user.email?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  const usersWithSubscription = useMemo(() => 
    filteredUsers.filter(u => u.has_push_subscription),
    [filteredUsers]
  )

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
    if (newSelected.size > 0) {
      setSendToAll(false)
    }
  }

  const selectAllWithSubscription = () => {
    const allWithSub = new Set(usersWithSubscription.map(u => u.id))
    setSelectedUsers(allWithSub)
    setSendToAll(false)
  }

  const clearSelection = () => {
    setSelectedUsers(new Set())
    setSendToAll(true)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast.error("Please fill in the title")
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          body, 
          url,
          userIds: sendToAll ? null : Array.from(selectedUsers)
        }),
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

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast.error("Please fill in the title")
      return
    }
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select a date and time")
      return
    }

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`)
    if (scheduledFor <= new Date()) {
      toast.error("Scheduled time must be in the future")
      return
    }

    setIsScheduling(true)
    try {
      const response = await fetch("/api/push/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          body, 
          url,
          scheduledFor: scheduledFor.toISOString(),
          userIds: sendToAll ? null : Array.from(selectedUsers)
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Notification scheduled for ${scheduledFor.toLocaleString()}`)
        setTitle("")
        setBody("")
        setScheduleDate("")
        setScheduleTime("")
        fetchScheduledNotifications()
      } else {
        toast.error(data.error || "Failed to schedule notification")
      }
    } catch (error) {
      console.error("Error scheduling notification:", error)
      toast.error("An error occurred while scheduling notification")
    } finally {
      setIsScheduling(false)
    }
  }

  const cancelScheduled = async (id: string) => {
    try {
      const response = await fetch(`/api/push/scheduled/${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        toast.success("Notification cancelled")
        fetchScheduledNotifications()
      } else {
        toast.error("Failed to cancel notification")
      }
    } catch (error) {
      console.error("Error cancelling notification:", error)
      toast.error("An error occurred")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Pending</Badge>
      case 'sent':
        return <Badge variant="outline" className="bg-foreground/10 text-foreground border-foreground/20">Sent</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border line-through">Cancelled</Badge>
      default:
        return null
    }
  }

  return (
    <div className="w-full">
      <Tabs defaultValue="send" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-muted/50">
          <TabsTrigger value="send" className="data-[state=active]:bg-background">
            <Send className="w-4 h-4 mr-2" />
            Send
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-background">
            <Clock className="w-4 h-4 mr-2" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-0">
          <div className="p-6 space-y-6">
            {/* User Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Recipients
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fetchUsers}
                    className="h-7 px-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <Checkbox 
                  id="send-all"
                  checked={sendToAll}
                  onCheckedChange={(checked) => {
                    setSendToAll(checked === true)
                    if (checked) setSelectedUsers(new Set())
                  }}
                />
                <label htmlFor="send-all" className="text-sm cursor-pointer flex-1">
                  Send to all subscribers
                </label>
                <span className="text-xs text-muted-foreground">
                  {usersWithSubscription.length} users
                </span>
              </div>

              <Collapsible open={usersExpanded} onOpenChange={setUsersExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-10 bg-background"
                    disabled={sendToAll}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {selectedUsers.size > 0 
                        ? `${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''} selected`
                        : 'Select specific users'
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${usersExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg bg-background">
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 bg-muted/30 border-0"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={selectAllWithSubscription}
                          className="h-7 text-xs"
                        >
                          Select all with subscription
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                          className="h-7 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-48">
                      {isLoadingUsers ? (
                        <div className="p-3 space-y-2">
                          {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                          No users found
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {filteredUsers.map(user => (
                            <div
                              key={user.id}
                              className={`flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors ${
                                selectedUsers.has(user.id) ? 'bg-muted/50' : ''
                              }`}
                              onClick={() => toggleUser(user.id)}
                            >
                              <Checkbox 
                                checked={selectedUsers.has(user.id)}
                                onCheckedChange={() => toggleUser(user.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {user.full_name || user.email}
                                </p>
                                {user.full_name && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {user.email}
                                  </p>
                                )}
                              </div>
                              {user.has_push_subscription ? (
                                <Badge variant="outline" className="bg-foreground/5 text-foreground text-xs shrink-0">
                                  <Bell className="w-3 h-3 mr-1" />
                                  {user.subscription_count}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground shrink-0">No subscription</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Notification Form */}
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSending || isScheduling}
                  required
                  className="bg-muted/30 border-border/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Body <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  placeholder="Notification body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  disabled={isSending || isScheduling}
                  className="bg-muted/30 border-border/50 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Click URL <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input
                  placeholder="/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isSending || isScheduling}
                  className="bg-muted/30 border-border/50"
                />
              </div>

              {/* Schedule Options */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Schedule for later</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    disabled={isSending || isScheduling}
                    className="bg-muted/30 border-border/50"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={isSending || isScheduling}
                    className="bg-muted/30 border-border/50"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-foreground text-background hover:bg-foreground/90" 
                  disabled={isSending || isScheduling}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Now
                    </>
                  )}
                </Button>
                {(scheduleDate && scheduleTime) && (
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSending || isScheduling}
                    onClick={handleSchedule}
                  >
                    {isScheduling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Clock className="mr-2 h-4 w-4" />
                        Schedule
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Scheduled Notifications</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchScheduledNotifications}
                className="h-7 px-2"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {isLoadingScheduled ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : scheduledNotifications.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No scheduled notifications</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {scheduledNotifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className="p-4 border border-border/50 rounded-lg bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">{notification.title}</p>
                            {getStatusBadge(notification.status)}
                          </div>
                          {notification.body && (
                            <p className="text-xs text-muted-foreground truncate mb-2">{notification.body}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(notification.scheduled_for).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {notification.user_ids && notification.user_ids.length > 0 
                                ? (notification.user_emails?.length ? notification.user_emails.join(', ') : `${notification.user_ids.length} user(s)`)
                                : 'All users'}
                            </span>
                          </div>
                        </div>
                        {notification.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelScheduled(notification.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Footer */}
      <div className="bg-muted/30 p-4 text-xs text-muted-foreground border-t">
        <p className="font-medium mb-1">Note</p>
        <p>Push notifications require PWA installation, notification permission, and active internet connection.</p>
      </div>
    </div>
  )
}
