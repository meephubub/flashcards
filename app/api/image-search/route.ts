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

  // Helper to try each instance in order
  async function trySearxngInstances(query: string): Promise<string[] | null> {
    for (const baseUrl of SEARXNG_INSTANCES) {
      const url = `${baseUrl}/search?q=!images%20${encodeURIComponent(query)}&format=json`;
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          // Optionally log for debugging
          // const errorText = await response.text();
          // console.error(`SearXNG instance ${baseUrl} failed: ${response.status} - ${errorText}`);
          continue; // Try next instance
        }
        const data = await response.json();
        if (data && Array.isArray(data.results)) {
          // Extract up to 10 absolute image URLs from img_src, url, or thumbnail_src
          const imageUrls: string[] = [];
          for (const result of data.results) {
            let imgUrl = result.img_src || result.url || result.thumbnail_src;
            if (imgUrl && typeof imgUrl === 'string') {
              if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
              imageUrls.push(imgUrl);
            }
            if (imageUrls.length >= 10) break;
          }
          if (imageUrls.length > 0) {
            return imageUrls;
          }
        }
      } catch (err) {
        // Network or parsing error, try next instance
        continue;
      }
    }
    return null;
  }

  const images = await trySearxngInstances(query);
  if (images && images.length > 0) {
    return NextResponse.json({ images }, { status: 200 });
  } else {
    return NextResponse.json({ error: 'All SearXNG instances failed or returned no images' }, { status: 502 });
  }
}
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
