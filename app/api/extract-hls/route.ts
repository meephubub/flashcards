import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const target = searchParams.get('url')

  if (!target) {
    console.error('[extract-hls] Missing url parameter')
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(target)) {
    console.error('[extract-hls] Invalid URL:', target)
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamExtractor/1.0)'
      },
      redirect: 'follow'
    })
  } catch (e) {
    console.error('[extract-hls] Fetch failed:', target, e)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }

  const text = await upstream.text()

  // 1) Try JW Player playlist pattern: playlist: [ { file: 'URL' } ]
  const jwMatch = text.match(/playlist\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i)
  if (jwMatch?.[1]) {
    return NextResponse.json({ url: jwMatch[1], referer: target })
  }

  // 2) Try player.load({ file: 'URL' })
  const loadMatch = text.match(/player\.load\s*\(\s*\{\s*file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i)
  if (loadMatch?.[1]) {
    return NextResponse.json({ url: loadMatch[1], referer: target })
  }

  // 3) Any absolute .m3u8 URL in content
  const anyM3U8 = text.match(/https?:\/\/[^'"\s]+\.m3u8[^'"\s]*/i)
  if (anyM3U8?.[0]) {
    return NextResponse.json({ url: anyM3U8[0], referer: target })
  }

  console.error('[extract-hls] No HLS URL found in content from:', target)
  return NextResponse.json({ error: 'No HLS URL found' }, { status: 404 })
}
