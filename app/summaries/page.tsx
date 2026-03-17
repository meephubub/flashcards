'use client'

import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import React, { useEffect, useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Calendar, User, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ALLOWED_EMAIL = "samthelegend68@gmail.com"

interface EmailSummary {
  id: string
  sender: string
  subject: string
  received_at: string
  body_preview: string
  summary: string
  created_at: string
}

export default function SummariesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [summaries, setSummaries] = useState<EmailSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const isAuthorized = user?.email === ALLOWED_EMAIL

  const fetchSummaries = async () => {
    if (!isAuthorized) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('email_summaries')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError
      setSummaries(data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load email summaries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthorized) {
      fetchSummaries()
    } else {
      setLoading(false)
    }
  }, [isAuthorized])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSummaries()
    setRefreshing(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const extractSenderName = (sender: string) => {
    const match = sender.match(/^([^<]+)/)
    if (match) return match[1].trim().replace(/"/g, '')
    return sender
  }

  // Group summaries by date
  const groupedSummaries = useMemo(() => {
    const groups: Record<string, EmailSummary[]> = {}
    summaries.forEach(summary => {
      const date = new Date(summary.received_at || summary.created_at).toLocaleDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(summary)
    })
    return groups
  }, [summaries])

  // Not logged in
  if (authLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Email Summaries</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // Not authorized
  if (!user || !isAuthorized) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Email Summaries</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 flex items-center justify-center p-6">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="text-center">Access Restricted</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                {!user 
                  ? "Please log in to view this page."
                  : "You don't have permission to view this page."}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Email Summaries</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Email Summaries</h1>
              <p className="text-muted-foreground text-sm mt-1">
                AI-generated summaries of your daily emails
              </p>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {error}
                </CardContent>
              </Card>
            ) : summaries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No email summaries yet.</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Summaries will appear here after your daily email digest runs.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedSummaries).map(([date, dateSummaries]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium text-muted-foreground">{date}</h2>
                      <span className="text-xs text-muted-foreground/60">
                        ({dateSummaries.length} {dateSummaries.length === 1 ? 'email' : 'emails'})
                      </span>
                    </div>
                    <div className="space-y-3">
                      {dateSummaries.map((summary) => {
                        const isExpanded = expandedIds.has(summary.id)
                        return (
                          <Card
                            key={summary.id}
                            className={cn(
                              "transition-colors cursor-pointer hover:bg-muted/30",
                              isExpanded && "bg-muted/20"
                            )}
                            onClick={() => toggleExpand(summary.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base font-medium leading-tight truncate">
                                    {summary.subject || '(No Subject)'}
                                  </CardTitle>
                                  <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1 truncate">
                                      <User className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{extractSenderName(summary.sender)}</span>
                                    </span>
                                    <span className="text-xs shrink-0">
                                      {formatDate(summary.received_at || summary.created_at)}
                                    </span>
                                  </div>
                                </div>
                                <div className="shrink-0 text-muted-foreground">
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="text-sm">
                                <p className="text-foreground/90 leading-relaxed">
                                  {summary.summary}
                                </p>
                                {isExpanded && summary.body_preview && (
                                  <div className="mt-4 pt-4 border-t">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      Original Preview
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                      {summary.body_preview}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
