import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
    const GOOGLE_CX_ID = '579359dbad7d54fae'; // Hardcoded CX ID provided by user

    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google Search API key not configured.' },
        { status: 500 }
      );
    }

    const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(query)}`;

    const response = await fetch(googleSearchUrl);
    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.statusText}`);
    }

    const data = await response.json();
    const links = data.items?.map((item: any) => item.link) || [];

    return NextResponse.json({ links }, { status: 200 });

  } catch (error: any) {
    console.error('Error in Google Search API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 