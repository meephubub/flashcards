import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUB_API!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Route Handler.
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscription } = await req.json()

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription missing' }, { status: 400 })
    }

    // Store subscription in database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { 
          user_id: user.id, 
          endpoint: subscription.endpoint,
          subscription,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, endpoint' }
      )

    if (error) {
      console.error('Error saving subscription to Supabase:', error)
      console.error('User ID:', user.id)
      console.error('Endpoint:', subscription.endpoint)
      return NextResponse.json({ 
        error: 'Failed to save subscription', 
        details: error.message,
        hint: 'Ensure push_subscriptions table has an "endpoint" column.'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
