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

// Types based on the API docs
interface StreamItem {
  id: number
  name: string
  tag?: string
  poster?: string
  uri_name: string
  starts_at?: number
  ends_at?: number
  always_live?: number
  category_name?: string
  iframe?: string
  allowpaststreams?: number
}

interface StreamCategory {
  category: string
  id: number
  always_live: number
  streams: StreamItem[]
}

interface StreamsResponse {
  success: boolean
  timestamp: number
  READ_ME?: string
  performance?: number
  streams: StreamCategory[]
}

function formatUnixToLocal(ts?: number) {
  if (!ts) return "Unknown"
  try {
    const d = new Date(ts * 1000)
    return d.toLocaleString()
  } catch {
    return "Unknown"
  }
}

function isLive(stream: StreamItem, nowSec: number) {
  if (stream.always_live === 1) return true
  if (typeof stream.starts_at === "number" && typeof stream.ends_at === "number") {
    return nowSec >= stream.starts_at && nowSec <= stream.ends_at
  }
  return false
}

export default function Page() {
  const [data, setData] = React.useState<StreamsResponse | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [onlyLive, setOnlyLive] = React.useState<boolean>(true)
  const [query, setQuery] = React.useState<string>("")
  const [selected, setSelected] = React.useState<StreamItem | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [playerLoading, setPlayerLoading] = React.useState<boolean>(false)
  const [playerError, setPlayerError] = React.useState<string | null>(null)
  const [extractedUrl, setExtractedUrl] = React.useState<string | null>(null)
  const videoLogHandlerRef = React.useRef<((evt: Event) => void) | null>(null)
  const toProxied = React.useCallback((u?: string | null) => {
    if (!u) return u as any
    if (/^https?:\/\//i.test(u)) return `/api/hls-proxy?url=${encodeURIComponent(u)}`
    return u
  }, [])

  // Enhance iframe HTML to allow AirPlay and full-screen where supported.
  const enhanceIframe = React.useCallback((html?: string) => {
    if (!html) return ""
    try {
      // If the provider returns a plain URL, wrap it in an iframe ourselves.
      const urlLike = /^(https?:\/\/[^\s]+)$/i
      if (urlLike.test(html.trim())) {
        const src = html.trim()
        // Use sandbox without top-navigation to limit redirect ability outside the frame.
        return `<iframe src="${src}"
          allow="autoplay; encrypted-media; picture-in-picture; web-share; airplay; fullscreen"
          allowfullscreen
          x-webkit-airplay="allow"
          playsinline
          referrerpolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          style="border:0; width:100%; height:100%;"></iframe>`
      }
      // Normalize spacing to make simple replacements safer
      const hasAllow = /allow="[^"]*"/i.test(html)
      let next = html
      // Inject allow attribute
      const allowVal = 'autoplay; encrypted-media; picture-in-picture; web-share; airplay; fullscreen'
      if (/<iframe/i.test(next)) {
        if (hasAllow) {
          next = next.replace(/allow="([^"]*)"/i, (_m, g1) => {
            const merged = new Set((g1 || '').split(';').map((s: string) => s.trim()).filter(Boolean))
            for (const t of allowVal.split(';')) merged.add(t.trim())
            return `allow="${Array.from(merged).join('; ')}"`
          })
        } else {
          next = next.replace(/<iframe/i, `<iframe allow="${allowVal}"`)
        }
        // Ensure allowfullscreen / fullscreen permissions
        if (!/allowfullscreen/i.test(next)) {
          next = next.replace(/<iframe([^>]*)>/i, '<iframe$1 allowfullscreen>')
        }
        // Ensure AirPlay attribute for Safari
        if (!/x-webkit-airplay=/i.test(next)) {
          next = next.replace(/<iframe/i, '<iframe x-webkit-airplay="allow"')
        }
        if (!/playsinline/i.test(next)) {
          next = next.replace(/<iframe/i, '<iframe playsinline')
        }
        // Add referrerpolicy and sandbox loosened minimally if missing
        if (!/referrerpolicy=/i.test(next)) {
          next = next.replace(/<iframe/i, '<iframe referrerpolicy="no-referrer-when-downgrade"')
        }
        if (!/sandbox=/i.test(next)) {
          // Avoid top-navigation so redirects can't escape the frame
          next = next.replace(/<iframe/i, '<iframe sandbox="allow-scripts allow-same-origin allow-presentation"')
        }
      }
      return next
    } catch {
      return html
    }
  }, [])

  const extractIframeSrc = React.useCallback((html?: string) => {
    if (!html) return null
    const m = html.match(/src\s*=\s*"([^"]+)"/i) || html.match(/src\s*=\s*'([^']+)'/i)
    return m ? m[1] : null
  }, [])

  const embedUrlFrom = React.useCallback((s?: StreamItem | null) => {
    if (!s) return null
    // Allow only what the API explicitly provides for embeds
    if (s.iframe && /^(https?:\/\/[^\s]+)$/i.test(s.iframe.trim())) return s.iframe.trim()
    const src = extractIframeSrc(s.iframe)
    if (src) return src
    return null
  }, [extractIframeSrc])

  // Load hls.js from CDN if not already present
  const ensureHlsScript = React.useCallback(async () => {
    if (typeof window === 'undefined') return false
    if ((window as any).Hls) return true
    await new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js'
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => reject(new Error('Failed to load hls.js'))
      document.head.appendChild(el)
    })
    return !!(window as any).Hls
  }, [])

  // When a stream is selected, try to extract the HLS manifest from the iframe HTML/URL
  React.useEffect(() => {
    let hls: any | null = null
    let aborted = false
    ;(async () => {
      if (!selected?.iframe) {
        setExtractedUrl(null)
        setPlayerError(null)
        return
      }
      setPlayerLoading(true)
      setPlayerError(null)
      setExtractedUrl(null)

      try {
        // Get the iframe URL first
        const iframeSrc = extractIframeSrc(selected.iframe) || (selected.iframe.match(/^(https?:\/\/[^\s]+)$/i)?.[1] ?? null)
        if (!iframeSrc) {
          console.error('[stream] No iframe src found in provided iframe HTML')
          throw new Error('No iframe src found')
        }

        // Ask server to extract the .m3u8 from the iframe HTML
        const res = await fetch(`/api/extract-hls?url=${encodeURIComponent(iframeSrc)}`, { cache: 'no-store' })
        if (!res.ok) {
          console.error('[stream] /api/extract-hls returned', res.status, res.statusText)
          throw new Error('Failed to extract stream URL')
        }
        const data = await res.json()
        const rawUrl: string | undefined = data?.url
        const refererHint: string | undefined = data?.referer
        if (!rawUrl) {
          console.error('[stream] Extractor did not return a url field')
          throw new Error('No HLS URL found')
        }

        const params = new URLSearchParams({ url: rawUrl })
        if (refererHint) params.set('referer', refererHint)
        const proxied = `/api/hls-proxy?${params.toString()}`
        if (aborted) return
        setExtractedUrl(proxied)

        // Attach to video
        const video = videoRef.current
        if (!video) return

        // Attach detailed logging to the video element
        const logVideoState = (evt: Event) => {
          const mediaError = (video.error && (video.error as any).message) || (video.error && (video.error as any).code)
          console.error('[stream][video]', evt.type, {
            readyState: video.readyState,
            networkState: video.networkState,
            currentTime: video.currentTime,
            paused: video.paused,
            ended: video.ended,
            mediaError,
            src: video.currentSrc,
          })
        }
        videoLogHandlerRef.current = logVideoState
        const videoEvents = ['error','stalled','waiting','abort','emptied','loadedmetadata','loadeddata','canplay','canplaythrough','play','playing','pause','ended'] as const
        videoEvents.forEach((ev) => video.addEventListener(ev, logVideoState))

        // Safari can play HLS natively
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = proxied
          await new Promise((r) => setTimeout(r, 0))
          try { await video.play() } catch {}
          return
        }

        // Use hls.js for other browsers
        const ok = await ensureHlsScript()
        if (!ok || !(window as any).Hls) {
          console.error('[stream] hls.js failed to load or is not available')
          throw new Error('hls.js not available')
        }
        const HlsCtor = (window as any).Hls
        hls = new HlsCtor({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 30,
          liveDurationInfinity: true,
        })
        hls.loadSource(proxied)
        hls.attachMedia(video)
        hls.on(HlsCtor.Events.MANIFEST_PARSED, async () => {
          try { await video.play() } catch {}
        })
        hls.on(HlsCtor.Events.ERROR, (_evt: any, data: any) => {
          console.error('[stream] hls.js error', data)
          // Basic recovery attempts on fatal errors
          if (data?.fatal) {
            try {
              if (data.type === 'networkError' && typeof hls.startLoad === 'function') {
                console.warn('[stream] hls.js attempting startLoad() after networkError')
                hls.startLoad()
                return
              }
              if (data.type === 'mediaError' && typeof hls.recoverMediaError === 'function') {
                console.warn('[stream] hls.js attempting recoverMediaError()')
                hls.recoverMediaError()
                return
              }
            } catch (e) {
              console.error('[stream] hls.js recovery step failed', e)
            }
            try { hls?.destroy() } catch {}
            hls = new HlsCtor({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 30,
              maxBufferLength: 30,
              liveDurationInfinity: true,
            })
            hls.loadSource(proxied)
            hls.attachMedia(video)
          }
        })
        // Helpful diagnostics for live playback
        hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e: any, d: any) => console.log('[stream] level switched', d))
        hls.on(HlsCtor.Events.FRAG_LOADED, (_e: any, d: any) => console.log('[stream] frag loaded', d?.frag?.sn))
        hls.on(HlsCtor.Events.BUFFER_APPENDING, (_e: any, d: any) => console.log('[stream] buffer appending', d?.type, d?.data?.length))
      } catch (e: any) {
        console.error('[stream] Player init failed:', e)
        if (aborted) return
        setPlayerError(e?.message || 'Failed to initialize player')
      } finally {
        if (!aborted) setPlayerLoading(false)
      }
    })()
    return () => {
      aborted = true
      try {
        if (hls) {
          hls.destroy?.()
        }
      } catch {}
      const video = videoRef.current
      const handler = videoLogHandlerRef.current
      if (video && handler) {
        const videoEvents = ['error','stalled','waiting','abort','emptied','loadedmetadata','loadeddata','canplay','canplaythrough','play','playing','pause','ended'] as const
        videoEvents.forEach((ev) => video.removeEventListener(ev, handler))
      }
    }
  }, [selected, extractIframeSrc, ensureHlsScript])

  // Poll every 60s per docs suggestion
  const fetchStreams = React.useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("https://ppv.to/api/streams", { cache: "no-store" })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const json: StreamsResponse = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message || "Failed to load streams")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      await fetchStreams()
    })()
    const id = setInterval(() => {
      if (mounted) void fetchStreams()
    }, 60_000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [fetchStreams])

  const nowSec = Math.floor(Date.now() / 1000)

  const filteredCategories = React.useMemo(() => {
    if (!data?.streams) return [] as StreamCategory[]
    const q = query.trim().toLowerCase()
    return data.streams
      .map((cat) => {
        let streams = cat.streams || []
        if (onlyLive) streams = streams.filter((s) => isLive(s, nowSec))
        if (q) streams = streams.filter((s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.tag || "").toLowerCase().includes(q) ||
          (s.category_name || cat.category || "").toLowerCase().includes(q)
        )
        return { ...cat, streams }
      })
      .filter((c) => c.streams.length > 0)
  }, [data, onlyLive, query, nowSec])

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
                <Button variant={onlyLive ? "default" : "outline"} onClick={() => setOnlyLive((v) => !v)}>
                  {onlyLive ? "Showing Live" : "All"}
                </Button>
                <Button variant="ghost" onClick={() => { setLoading(true); void fetchStreams() }} title="Refresh">
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
            ) : filteredCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">No streams found.</div>
            ) : (
              <div className="space-y-10">
                {filteredCategories.map((cat) => (
                  <section key={cat.id}>
                    <div className="flex items-baseline justify-between mb-3">
                      <h2 className="text-lg font-semibold tracking-tight">{cat.category}</h2>
                      <div className="text-xs text-muted-foreground">{cat.streams.length} item(s)</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {cat.streams.map((s) => {
                        const live = isLive(s, nowSec)
                        return (
                          <Card key={s.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                            <div className="relative h-40 w-full bg-muted">
                              {s.poster ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={toProxied(s.poster) as any} alt={s.name} className="h-full w-full object-cover" />
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
                                    {s.starts_at ? new Date(s.starts_at * 1000).toLocaleTimeString() : "Scheduled"}
                                  </Badge>
                                )}
                                {s.tag ? (
                                  <Badge variant="outline" className="backdrop-blur bg-white/80 dark:bg-black/30 border-white/50 dark:border-white/20">
                                    {s.tag}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <CardContent className="p-4">
                              <div className="text-base font-medium leading-snug line-clamp-2">{s.name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{s.category_name || cat.category}</span>
                                {s.starts_at ? <span>• Starts {formatUnixToLocal(s.starts_at)}</span> : null}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                {s.iframe ? (
                                  <Button size="sm" onClick={() => setSelected(s)}>
                                    <Play className="h-4 w-4 mr-1" /> Watch
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="secondary" asChild>
                                    <a href={`https://example.com/${encodeURIComponent(s.uri_name)}`} target="_blank" rel="noreferrer">
                                      Details
                                    </a>
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={`?s=${encodeURIComponent(s.uri_name)}`}>
                                    Copy Link
                                  </a>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Stream Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => {
        if (!o) {
          // Pause video when closing
          try { videoRef.current?.pause?.() } catch {}
          setSelected(null)
          setPlayerError(null)
          setExtractedUrl(null)
        }
      }}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 flex items-center justify-between">
            <DialogTitle className="text-base">{selected?.name}</DialogTitle>
            {selected?.iframe ? (() => {
              const src = extractIframeSrc(selected.iframe)
              return src ? (
                <div className="flex items-center gap-2 pr-2">
                  {/* Open the player directly to expose native AirPlay controls on Safari/Apple TV */}
                  <Button size="sm" variant="outline" asChild>
                    <a href={src} target="_blank" rel="noreferrer noopener">Open Player</a>
                  </Button>
                </div>
              ) : null
            })() : null}
          </DialogHeader>
          <div className="aspect-video w-full bg-black relative">
            {selected?.iframe ? (
              playerError ? (
                // Fallback to the original iframe if extraction or playback fails
                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: enhanceIframe(selected.iframe) }} />
              ) : (
                <video ref={videoRef} controls playsInline className="absolute inset-0 w-full h-full" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No embed available yet.
              </div>
            )}

            {playerLoading && !playerError ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
                Initializing player...
              </div>
            ) : null}
          </div>
          <div className="px-6 pb-6 text-xs text-muted-foreground">
            Tip: On Safari, use the native player AirPlay control to cast to a smart TV. Respect the provider's terms; embeds may include ads and cannot be altered.
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
