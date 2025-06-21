import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const timestamp = new Date().toISOString();
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Check database connection
    const { error, count } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Keep-alive database check failed:', error);
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Database check failed',
          error: error.message,
          timestamp
        }, 
        { status: 500 }
      );
    }

    // Ping the image generation endpoint
    let imageApiStatus = 'unknown';
    let imageApiError = null;
    
    try {
      const imageResponse = await fetch('https://flashcards-api-mhmd.onrender.com/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'test',
          model: 'flux',
          response_format: 'url'
        }),
      });

      if (imageResponse.ok) {
        imageApiStatus = 'success';
      } else {
        imageApiStatus = 'error';
        imageApiError = `HTTP ${imageResponse.status}: ${imageResponse.statusText}`;
      }
    } catch (imageError: any) {
      imageApiStatus = 'error';
      imageApiError = imageError.message;
      console.error('Keep-alive image API check failed:', imageError);
    }

    // Ping the text generation endpoint (custom endpoint)
    let textApiStatus = 'unknown';
    let textApiError = null;
    
    try {
      const textResponse = await fetch('https://flashcards-api-mhmd.onrender.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            {
              role: 'user',
              content: 'Hello, this is a health check test.',
            },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.6,
          max_tokens: 50,
        }),
      });

      if (textResponse.ok) {
        const data = await textResponse.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          textApiStatus = 'success';
        } else {
          textApiStatus = 'error';
          textApiError = 'Invalid response format';
        }
      } else {
        textApiStatus = 'error';
        textApiError = `HTTP ${textResponse.status}: ${textResponse.statusText}`;
      }
    } catch (textError: any) {
      textApiStatus = 'error';
      textApiError = textError.message;
      console.error('Keep-alive text API check failed:', textError);
    }

    // Ping the Groq API (fallback endpoint)
    let groqApiStatus = 'unknown';
    let groqApiError = null;
    
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            {
              role: 'user',
              content: 'Hello, this is a health check test.',
            },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.6,
          max_tokens: 50,
        }),
      });

      if (groqResponse.ok) {
        const data = await groqResponse.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          groqApiStatus = 'success';
        } else {
          groqApiStatus = 'error';
          groqApiError = 'Invalid response format';
        }
      } else {
        groqApiStatus = 'error';
        groqApiError = `HTTP ${groqResponse.status}: ${groqResponse.statusText}`;
      }
    } catch (groqError: any) {
      groqApiStatus = 'error';
      groqApiError = groqError.message;
      console.error('Keep-alive Groq API check failed:', groqError);
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Health check completed',
      db_connected: true,
      image_api_status: imageApiStatus,
      image_api_error: imageApiError,
      text_api_status: textApiStatus,
      text_api_error: textApiError,
      groq_api_status: groqApiStatus,
      groq_api_error: groqApiError,
      timestamp,
      card_count: count
    });
    
  } catch (error: any) {
    console.error('Keep-alive error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Internal server error',
        error: error.message,
        timestamp
      }, 
      { status: 500 }
    );
  }
}