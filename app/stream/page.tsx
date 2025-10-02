"use client"

import React from "react"
import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Tv, Play, Clock, LayoutGrid } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Streamed API types
interface APIMatch {
  id: string
  title: string
  category: string
  date: number // ms epoch
  poster?: string
  popular: boolean
  teams?: {
    home?: { name: string; badge: string }
    away?: { name: string; badge: string }
  }
  sources: { source: string; id: string }[]
}

 

interface APIStream {
  id: string
  streamNo: number
  language: string
  hd: boolean
  embedUrl: string
  source: string
}

interface APISport {
  id: string
  name: string
}

export default function Page() {
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [onlyLive, setOnlyLive] = React.useState<boolean>(true)
  const [query, setQuery] = React.useState<string>("")
  // New Streamed API states
  const [sports, setSports] = React.useState<APISport[]>([])
  const [selectedSport, setSelectedSport] = React.useState<string>("")
  const [matches, setMatches] = React.useState<APIMatch[]>([])
  const [selectedMatch, setSelectedMatch] = React.useState<APIMatch | null>(null)
  const [streams, setStreams] = React.useState<APIStream[]>([])
  const [selectedStream, setSelectedStream] = React.useState<APIStream | null>(null)
  const [selectedSource, setSelectedSource] = React.useState<APIMatch['sources'][number] | null>(null)
  const [playerLoading, setPlayerLoading] = React.useState<boolean>(false)
  const [playerError, setPlayerError] = React.useState<string | null>(null)
  const [compatMode, setCompatMode] = React.useState<boolean>(true)

  // Safe iframe builder to block top-level redirects (direct sandbox on player)
  const buildSafeIframeHTML = React.useCallback((src: string) => {
    const escaped = src.replace(/"/g, '&quot;')
    return `<iframe src="${escaped}"
      allow="autoplay; encrypted-media; picture-in-picture; web-share; airplay; fullscreen"
      allowfullscreen
      x-webkit-airplay="allow"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock allow-downloads"
      style="border:0; width:100%; height:100%;"></iframe>`
  }, [])

  // Wrapped protection: sandbox the outer iframe and place the player in an inner iframe via srcdoc.
  // This can block popups at the container level while keeping the player iframe itself unsandboxed.
  const buildWrappedIframeHTML = React.useCallback((src: string) => {
    const escaped = src.replace(/"/g, '&quot;')
    const inner = `<!doctype html><html><head><meta charset=\"utf-8\"></head><body style=\"margin:0;background:#000\">\n`
      + `<iframe src=\"${escaped}\"`
      + ` allow=\"autoplay; encrypted-media; picture-in-picture; web-share; airplay; fullscreen\"`
      + ` allowfullscreen x-webkit-airplay=\"allow\" referrerpolicy=\"no-referrer\"`
      + ` style=\"border:0; width:100%; height:100%;\"></iframe>\n`
      + `<script>try{window.open=function(){return null}}catch(e){}</script>`
      + `</body></html>`
    const srcdoc = inner.replace(/"/g, '&quot;')
    return `<iframe srcdoc="${srcdoc}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation allow-downloads"
      referrerpolicy="no-referrer"
      style="border:0; width:100%; height:100%; background:#000;"></iframe>`
  }, [])

  // Compatibility mode: no sandbox at all (may allow redirects/popups). Use with caution.
  const buildCompatIframeHTML = React.useCallback((src: string) => {
    const escaped = src.replace(/"/g, '&quot;')
    return `<iframe src="${escaped}"
      allow="autoplay; encrypted-media; picture-in-picture; web-share; airplay; fullscreen"
      allowfullscreen
      x-webkit-airplay="allow"
      referrerpolicy="no-referrer"
      style="border:0; width:100%; height:100%;"></iframe>`
  }, [])

  // Fetch helper that blocks redirects
  const safeFetch = React.useCallback((input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input as any, { ...init, redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' })
  }, [])

  // Load sports and matches
  const loadSports = React.useCallback(async () => {
    const res = await safeFetch('/api/streamed/api/sports')
    if (!res.ok) throw new Error(`Failed to load sports (${res.status})`)
    const json: APISport[] = await res.json()
    setSports(json)
  }, [safeFetch])

  const loadMatches = React.useCallback(async () => {
    setError(null)
    const base = selectedSport
      ? `/api/streamed/api/matches/${encodeURIComponent(selectedSport)}`
      : (onlyLive ? '/api/streamed/api/matches/live' : '/api/streamed/api/matches/all')
    const res = await safeFetch(base)
    if (!res.ok) throw new Error(`Failed to load matches (${res.status})`)
    const json: APIMatch[] = await res.json()
    setMatches(json)
  }, [safeFetch, selectedSport, onlyLive])

  const loadStreamsForMatch = React.useCallback(async (match: APIMatch, src?: APIMatch['sources'][number]) => {
    setPlayerError(null)
    setPlayerLoading(true)
    try {
      const chosen = src || match.sources?.[0]
      if (!chosen) throw new Error('No sources available for this match')
      const { source, id } = chosen
      const res = await safeFetch(`/api/streamed/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(`Failed to load streams (${res.status})`)
      const json: APIStream[] = await res.json()
      setStreams(json)
      setSelectedStream(json[0] || null)
    } catch (e: any) {
      setStreams([])
      setSelectedStream(null)
      setPlayerError(e?.message || 'Failed to load streams')
    } finally {
      setPlayerLoading(false)
    }
  }, [safeFetch])

  // Initial load and polling
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try { await loadSports() } catch {}
      try { await loadMatches() } catch (e: any) { setError(e?.message || 'Failed to load matches') }
      if (mounted) setLoading(false)
    })()
    const id = setInterval(() => { if (mounted) void loadMatches() }, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [loadMatches, loadSports])

  // Deprecated: old streams loader removed

  // Reload matches when sport or live toggle changes
  React.useEffect(() => {
    ;(async () => {
      setLoading(true)
      try { await loadMatches() } catch (e: any) { setError(e?.message || 'Failed to load matches') }
      setLoading(false)
    })()
  }, [selectedSport, onlyLive, loadMatches])

  const filteredMatches = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = matches
    if (q) {
      list = list.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.teams?.home?.name?.toLowerCase().includes(q) ?? false) ||
        (m.teams?.away?.name?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [matches, query])

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
                  <BreadcrumbLink href="/">Flashcards</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbPage>Stream</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="bg-background rounded-xl p-6 md:p-10">
            {/* Controls */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LayoutGrid className="h-4 w-4" />
                <span>Browse Streams</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search streams, tags, categories..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-72"
                />
                <Select value={selectedSport || '__all__'} onValueChange={(v) => setSelectedSport(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-56 h-9">
                    <SelectValue placeholder={`All ${onlyLive ? '(Live)' : '(All)'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="__all__" value="__all__">{`All ${onlyLive ? '(Live)' : '(All)'}`}</SelectItem>
                    {sports.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant={onlyLive ? "default" : "outline"} onClick={() => setOnlyLive((v) => !v)}>
                  {onlyLive ? "Showing Live" : "All"}
                </Button>
                <Button variant="ghost" onClick={() => { setLoading(true); void loadMatches() }} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-40 w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border p-6 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-sm text-muted-foreground">No matches found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMatches.map((m) => {
                  const dateStr = new Date(m.date).toLocaleString()
                  const live = onlyLive || (Date.now() >= m.date)
                  const poster = m.poster ? `/api/streamed${m.poster}.webp` : null
                  const homeBadge = m.teams?.home?.badge ? `/api/streamed/api/images/badge/${m.teams.home.badge}.webp` : null
                  const awayBadge = m.teams?.away?.badge ? `/api/streamed/api/images/badge/${m.teams.away.badge}.webp` : null
                  return (
                    <Card key={m.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                      <div className="relative h-40 w-full bg-muted">
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={poster} alt={m.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Tv className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 flex items-center gap-2">
                          {live ? (
                            <Badge variant="default" className="bg-red-600">LIVE</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-black/60 text-white dark:bg-white/20 dark:text-white">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              {dateStr}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="text-base font-medium leading-snug line-clamp-2">{m.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{m.category}</span>
                          <span>• {dateStr}</span>
                          <span className="inline-flex items-center gap-2">
                            {homeBadge ? <img src={homeBadge} alt={m.teams?.home?.name || 'Home'} width={18} height={18} /> : null}
                            {awayBadge ? <img src={awayBadge} alt={m.teams?.away?.name || 'Away'} width={18} height={18} /> : null}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button size="sm" onClick={async () => {
                            setSelectedMatch(m)
                            const first = m.sources?.[0] || null
                            setSelectedSource(first)
                            await loadStreamsForMatch(m, first || undefined)
                          }}>
                            <Play className="h-4 w-4 mr-1" /> Watch
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

    {/* Stream Dialog */}
    <Dialog open={!!selectedMatch} onOpenChange={(o) => {
      if (!o) {
        setSelectedMatch(null)
        setStreams([])
        setSelectedStream(null)
        setSelectedSource(null)
        setPlayerError(null)
      }
    }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 flex items-center justify-between">
          <DialogTitle className="text-base">{selectedMatch?.title}</DialogTitle>
          <div className="flex items-center gap-2 pr-2">
            {/* Optional: open in new tab, will be subject to browser policies */}
            {selectedStream?.embedUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={selectedStream.embedUrl} target="_blank" rel="noreferrer noopener">Open Player</a>
              </Button>
            ) : null}
            <Button size="sm" variant={compatMode ? 'default' : 'outline'} onClick={() => setCompatMode((v) => !v)} title="Protection mode (outer sandbox container)">
              {compatMode ? 'Protection: On' : 'Protection: Off'}
            </Button>
          </div>
        </DialogHeader>
        {/* Source selector */}
        {selectedMatch?.sources?.length ? (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {selectedMatch.sources.map((s) => (
              <Button
                key={`${s.source}:${s.id}`}
                size="sm"
                variant={selectedSource && selectedSource.source === s.source && selectedSource.id === s.id ? 'default' : 'outline'}
                onClick={async () => {
                  setSelectedSource(s)
                  await loadStreamsForMatch(selectedMatch, s)
                }}
              >
                {s.source}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="aspect-video w-full bg-black relative">
          {playerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 text-sm">
              <div>{playerError}</div>
              <Button size="sm" onClick={() => selectedMatch && loadStreamsForMatch(selectedMatch)}>Retry</Button>
            </div>
          ) : selectedStream?.embedUrl ? (
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: (compatMode ? buildWrappedIframeHTML : buildCompatIframeHTML)(selectedStream.embedUrl) }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              {playerLoading ? 'Loading streams...' : 'No stream selected.'}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 text-xs text-muted-foreground">
          Protection mode places the player inside a sandboxed container to block popups, while keeping the player iframe itself unsandboxed. Toggle off if a source fails to load.
        </div>
      </DialogContent>
    </Dialog>
    </SidebarProvider>
  )
}
