import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Make createClient async and await cookies()
export async function createClient() {
  const cookieStore = await cookies(); // Await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUB_API;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase URL or Anon Key for server client. Please check your environment variables.'
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // These methods now operate on the resolved (awaited) cookieStore
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          // To remove, set to empty string with options
          // Or use cookieStore.delete(name, options) if available and preferred
          cookieStore.set(name, '', options);
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

// getUser will also need to await the async createClient
export async function getUser() {
  const supabase = await createClient(); // Await the client
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
