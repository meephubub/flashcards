import { NextRequest, NextResponse } from 'next/server';

// Force Next.js to use Node.js runtime (more reliable for external API calls)
export const runtime = 'nodejs';

// SearXNG instances to try - ordered by reliability
const SEARXNG_INSTANCES = [
  { url: "https://harmless-thoroughly-moth.ngrok-free.app", path: '/search' },
];

// Define our data structures
interface SearxngInstance {
  url: string;
  path: string;
}

interface SearxngResult {
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  image?: string;
}

// Cache healthy instances to avoid repeated checks
let healthyInstances: SearxngInstance[] = [];
let lastChecked = 0;
const HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      // Match strings that look like image URLs
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
   * Find working SearXNG instances
   */
  async function findWorkingInstances(): Promise<SearxngInstance[]> {
    // Use cached instances if available and not expired
    if (Date.now() - lastChecked < HEALTH_CACHE_TTL && healthyInstances.length > 0) {
      console.log("✅ Using cached instances:", healthyInstances.map(i => `${i.url}${i.path}`));
      return healthyInstances;
    }

    console.log("🔍 Finding working SearXNG instances...");
    const workingInstances: SearxngInstance[] = [];

    // Try each instance
    for (const instance of SEARXNG_INSTANCES) {
      try {
        // Add randomization to the query to help avoid caching/rate limiting
        const randomSuffix = Math.floor(Math.random() * 1000);
        const testUrl = `${instance.url}${instance.path}?q=test${randomSuffix}&format=json`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS,
          // Add a longer timeout
          signal: AbortSignal.timeout(5000),
        });
        
        // Check if the response is valid JSON and has the expected structure
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            // Try to parse the response as JSON
            const data = await response.json();
            
            // Check if it has the expected structure
            if (data && Array.isArray(data.results)) {
              console.log(`✅ Found working instance: ${instance.url}${instance.path}`);
              healthyInstances.push({ url: instance.url, path: instance.path });
              break; // Found a working path for this instance, move to next instance
            }
          }
        } else if (response.status === 429) {
          // Rate limited - log and move on
          console.warn(`⚠️ Rate limited (429) at ${instance.url}${instance.path}`);
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) console.log(`   Retry-After: ${retryAfter}s`);
        } else {
          console.warn(`⚠️ Received status ${response.status} from ${instance.url}${instance.path}`);
        }
      } catch (error) {
        console.error(`❌ Error testing ${instance.url}${instance.path}:`, error);
      }
      
      // Add a delay between requests to avoid triggering rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update cache
    lastChecked = Date.now();
    
    console.log(`🔍 Found ${healthyInstances.length} working instances`);
    return healthyInstances;
  }

  /**
   * Search for images using SearXNG
   */
  async function searchForImages(query: string, debug = false): Promise<any> {
    // Get working instances
    const instances = await findWorkingInstances();
    
    if (instances.length === 0) {
      console.error("❌ No working SearXNG instances found.");
      return null;
    }
    
    let errors: string[] = [];
    
    // Try each working instance
    for (const instance of instances) {
      try {
        // Encode the query with !images prefix to force image search
        const searchUrl = `${instance.url}${instance.path}?q=!images+${encodeURIComponent(query)}&format=json&categories=images`;
        console.log(`🔍 Searching: ${searchUrl}`);
        
        // Perform the search request with browser-like headers
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            ...BROWSER_HEADERS,
            'Accept': 'application/json',
            'Referer': `${instance.url}${instance.path}`
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        // Debug info if requested
        if (debug) {
          console.log(`Status: ${response.status}`);
          console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
        }
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            // Extract results array from SearXNG response
            if (data && Array.isArray(data.results)) {
              return {
                query,
                number_of_results: data.results.length,
                results: data.results,
              };
            }
          }
        }
        
        errors.push(`Instance ${instance.url}${instance.path} failed with status ${response.status}`);
      } catch (error: any) {
        errors.push(`Error at ${instance.url}${instance.path}: ${error.message || 'Unknown error'}`);
        console.error(`❌ Error with ${instance.url}${instance.path}:`, error);
      }
      // Add delay between requests to different instances
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // If we get here, all instances failed
    console.error("❌ All SearXNG instances failed:", errors);
    return null;
  }

  try {
    // Search for images
    const result = await searchForImages(query, debug);

    if (result && result.results && result.results.length > 0) {
      // Success - return the new response format
      return NextResponse.json(result, { status: 200 });
    } else {
      // No results found or all instances failed
      return NextResponse.json({ 
        query,
        number_of_results: 0,
        results: [],
        error: 'All SearXNG instances failed or returned no results',
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
