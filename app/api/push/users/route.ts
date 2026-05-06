import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_EMAIL = process.env.PUSH_ADMIN_EMAIL || ''

export async function GET(req: Request) {
  try {
    // Auth check
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUB_API!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!ALLOWED_EMAIL || !user || user.email !== ALLOWED_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim() || ''

    // Use admin client to bypass RLS
    const admin = createAdminClient()

    // Get distinct users who have push subscriptions
    const { data: subscriptions, error } = await admin
      .from('push_subscriptions')
      .select('user_id')

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get unique user IDs
    const userIds = [...new Set(subscriptions?.map((s: any) => s.user_id) || [])]

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Fetch user details from auth.users
    const { data: { users: authUsers }, error: usersError } = await admin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (usersError) {
      console.error('Error fetching auth users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 })
    }

    // Count subscriptions per user
    const subCounts: Record<string, number> = {}
    subscriptions?.forEach((s: any) => {
      subCounts[s.user_id] = (subCounts[s.user_id] || 0) + 1
    })

    // Filter to users with subscriptions and apply search
    let results = authUsers
      .filter((u: any) => userIds.includes(u.id))
      .map((u: any) => ({
        id: u.id,
        email: u.email || 'No email',
        deviceCount: subCounts[u.id] || 0,
        lastSignIn: u.last_sign_in_at,
      }))

    if (query) {
      const lowerQuery = query.toLowerCase()
      results = results.filter((u: any) =>
        u.email.toLowerCase().includes(lowerQuery)
      )
    }

    // Sort by email
    results.sort((a: any, b: any) => a.email.localeCompare(b.email))

    return NextResponse.json({ users: results })
  } catch (error) {
    console.error('Push users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
