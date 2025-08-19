import { NextResponse } from 'next/server';
import { z } from 'zod';

const sitemapRequestSchema = z.object({
  url: z.string().url("Invalid URL format."),
});

export async function POST(req: Request) {
  try {
    const { url } = sitemapRequestSchema.parse(await req.json());

    // Basic check to ensure it's a valid sitemap URL, or append /sitemap.xml
    let sitemapUrl = url;
    if (!sitemapUrl.endsWith('/sitemap.xml') && !sitemapUrl.endsWith('/sitemap.xml/')) {
      sitemapUrl = new URL('/sitemap.xml', url).toString();
    }

    const response = await fetch(sitemapUrl);

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch sitemap: ${response.statusText}` }, { status: response.status });
    }

    const sitemapText = await response.text();

    return new NextResponse(sitemapText, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400 });
    }
    console.error('Sitemap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
