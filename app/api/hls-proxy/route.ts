import { NextRequest, NextResponse } from 'next/server';

// Simple HLS proxy that forwards a remote URL and adds permissive CORS headers.
// Usage: /api/hls-proxy?url=<encoded URL>
// Note: Consider restricting allowed hosts for security in production.

export const runtime = 'edge';

function corsHeaders(origin: string | null) {
  // In production, you may want to restrict this
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Accept, Origin, Referer, User-Agent',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Accept-Ranges',
  } as Record<string, string>;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  const debug = searchParams.get('debug') === '1';
  const refererParam = searchParams.get('referer');

  if (!target) {
    console.error('[hls-proxy] Missing url parameter');
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Basic safety: only http(s)
  if (!/^https?:\/\//i.test(target)) {
    console.error('[hls-proxy] Invalid URL:', target);
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Forward some headers (User-Agent can help with some CDNs)
  const ua = req.headers.get('user-agent') || undefined;
  const referer = refererParam || req.headers.get('referer') || undefined;

  let upstream: Response;
  try {
    const range = req.headers.get('range') || undefined;
    const upstreamOrigin = new URL(target).origin;
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Referer': referer || new URL(target).origin,
        'Origin': upstreamOrigin,
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, video/*, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Site': 'cross-site',
        ...(range ? { Range: range } : {}),
      },
      redirect: 'follow',
    });
  } catch (e) {
    console.error('[hls-proxy] Upstream fetch failed:', target, e);
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }

  const origin = req.headers.get('origin');

  // Pass through headers
  const headers = new Headers();
  let ct = upstream.headers.get('content-type') || '';
  if (!ct) {
    const pathname = new URL(target).pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) ct = 'application/vnd.apple.mpegurl';
    else if (pathname.endsWith('.ts')) ct = 'video/MP2T';
    else if (pathname.endsWith('.m4s')) ct = 'video/iso.segment';
    else if (pathname.endsWith('.mp4')) ct = 'video/mp4';
    else if (pathname.endsWith('.key')) ct = 'application/octet-stream';
    else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) ct = 'image/jpeg';
    else if (pathname.endsWith('.png')) ct = 'image/png';
    else if (pathname.endsWith('.webp')) ct = 'image/webp';
    else if (pathname.endsWith('.gif')) ct = 'image/gif';
    else if (pathname.endsWith('.svg')) ct = 'image/svg+xml';
  }
  if (ct) headers.set('Content-Type', ct);
  const ar = upstream.headers.get('accept-ranges');
  if (ar) headers.set('Accept-Ranges', ar);
  const cr = upstream.headers.get('content-range');
  if (cr) headers.set('Content-Range', cr);
  let cc = upstream.headers.get('cache-control') || '';
  if (!cc) {
    // Add short caching for images by default
    if (ct.startsWith('image/')) cc = 'public, max-age=600'; else cc = 'no-cache';
  }
  headers.set('Cache-Control', cc);

  // CORS headers
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);

  // If HLS playlist, rewrite relative URIs to absolute and re-proxy them
  const isPlaylist = ct.toLowerCase().includes('application/vnd.apple.mpegurl') || /\.m3u8(\?|$)/i.test(new URL(target).pathname);
  if (isPlaylist) {
    console.log('[hls-proxy] Rewriting playlist for:', target);
    let text = await upstream.text();
    // Remove UTF-8 BOM and leading whitespace before validation
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    text = text.replace(/^\s+/, '');
    if (debug) {
      console.warn('[hls-proxy] Debug mode enabled, bypassing playlist validation/rewrites for', target);
      return new NextResponse(text, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }
    if (!/^#EXTM3U/m.test(text)) {
      console.warn('[hls-proxy] Content did not contain #EXTM3U; passing through without rewrite for', target);
      return new NextResponse(text, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }
    const baseUrl = new URL(target);

    const rewriteAttrUri = (line: string) => {
      // Rewrite URI attributes inside tags like #EXT-X-KEY or #EXT-X-MAP
      return line.replace(/URI="([^"]+)"/g, (_m, g1) => {
        const original = g1 as string;
        const abs = /^https?:\/\//i.test(original) ? original : new URL(original, baseUrl).toString();
        const proxied = `/api/hls-proxy?url=${encodeURIComponent(abs)}${refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ''}`;
        return `URI="${proxied}"`;
      });
    };

    const rewritten = text.split('\n').map((raw) => {
      let line = raw;
      const t = line.trim();
      // keep comments and tags, but still rewrite URI attributes when present
      if (!t) return line;
      if (t.startsWith('#')) {
        if (/^#EXT-X-(KEY|MAP)/.test(t) && /URI="/.test(t)) {
          return rewriteAttrUri(line);
        }
        return line;
      }
      // If it's already absolute, keep as absolute but route via proxy
      if (/^https?:\/\//i.test(t)) {
        const proxied = `/api/hls-proxy?url=${encodeURIComponent(t)}${refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ''}`;
        return proxied;
      }
      // Otherwise resolve relative to base
      const absolute = new URL(t, baseUrl).toString();
      const proxied = `/api/hls-proxy?url=${encodeURIComponent(absolute)}${refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ''}`;
      return proxied;
    }).join('\n');

    return new NextResponse(rewritten, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  // Log non-OK upstream statuses for debugging
  if (upstream.status >= 400) {
    console.error('[hls-proxy] Upstream returned error status:', upstream.status, upstream.statusText, 'for', target);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
