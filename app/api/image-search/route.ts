// app/api/image-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SEARXNG_INSTANCES = [
  "https://search.mdosch.de",
  "https://searx.namejeff.xyz",
  "https://searx.sev.monster",
  "https://searxng.hweeren.com"
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Recursive function to find image URLs in the response object
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

  // Try querying each instance in order
  async function trySearxngInstances(query: string): Promise<string[] | null> {
    for (const baseUrl of SEARXNG_INSTANCES) {
      const url = `${baseUrl}/search?q=!images%20${encodeURIComponent(query)}&format=json`;

      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) continue;

        const data = await response.json();

        let imageUrls: string[] = [];

        // Extract up to 10 image URLs using the recursive helper
        imageUrls = [...new Set(findUrls(data))].slice(0, 10);

        if (imageUrls.length === 0) {
          console.error('Could not extract image URLs from SearXNG response.');
        }

        if (imageUrls.length > 0) {
          return imageUrls;
        }

      } catch (error) {
        continue; // Try next instance on error
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