// app/api/image-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SEARXNG_INSTANCES = [
  "https://search.mdosch.de",
  "https://searx.namejeff.xyz",
  "https://searx.sev.monster",
  "https://searxng.hweeren.com"
];

// Cache health info for ~5 minutes
let healthyInstances: string[] = [];
let lastChecked = 0;
const HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Recursively extract image URLs from JSON
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

  // Check instance health with a quick test request
  async function checkSearxngInstanceHealth(): Promise<string[]> {
    if (Date.now() - lastChecked < HEALTH_CACHE_TTL && healthyInstances.length > 0) {
      return healthyInstances;
    }

    const checks = await Promise.allSettled(
      SEARXNG_INSTANCES.map(async (baseUrl) => {
        const healthUrl = `${baseUrl}/search?q=test&format=json`;
        try {
          const response = await fetch(healthUrl, {
            headers: { 'Accept': 'application/json' },
            method: 'GET',
          });
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            return baseUrl;
          }
        } catch (_) {}
        return null;
      })
    );

    healthyInstances = checks
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean) as string[];

    lastChecked = Date.now();
    return healthyInstances;
  }

  // Try querying each healthy instance in order
  async function trySearxngInstances(query: string): Promise<string[] | null> {
    const instances = await checkSearxngInstanceHealth();

    for (const baseUrl of instances) {
      const url = `${baseUrl}/search?q=!images%20${encodeURIComponent(query)}&format=json`;

      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SearXNG instance ${baseUrl} failed: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        const imageUrls = [...new Set(findUrls(data))].slice(0, 10);

        if (imageUrls.length > 0) {
          return imageUrls;
        }
      } catch (err) {
        console.error(`Error connecting to ${baseUrl}:`, err);
        continue;
      }
    }

    return null;
  }

  try {
    const images = await trySearxngInstances(query);

    if (images && images.length > 0) {
      return NextResponse.json({ images }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'All SearXNG instances failed or returned no images' }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Error in image-search API route:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}