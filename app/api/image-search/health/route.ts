// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

const SEARXNG_INSTANCES = [
  "https://searxng.site/searxng",
  "https://search.mdosch.de/searxng",
  "https://searx.namejeff.xyz/searxng",
  "https://searx.sev.monster/searxng",
  "https://searxng.hweeren.com/searxng"
];

export async function GET() {
  console.log("🔎 Running full health check on SearXNG instances...");

  const checks = await Promise.allSettled(
    SEARXNG_INSTANCES.map(async (baseUrl) => {
      const url = `${baseUrl}/search?q=cat&format=json&categories=images`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0 Safari/537.36'
          },
        });

        const contentType = response.headers.get('content-type') || '';
        console.log(`🌐 ${baseUrl} → Status: ${response.status}, Content-Type: ${contentType}`);

        const body = await response.text();
        console.log(`📦 ${baseUrl} → Body snippet:`, body.slice(0, 300));

        if (response.ok && contentType.includes('application/json')) {
          try {
            const json = JSON.parse(body);
            if (Array.isArray(json.results)) {
              console.log(`✅ ${baseUrl} → Healthy`);
              return { url: baseUrl, healthy: true };
            } else {
              console.log(`⚠️ ${baseUrl} → JSON valid but no results array`);
            }
          } catch (jsonError) {
            console.warn(`⚠️ ${baseUrl} → Failed to parse JSON:`, jsonError);
          }
        } else {
          console.log(`❌ ${baseUrl} → Response not OK or not JSON`);
        }

        return { url: baseUrl, healthy: false };

      } catch (err) {
        console.warn(`❌ ${baseUrl} → Network error or fetch failed:`, err);
        return { url: baseUrl, healthy: false };
      }
    })
  );

  const results = checks
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  console.log("✅ Health check results:", results);
  return NextResponse.json({ instances: results });
}