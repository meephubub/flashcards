import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const testQuery = 'test';
  const searxngUrl = `https://raspberrypi.unicorn-deneb.ts.net/searxng/search?q=!images%20${encodeURIComponent(testQuery)}&format=json`;
  
  try {
    const startTime = Date.now();
    const response = await fetch(searxngUrl, {
      headers: {
        'User-Agent': 'Flashcards App Health Check',
      },
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });
    const requestTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          status: 'error',
          message: `SearXNG returned status ${response.status}`,
          details: errorText
        },
        { status: 503 }
      );
    }

    const data = await response.json();
    
    // Basic check if the response has the expected structure
    const hasResults = data && data.results && Array.isArray(data.results);
    
    return NextResponse.json({
      status: 'ok',
      searxngInstance: 'raspberry-pi',
      responseTimeMs: requestTime,
      hasValidResponse: hasResults,
      resultsCount: hasResults ? data.results.length : 0
    });
    
  } catch (error: any) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      { 
        status: 'error',
        message: error.name === 'TimeoutError' ? 'Request timed out' : 'Failed to reach SearXNG',
        details: error.message
      },
      { status: 503 }
    );
  }
}
