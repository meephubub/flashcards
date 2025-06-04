import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ... (existing imports remain the same)

export async function GET() {
  const cookieStore = cookies();
  const timestamp = new Date().toISOString();
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            const cookie = await cookieStore.get(name);
            return cookie?.value;
          },
          async set(name: string, value: string, options: CookieOptions) {
            await cookieStore.set({ name, value, ...options });
          },
          async remove(name: string, options: CookieOptions) {
            await cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { error, count } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Keep-alive check failed:', error);
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

    return NextResponse.json({ 
      status: 'success',
      message: 'Database connection successful',
      db_connected: true,
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