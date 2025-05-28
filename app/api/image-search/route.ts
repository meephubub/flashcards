// app/api/image-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Temporarily using a public instance for testing Vercel connectivity
  const searxngUrl = `https://searxng.site/search?q=!images%20${encodeURIComponent(query)}&format=json`;
  // const searxngUrl = `https://raspberrypi.unicorn-deneb.ts.net/search?q=!images%20${encodeURIComponent(query)}&format=json`; // Original

  try {
    const response = await fetch(searxngUrl, {
      headers: {
        // Some instances might prefer or require an Accept header for JSON
        // 'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Log the actual error from SearXNG for debugging
      const errorText = await response.text();
      console.error(`SearXNG request failed with status ${response.status}: ${errorText}`);
      if (response.status === 429) {
        return NextResponse.json({ error: 'SearXNG rate limit hit. Please try again later.' }, { status: 429 });
      }
      return NextResponse.json({ error: `Failed to fetch images from SearXNG. Status: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();

    // TODO: Inspect the 'data' object to determine its structure and extract image URLs.
    // This is a placeholder based on a common structure.
    // You might need to adjust this based on the actual SearXNG JSON response.
    // Example: data.results might be an array of objects, each with an 'img_src' or 'url' field.
    let imageUrls: string[] = [];
    if (data && data.results && Array.isArray(data.results)) {
      imageUrls = data.results
        .map((item: any) => item.img_src || item.url || item.thumbnail_src)
        .filter(Boolean)
        .map((url: string) => url.startsWith('//') ? `https:${url}` : url) // Ensure absolute URL
        .slice(0, 10);
      // We take various potential keys and filter out any null/undefined ones, then take the first 10.
    } else {
        // If the structure is different, log it for inspection
        console.warn('Unexpected SearXNG response structure:', data);
        // Attempt to find any URLs in the response as a fallback
        const findUrls = (obj: any): string[] => {
            let urls: string[] = [];
            if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('//'))) {
                if (/\.(jpeg|jpg|gif|png)$/i.test(obj.split('?')[0])) { // Check extension before query params
                    urls.push(obj.startsWith('//') ? `https:${obj}` : obj); // Ensure absolute URL
                }
            } else if (Array.isArray(obj)) {
                obj.forEach(item => urls = urls.concat(findUrls(item)));
            } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(value => urls = urls.concat(findUrls(value)));
            }
            return urls;
        };
        imageUrls = [...new Set(findUrls(data))].slice(0, 10); // Deduplicate and take first 10
        if (imageUrls.length === 0) {
            console.error('Could not extract image URLs from SearXNG response.');
        }
    }

    if (imageUrls.length === 0) {
        console.warn('No image URLs extracted from SearXNG response for query:', query, 'Response data:', data);
        // It's possible no results were found, or parsing failed.
        // Depending on desired behavior, you might return an empty array or an error.
    }

    return NextResponse.json({ images: imageUrls });

  } catch (error: any) {
    console.error('Error in image-search API route:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}