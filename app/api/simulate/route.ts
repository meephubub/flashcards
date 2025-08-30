import { NextResponse } from 'next/server'

// Server-side proxy to avoid browser CORS/preflight to external API
// POST /api/simulate
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const base = process.env.MARKER_API_BASE?.replace(/\/$/, '')
      || process.env.NEXT_PUBLIC_MARKER_API_BASE?.replace(/\/$/, '')
      || 'https://harmless-thoroughly-moth.ngrok-free.app'

    const endpoint = `${base}/simulate`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    // Log upstream response server-side for debugging
    console.error('[simulate proxy] upstream', {
      url: endpoint,
      status: res.status,
      statusText: res.statusText,
      bodyPreview: text.slice(0, 2000),
    })

    // If upstream returned error, surface details in JSON (prefer JSON body)
    if (!res.ok) {
      try {
        const json = JSON.parse(text)
        return NextResponse.json({ upstream: { status: res.status, statusText: res.statusText }, ...json }, { status: res.status })
      } catch {
        return NextResponse.json({ upstream: { status: res.status, statusText: res.statusText }, text }, { status: res.status })
      }
    }

    // Success: attempt JSON parse else pass through text
    try {
      const json = JSON.parse(text)
      return NextResponse.json(json, { status: res.status })
    } catch {
      return new NextResponse(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'text/plain' } })
    }
  } catch (e: any) {
    console.error('[simulate proxy] error', e)
    return NextResponse.json({ error: e?.message || 'Proxy failed' }, { status: 500 })
  }
}
