import { NextRequest, NextResponse } from 'next/server';

// Force Next.js to use Node.js runtime (more reliable for external API calls)
export const runtime = 'nodejs';

// SearXNG instances to try - ordered by reliability
const SEARXNG_INSTANCES = [
  { url: "https://harmless-thoroughly-moth.ngrok-free.app", path: '/search' },
];

// Browser-like headers to avoid being detected as a bot
const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
  'Upgrade-Insecure-Requests': '1',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

export async function GET(request: NextRequest) {
  // Extract query parameter
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const debug = searchParams.has('debug');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  /**
   * Recursively find image URLs in any object
   */
  function findUrls(obj: any): string[] {
    let urls: string[] = [];
    if (typeof obj === 'string') {
      if (/\.(jpeg|jpg|gif|png)$/i.test(obj.split('?')[0])) {
        urls.push(obj.startsWith('//') ? `https:${obj}` : obj);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        urls = urls.concat(findUrls(item));
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(value => {
        urls = urls.concat(findUrls(value));
      });
    }
    return urls;
  }

  /**
   * Search for images using SearXNG on the fixed single instance
   */
  async function searchForImages(query: string, debug = false): Promise<any> {
    const instance = SEARXNG_INSTANCES[0];
    try {
      const searchUrl = `${instance.url}${instance.path}?q=!images+${encodeURIComponent(query)}&format=json&categories=images`;
      if (debug) console.log(`🔍 Searching: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          ...BROWSER_HEADERS,
          'Accept': 'application/json',
          'Referer': `${instance.url}${instance.path}`
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (debug) {
        console.log(`Status: ${response.status}`);
        console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
      }

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data && Array.isArray(data.results)) {
            return {
              query,
              number_of_results: data.results.length,
              results: data.results,
            };
          }
        }
      }
      console.error(`Instance ${instance.url}${instance.path} failed with status ${response.status}`);
      return null;
    } catch (error: any) {
      console.error(`❌ Error with ${instance.url}${instance.path}:`, error);
      return null;
    }
  }

  try {
    // Search for images
    const result = await searchForImages(query, debug);

    if (result && result.results && result.results.length > 0) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json({
        query,
        number_of_results: 0,
        results: [],
        error: 'SearXNG instance failed or returned no results',
        message: 'Try again later or use a different search query'
      }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error in image-search API route:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}