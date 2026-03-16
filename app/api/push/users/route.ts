import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ALLOWED_EMAIL = 'samthelegend68@gmail.com'

export async function GET() {
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
              // Ignore
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.email !== ALLOWED_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role client to access auth.users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch all users from auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('Error fetching users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Fetch push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
    }

    // Count subscriptions per user
    const subscriptionCounts = new Map<string, number>()
    subscriptions?.forEach(sub => {
      const count = subscriptionCounts.get(sub.user_id) || 0
      subscriptionCounts.set(sub.user_id, count + 1)
    })

    // Map users with push status
    const usersWithPush = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || null,
      has_push_subscription: subscriptionCounts.has(u.id),
      subscription_count: subscriptionCounts.get(u.id) || 0,
      last_sign_in_at: u.last_sign_in_at,
    }))

    // Sort by subscription count (users with subscriptions first)
    usersWithPush.sort((a, b) => b.subscription_count - a.subscription_count)

    return NextResponse.json({ users: usersWithPush })
  } catch (error) {
    console.error('Error in push users API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
