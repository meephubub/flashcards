import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': request.headers.get('Accept') || '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type');
    
    // Get the response data based on content type
    let data;
    if (contentType?.includes('audio/')) {
      data = await response.blob();
    } else {
      data = await response.text();
    }

    // Create a new response with the appropriate content type
    const newResponse = new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      },
    });

    return newResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy request failed' },
      { status: 500 }
    );
  }
}
 