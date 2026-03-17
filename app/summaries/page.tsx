"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Loader2, Mail, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"

// Notes layout components for consistent shell
import { AppSidebar } from "@/components/notes/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmailSummary {
  id: string
  sender: string
  subject: string
  received_at: string
  body: string
  summary: string
  priority: "critical" | "high" | "medium" | "low"
  priority_reason: string
  created_at: string
}

interface DailyDigest {
  id: string
  date: string
  email_count: number
  digest: string
  generated_at: string
}

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
    cardClass: "border-l-4 border-l-red-500",
  },
  high: {
    label: "High",
    icon: AlertCircle,
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    cardClass: "border-l-4 border-l-orange-500",
  },
  medium: {
    label: "Medium",
    icon: Info,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    cardClass: "border-l-4 border-l-blue-500",
  },
  low: {
    label: "Low",
    icon: Mail,
    badgeClass: "bg-muted text-muted-foreground border-border",
    cardClass: "border-l-4 border-l-muted-foreground/30",
  },
}

export default function SummariesPage() {
  const supabase = React.useMemo(() => createClient(), [])

  const [loading, setLoading] = React.useState(true)
  const [emails, setEmails] = React.useState<EmailSummary[]>([])
  const [digest, setDigest] = React.useState<DailyDigest | null>(null)
  const [expandedEmailId, setExpandedEmailId] = React.useState<string | null>(null)
  const [selectedDate, setSelectedDate] = React.useState<string>(new Date().toISOString().split("T")[0])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Fetch today's digest
      const { data: digestData } = await supabase
        .from("daily_digests")
        .select("*")
        .eq("date", selectedDate)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single()

      if (digestData) {
        setDigest(digestData as DailyDigest)
      } else {
        setDigest(null)
      }

      // Fetch emails for today
      const startOfDay = `${selectedDate}T00:00:00.000Z`
      const endOfDay = `${selectedDate}T23:59:59.999Z`

      const { data: emailData, error } = await supabase
        .from("email_summaries")
        .select("*")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false })

      if (!error && emailData) {
        setEmails(emailData as EmailSummary[])
      } else {
        setEmails([])
      }
    } catch (err) {
      console.error("Failed to fetch summaries:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase, selectedDate])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Group emails by priority
  const emailsByPriority = React.useMemo(() => {
    const grouped: Record<string, EmailSummary[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    }
    emails.forEach((email) => {
      const priority = email.priority || "medium"
      if (grouped[priority]) {
        grouped[priority].push(email)
      } else {
        grouped.medium.push(email)
      }
    })
    return grouped
  }, [emails])

  const toggleEmail = (id: string) => {
    setExpandedEmailId((prev) => (prev === id ? null : id))
  }

  const formatEmailDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "h:mm a")
    } catch {
      return dateStr
    }
  }

  const extractSenderName = (sender: string) => {
    // Extract name from "Name <email@domain.com>" format
    const match = sender.match(/^([^<]+)/)
    return match ? match[1].trim() : sender
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Inbox</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Email Summaries</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background min-h-[100vh] flex-1 rounded-xl md:min-h-min p-4 md:p-6">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Header with date selector */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Email Summaries</h1>
                  <p className="text-sm text-muted-foreground">
                    AI-generated summaries of your inbox
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Daily Digest Card */}
                  {digest ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Daily Digest</CardTitle>
                          <Badge variant="outline" className="font-normal">
                            {digest.email_count} email{digest.email_count !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <CardDescription>
                          Generated {format(new Date(digest.generated_at), "h:mm a")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed">{digest.digest}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Mail className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <p className="mt-3 text-sm text-muted-foreground">
                          No digest available for this date
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Emails by Priority */}
                  {emails.length > 0 ? (
                    <div className="space-y-6">
                      {PRIORITY_ORDER.map((priority) => {
                        const priorityEmails = emailsByPriority[priority]
                        if (priorityEmails.length === 0) return null

                        const config = PRIORITY_CONFIG[priority]
                        const Icon = config.icon

                        return (
                          <div key={priority} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <h2 className="text-sm font-medium">{config.label} Priority</h2>
                              <Badge variant="secondary" className="text-xs">
                                {priorityEmails.length}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              {priorityEmails.map((email) => {
                                const isExpanded = expandedEmailId === email.id

                                return (
                                  <Card
                                    key={email.id}
                                    className={cn(
                                      "overflow-hidden transition-shadow hover:shadow-md cursor-pointer",
                                      config.cardClass
                                    )}
                                    onClick={() => toggleEmail(email.id)}
                                  >
                                    <div className="p-4">
                                      {/* Email Header Row */}
                                      <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm truncate">
                                              {extractSenderName(email.sender)}
                                            </span>
                                            <Badge className={cn("text-xs", config.badgeClass)}>
                                              {config.label}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                              {formatEmailDate(email.received_at)}
                                            </span>
                                          </div>
                                          <p className="text-sm font-medium mt-1 truncate">
                                            {email.subject}
                                          </p>
                                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {email.summary}
                                          </p>
                                          {email.priority_reason && (
                                            <p className="text-xs text-muted-foreground/70 mt-1 italic">
                                              {email.priority_reason}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Expanded Email Body */}
                                      {isExpanded && (
                                        <div className="mt-4 pt-4 border-t">
                                          <div className="text-xs text-muted-foreground mb-2">
                                            From: {email.sender}
                                          </div>
                                          <div className="bg-muted/30 rounded-md p-4">
                                            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                                              {email.body}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </Card>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    !digest && (
                      <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">
                          No emails processed for this date
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
