import { NextResponse } from 'next/server';

const SEARXNG_INSTANCES = [
  "https://search.mdosch.de",
  "https://searx.namejeff.xyz",
  "https://searx.sev.monster",
  "https://searxng.hweeren.com",
  "https://searxng.site"
];

export async function GET() {
  console.log("Running full health check on SearXNG instances...");

  const checks = await Promise.allSettled(
    SEARXNG_INSTANCES.map(async (baseUrl) => {
      const url = `${baseUrl}/search?q=cat&format=json&categories=images`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; SearxngHealthBot/1.0; +https://example.com)'
          },
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const json = await response.json();
          if (Array.isArray(json.results)) {
            return { url: baseUrl, healthy: true };
          }
        }

        return { url: baseUrl, healthy: false };

      } catch (err) {
        console.warn(`❌ Failed to reach ${baseUrl}`, err);
        return { url: baseUrl, healthy: false };
      }
    })
  );

  const results = checks
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  console.log("Health check results:", results);
  return NextResponse.json({ instances: results });
}