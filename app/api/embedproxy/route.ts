// app/api/embedproxy/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const spoof = req.nextUrl.searchParams.get('spoof') === '1';
  
  if (!url) return new Response('Missing url parameter', { status: 400 });

  try {
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Add spoofing headers if enabled
    if (spoof) {
      headers['Referer'] = 'https://embedsport.xyz/';
      headers['Origin'] = 'https://embedsport.xyz';
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: res.status });
    }

    const body = await res.text();
    const contentType = res.headers.get('content-type') || 'text/html';

    // Build response headers with proper CORS
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
    });

    return new Response(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response('Stream unreachable or blocked', { status: 502 });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}