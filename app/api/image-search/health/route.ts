import { NextResponse } from 'next/server';

const SEARXNG_INSTANCES = [
  "https://searxng.site",
  "https://search.mdosch.de",
  "https://searx.namejeff.xyz",
  "https://searx.sev.monster",
  "https://searxng.hweeren.com"
];

export async function GET() {
  console.log("Running full health check on SearXNG instances...");

  const checks = await Promise.allSettled(
    SEARXNG_INSTANCES.map(async (baseUrl) => {
      const healthUrl = `${baseUrl}/search?q=test&format=json`;
      try {
        const response = await fetch(healthUrl, {
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          return { url: baseUrl, healthy: true };
        }
      } catch (_) {}
      return { url: baseUrl, healthy: false };
    })
  );

  const results = checks
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  console.log("Health check results:", results);
  return NextResponse.json({ instances: results });
}
