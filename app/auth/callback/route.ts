import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUB_API!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            const cookieOptions = {
              ...options,
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            };
            cookieStore.set({ name, value, ...cookieOptions });
          },
          remove(name: string, options: CookieOptions) {
            const cookieOptions = {
              ...options,
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            };
            cookieStore.set({ name, value: '', ...cookieOptions });
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to a protected route or the home page after successful auth
      return NextResponse.redirect(`${origin}/notes`);
    }
  }

  // Redirect to an error page or home page if there's an error or no code
  console.error('Authentication callback error or no code provided');
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
