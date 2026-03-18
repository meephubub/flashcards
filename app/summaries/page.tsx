"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppSidebar } from "@/components/notes/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, Trash2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"

type DigestRow = {
  id?: string | number
  date: string
  email_count: number | null
  digest: string | null
  generated_at?: string | null
}

type EmailSummaryRow = {
  id: string | number
  sender: string | null
  subject: string | null
  received_at: string | null
  summary: string | null
  priority: string | null
  priority_reason: string | null
}

type ApiResponse = {
  digests: DigestRow[]
  summaries: EmailSummaryRow[]
}

function dateKeyFromUnknown(value: string | null | undefined): string | null {
  if (!value) return null
  // common happy path: ISO date or ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const t = Date.parse(value)
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

function formatDigestDate(dateIso: string) {
  try {
    const d = new Date(dateIso + "T00:00:00Z")
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateIso
  }
}

function priorityLabel(priority: string | null): string {
  const p = (priority || "").toLowerCase()
  if (p === "critical") return "CRITICAL"
  if (p === "high") return "HIGH"
  if (p === "medium") return "MEDIUM"
  if (p === "low") return "LOW"
  return p ? p.toUpperCase() : "—"
}

export default function SummariesPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [data, setData] = React.useState<ApiResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | number | null>(null)
  const [openDigestKeys, setOpenDigestKeys] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    if (!isLoading && !user) router.push("/login")
  }, [isLoading, user, router])

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/summaries", { cache: "no-store" })
      const json = (await res.json()) as any
      if (!res.ok) throw new Error(json?.error || "Failed to load summaries")
      setData(json as ApiResponse)
    } catch (e: any) {
      setError(e?.message || "Failed to load summaries")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!user) return
    void fetchData()
  }, [user, fetchData])

  const onDeleteSummary = async (id: string | number) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/email-summaries/${encodeURIComponent(String(id))}`, { method: "DELETE" })
      const json = (await res.json()) as any
      if (!res.ok) throw new Error(json?.error || "Failed to delete summary")
      setData((prev) => {
        if (!prev) return prev
        return { ...prev, summaries: prev.summaries.filter((s) => String(s.id) !== String(id)) }
      })
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = React.useMemo(() => {
    const digests = data?.digests || []
    const summaries = data?.summaries || []

    const byDate: Record<string, EmailSummaryRow[]> = {}
    for (const s of summaries) {
      const k = dateKeyFromUnknown(s.received_at) || "unknown"
      byDate[k] ||= []
      byDate[k].push(s)
    }
    for (const k of Object.keys(byDate)) {
      byDate[k].sort((a, b) => {
        const ta = a.received_at ? Date.parse(a.received_at) : 0
        const tb = b.received_at ? Date.parse(b.received_at) : 0
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
      })
    }

    return digests.map((d) => {
      const k = dateKeyFromUnknown(d.date) || "unknown"
      return { digest: d, dateKey: k, summaries: byDate[k] || [] }
    })
  }, [data])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/home">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Summaries</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              Refresh
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-medium tracking-tight">Email digests</div>
                  <div className="text-xs text-muted-foreground">
                    Monochrome, nested summaries, quick delete.
                  </div>
                </div>
                <Link href="/push" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
                  Notifications
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="p-6">
                <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm">
                <div className="font-medium">Couldn’t load summaries</div>
                <div className="mt-1 text-muted-foreground">{error}</div>
              </div>
            ) : grouped.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No digests yet.</div>
            ) : (
              <div className="divide-y">
                {grouped.map(({ digest, dateKey, summaries }) => {
                  const digestKey = String(digest.id ?? digest.date)
                  const count = digest.email_count ?? summaries.length
                  const title = formatDigestDate(dateKey === "unknown" ? digest.date : dateKey)
                  const summariesCount = summaries.length
                  const summariesLabel = summariesCount === 1 ? "summary" : "summaries"

                  const isOpen = openDigestKeys.has(digestKey)

                  const onToggle = () => {
                    setOpenDigestKeys((prev) => {
                      const next = new Set(prev)
                      if (next.has(digestKey)) next.delete(digestKey)
                      else next.add(digestKey)
                      return next
                    })
                  }

                  const onDeleteDigest = async (e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()

                    if (!digest.id) return
                    const digestId = digest.id
                    const summaryIds = summaries.map((s) => String(s.id))

                    setDeletingId(digestId)
                    try {
                      const res = await fetch(`/api/daily-digests/${encodeURIComponent(String(digestId))}/delete`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ summaryIds }),
                      })
                      const json = (await res.json()) as any
                      if (!res.ok) throw new Error(json?.error || "Failed to delete digest")

                      setData((prev) => {
                        if (!prev) return prev
                        return {
                          ...prev,
                          digests: prev.digests.filter((d) => String(d.id ?? d.date) !== String(digestId)),
                          summaries: prev.summaries.filter((s) => !summaryIds.includes(String(s.id))),
                        }
                      })

                      setOpenDigestKeys((prev) => {
                        const next = new Set(prev)
                        next.delete(digestKey)
                        return next
                      })
                    } catch (err) {
                      console.error(err)
                    } finally {
                      setDeletingId(null)
                    }
                  }

                  return (
                    <div key={digestKey}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={onToggle}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") onToggle()
                        }}
                        className={cn(
                          "px-5 py-4 cursor-pointer select-none",
                          "flex w-full items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                        )}
                      >
                        <div className="flex min-w-0 flex-col items-start gap-1">
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {count} email{count === 1 ? "" : "s"} • {summariesCount} {summariesLabel}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                            Digest
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isOpen ? "rotate-180" : "rotate-0"
                            )}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "shrink-0",
                              deletingId &&
                                digest.id !== undefined &&
                                String(deletingId) === String(digest.id)
                                ? "opacity-60"
                                : ""
                            )}
                            onClick={onDeleteDigest}
                            disabled={deletingId !== null}
                            title="Delete digest and its summaries"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="px-5 pb-5">
                          <div className="rounded-xl border bg-background p-4">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground">Daily digest</div>
                            <div className="mt-2 text-base md:text-lg leading-7 text-foreground/95 whitespace-pre-wrap break-words">
                              {digest.digest || "—"}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between">
                              <div className="text-xs uppercase tracking-wider text-muted-foreground">Email summaries</div>
                              <div className="text-[11px] text-muted-foreground">{summariesCount} items</div>
                            </div>

                            {summariesCount === 0 ? (
                              <div className="mt-2 text-sm text-muted-foreground">No summaries for this digest date.</div>
                            ) : (
                              <div className="mt-2 overflow-hidden rounded-xl border">
                                <div className="divide-y">
                                  {summaries.map((s) => (
                                    <div
                                      key={String(s.id)}
                                      className="group flex gap-3 p-3 bg-background hover:bg-muted/20 transition-colors"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <div className="text-sm font-medium truncate">{s.subject || "(No subject)"}</div>
                                          <div className="text-[10px] rounded-full border px-2 py-0.5 text-muted-foreground">
                                            {priorityLabel(s.priority)}
                                          </div>
                                        </div>
                                        <div className="mt-1 text-[11px] text-muted-foreground truncate">
                                          {s.sender || "Unknown sender"} {s.received_at ? `• ${s.received_at}` : ""}
                                        </div>
                                        <div className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
                                          {s.summary || "—"}
                                        </div>
                                        {s.priority_reason ? (
                                          <div className="mt-2 text-[11px] text-muted-foreground">Reason: {s.priority_reason}</div>
                                        ) : null}
                                      </div>

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                          "shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                                          deletingId && String(deletingId) === String(s.id) ? "opacity-100" : ""
                                        )}
                                        onClick={(ev) => {
                                          ev.preventDefault()
                                          ev.stopPropagation()
                                          onDeleteSummary(s.id)
                                        }}
                                        disabled={deletingId !== null}
                                        title="Delete summary"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

