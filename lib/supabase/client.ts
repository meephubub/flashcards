import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Assuming NEXT_PUBLIC_SUPABASE_PUB_API is the anon key
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUB_API;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase URL or Anon Key. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUB_API are set.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
