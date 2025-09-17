import { NextRequest } from "next/server"

// Ensure we run on the Node.js runtime (not Edge) to avoid regional/edge egress quirks
export const runtime = 'nodejs'

// Server-side proxy to streamed.pk that blocks ALL redirects and returns JSON as-is.
// Usage examples:
//  - /api/streamed/matches/live
//  - /api/streamed/matches/all
//  - /api/streamed/matches/{sport}
//  - /api/streamed/stream/{source}/{id}
//  - /api/streamed/sports
// Query params are forwarded.

const DEFAULT_UPSTREAM = "https://streamed.pk"
const UPSTREAM_ORIGIN = process.env.STREAMED_UPSTREAM?.trim() || DEFAULT_UPSTREAM

// In Next.js, dynamic route handler params must be awaited
export async function GET(req: NextRequest, context: { params: any }) {
  // Handle both sync and async params (Next.js versions may differ)
  const maybeParams = context.params
  const resolvedParams = (maybeParams && typeof maybeParams.then === 'function') ? await maybeParams : maybeParams
  const path = (resolvedParams?.path || []).join("/")
  // Only allow proxying the documented /api/* endpoints and /images/* assets
  if (!path || !/^(api|images)\//i.test(path)) {
    return new Response(JSON.stringify({ error: "Invalid proxied path" }), { status: 400, headers: jsonHeaders() })
  }
  const isImagePath = /^(images|api\/images)\//i.test(path)

  const url = new URL(req.url)
  const search = url.search ? url.search : ""
  // Candidate upstreams: env override first, then known mirrors
  const candidates = Array.from(new Set([
    UPSTREAM_ORIGIN,
    "https://streami.su",
    "https://streamed.st",
  ]))

  // Try candidates in order
  try {
    for (const origin of candidates) {
      const attempt = await tryOrigin(origin, path, search, isImagePath)
      if (attempt) return attempt
    }
    // If none succeeded, fall through to r.jina.ai fallback below
  } catch (e: any) {
    // Likely ISP/DNS block or upstream unreachable from current network
    // Fallback 1: try r.jina.ai mirror (read-only) to retrieve the JSON payload
    try {
      const jinaUrlHTTPS = `https://r.jina.ai/${UPSTREAM_ORIGIN.replace(/^https?:\/\//, '')}/${path}${search}`
      const jinaRes = await fetch(jinaUrlHTTPS, { method: 'GET', redirect: 'manual', cache: 'no-store' })
      if (jinaRes.ok) {
        const ct = jinaRes.headers.get('content-type') || ''
        if (ct.toLowerCase().startsWith('image/')) {
          const buf = Buffer.from(await jinaRes.arrayBuffer())
          return new Response(buf, { status: 200, headers: { 'content-type': ct, 'cache-control': 'no-store' } })
        }
        const text = await jinaRes.text()
        try { JSON.parse(text); return new Response(text, { status: 200, headers: jsonHeaders() }) } catch {}
        const extracted = extractEmbeddedJSON(text)
        if (extracted) return new Response(extracted, { status: 200, headers: jsonHeaders() })
        if (isImagePath) return transparentPNG()
        return badUpstreamJSON(text)
      }
      // Try explicit http variant too (some mirrors require http prefix inside r.jina.ai)
      const jinaUrlHTTP = `https://r.jina.ai/http://${UPSTREAM_ORIGIN.replace(/^https?:\/\//, '')}/${path}${search}`
      const jinaRes2 = await fetch(jinaUrlHTTP, { method: 'GET', redirect: 'manual', cache: 'no-store' })
      if (jinaRes2.ok) {
        const ct = jinaRes2.headers.get('content-type') || ''
        if (ct.toLowerCase().startsWith('image/')) {
          const buf = Buffer.from(await jinaRes2.arrayBuffer())
          return new Response(buf, { status: 200, headers: { 'content-type': ct, 'cache-control': 'no-store' } })
        }
        const text = await jinaRes2.text()
        try { JSON.parse(text); return new Response(text, { status: 200, headers: jsonHeaders() }) } catch {}
        const extracted = extractEmbeddedJSON(text)
        if (extracted) return new Response(extracted, { status: 200, headers: jsonHeaders() })
        if (isImagePath) return transparentPNG()
        return badUpstreamJSON(text)
      }
    } catch {}

    if (isImagePath) return transparentPNG()

    return new Response(JSON.stringify({
      error: "Network error to upstream",
      message: (e && e.message) || "all mirrors failed",
      hint: "If your ISP blocks these upstreams, set STREAMED_UPSTREAM to a reachable mirror (e.g., https://streami.su or https://streamed.st) in your .env.local and restart the server.",
      upstreamsTried: candidates,
    }), {
      status: 502,
      headers: jsonHeaders(),
    })
  }
}

// Try a single origin with redirect blocking and content handling
async function tryOrigin(origin: string, path: string, search: string, isImagePath: boolean): Promise<Response | null> {
  const upstreamUrl = `${origin}/${path}${search}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    // Redirect blocked
    if (res.status >= 300 && res.status < 400) return null

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.startsWith('image/')) {
      const buf = Buffer.from(await res.arrayBuffer())
      return new Response(buf, { status: 200, headers: { 'content-type': contentType, 'cache-control': 'no-store' } })
    }
    if (isImagePath) return transparentPNG()

    const text = await res.text()
    if (contentType.includes('application/json')) {
      try { JSON.parse(text) } catch { return badUpstreamJSON(text) }
      return new Response(text, { status: res.status, headers: { 'content-type': contentType, 'cache-control': 'no-store' } })
    }
    // Try to extract JSON from text (block page or markdown)
    const extracted = extractEmbeddedJSON(text)
    if (extracted) return new Response(extracted, { status: 200, headers: jsonHeaders() })
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function jsonHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  }
}

function badUpstreamJSON(bodyText: string): Response {
  const preview = (bodyText || "").slice(0, 200)
  return new Response(JSON.stringify({
    error: "Upstream did not return JSON",
    note: "This often happens when an ISP injects an HTML block page. The proxy prevents client crashes by returning JSON instead.",
    preview,
  }), {
    status: 502,
    headers: jsonHeaders(),
  })
}

// 1x1 transparent PNG
function transparentPNG(): Response {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
  const buf = Buffer.from(base64, 'base64')
  return new Response(buf, {
    status: 200,
    headers: { 'content-type': 'image/png', 'cache-control': 'no-store' },
  })
}

// Tries to extract the first valid JSON object/array from arbitrary text (e.g., markdown wrapper)
function extractEmbeddedJSON(text: string): string | null {
  if (!text) return null
  // 1) Look for fenced code block explicitly marked as json
  const fence = text.match(/```\s*json\s*([\s\S]*?)```/i)
  if (fence && fence[1]) {
    const candidate = fence[1].trim()
    try { const obj = JSON.parse(candidate); return JSON.stringify(obj) } catch {}
  }
  // 2) Heuristic: find first JSON array
  const idxArr = text.indexOf('[')
  if (idxArr !== -1) {
    for (let j = text.lastIndexOf(']'); j > idxArr; j = text.lastIndexOf(']', j - 1)) {
      const slice = text.slice(idxArr, j + 1).trim()
      try { const obj = JSON.parse(slice); return JSON.stringify(obj) } catch {}
      if (j === -1) break
    }
  }
  // 3) Heuristic: find first JSON object
  const idxObj = text.indexOf('{')
  if (idxObj !== -1) {
    for (let j = text.lastIndexOf('}'); j > idxObj; j = text.lastIndexOf('}', j - 1)) {
      const slice = text.slice(idxObj, j + 1).trim()
      try { const obj = JSON.parse(slice); return JSON.stringify(obj) } catch {}
      if (j === -1) break
    }
  }
  return null
}
