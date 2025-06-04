import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure the route is not statically rendered or cached

export async function GET() {
  const cookieStore = cookies();
  // Ensure SUPABASE_URL and SUPABASE_ANON_KEY are available as environment variables
  // The createRouteHandlerClient will use them automatically
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Perform a simple read operation from the 'decks' table.
    // Using `head: true` fetches only the count, which is efficient.
    const { error, count } = await supabase
      .from('decks') 
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      console.error('Supabase keep-alive ping failed:', error.message);
      // Return a non-2xx status code so Vercel cron can detect failures
      return NextResponse.json({ message: 'Supabase ping failed', error: error.message }, { status: 500 });
    }

    console.log('Supabase keep-alive ping successful. Queried "decks" table.');
    return NextResponse.json({ message: 'Supabase pinged successfully', details: `Queried "decks", count (indicative): ${count}` });
  } catch (e: any) {
    console.error('Unexpected error during Supabase keep-alive ping:', e.message);
    return NextResponse.json({ message: 'Unexpected error during Supabase ping', error: e.message }, { status: 500 });
  }
}
