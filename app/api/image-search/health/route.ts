// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

// The SearXNG instances URLs - note that the path structure varies between instances
const SEARXNG_INSTANCES = [
  "https://harmless-thoroughly-moth.ngrok-free.app",
  "https://felladrin-minisearch.hf.space",
  "https://searxng.site",
  "https://search.mdosch.de",
  "https://searx.namejeff.xyz",
  "https://searx.sev.monster",
  "https://searxng.hweeren.com"
];

// Define interface for SearXNG instance with URL and path information
interface SearxngInstance {
  url: string;
  path: string;
  healthy: boolean;
}

export async function GET() {
  console.log("🔎 Running full health check on SearXNG instances...");

  const checks = await Promise.allSettled(
    SEARXNG_INSTANCES.map(async (baseUrl) => {
      // Try both URL patterns
      const primaryUrl = `${baseUrl}/search?q=cat&format=json&categories=images`;
      const altUrl = `${baseUrl}/searxng/search?q=cat&format=json&categories=images`;
      console.log(`trying ${primaryUrl}`);
      try {
        // Try the primary URL pattern first
        let response = await fetch(primaryUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0 Safari/537.36'
          },
        });

        let contentType = response.headers.get('content-type') || '';
        console.log(`🌐 ${baseUrl} → Status: ${response.status}, Content-Type: ${contentType}`);

        let body = await response.text();
        console.log(`📦 ${baseUrl} → Body snippet:`, body.slice(0, 300));
        
        // If first URL fails with 404 or 429, try the alternative URL pattern
        if ((response.status === 404 || response.status === 429) && !baseUrl.endsWith('/searxng')) {
          console.log(`trying alternative URL: ${altUrl}`);
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            response = await fetch(altUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0 Safari/537.36',
                'Referer': 'https://searxng.site/',
                'Cache-Control': 'no-cache'
              },
            });
            
            contentType = response.headers.get('content-type') || '';
            console.log(`🌐 ${baseUrl}/searxng → Status: ${response.status}, Content-Type: ${contentType}`);
            
            body = await response.text();
            console.log(`📦 ${baseUrl}/searxng → Body snippet:`, body.slice(0, 300));
          } catch (altErr) {
            console.warn(`❌ ${baseUrl}/searxng → Network error or fetch failed:`, altErr);
          }
        }

        if (response.ok && contentType.includes('application/json')) {
          try {
            const json = JSON.parse(body);
            if (Array.isArray(json.results)) {
              // Determine which URL pattern worked
              const path = response.url.includes('/searxng/search') ? '/searxng/search' : '/search';
              console.log(`✅ ${baseUrl}${path} → Healthy`);
              return { url: baseUrl, path: path, healthy: true };
            } else {
              console.log(`⚠️ ${baseUrl} → JSON valid but no results array`);
            }
          } catch (jsonError) {
            console.warn(`⚠️ ${baseUrl} → Failed to parse JSON:`, jsonError);
          }
        } else {
          console.log(`❌ ${baseUrl} → Response not OK or not JSON`);
        }

        return { url: baseUrl, path: '/search', healthy: false };

      } catch (err) {
        console.warn(`❌ ${baseUrl} → Network error or fetch failed:`, err);
        return { url: baseUrl, path: '/search', healthy: false };
      }
    })
  );

  const results = checks
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is SearxngInstance => r !== null);

  // Format the output to show which paths were successful
  const formattedResults = results.map(r => {
    if (r && r.healthy) {
      return { url: `${r.url}${r.path}`, healthy: r.healthy };
    }
    return { url: r ? r.url : 'unknown', healthy: r ? r.healthy : false };
  });
  
  console.log("✅ Health check results:", formattedResults);
  return NextResponse.json({ instances: formattedResults });
}