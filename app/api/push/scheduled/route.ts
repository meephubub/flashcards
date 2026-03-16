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

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: notifications, error } = await supabaseAdmin
      .from('scheduled_notifications')
      .select('*')
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Error fetching scheduled notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Fetch user emails for the notifications
    const allUserIds = new Set<string>()
    notifications.forEach(n => {
      if (n.user_ids && Array.isArray(n.user_ids)) {
        n.user_ids.forEach((id: string) => allUserIds.add(id))
      }
    })

    let userEmails: Record<string, string> = {}
    
    if (allUserIds.size > 0) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      if (authUsers?.users) {
        authUsers.users.forEach(u => {
          userEmails[u.id] = u.email || 'Unknown'
        })
      }
    }

    // Enrich notifications with user emails
    const enrichedNotifications = notifications.map(n => ({
      ...n,
      user_emails: n.user_ids && Array.isArray(n.user_ids) 
        ? n.user_ids.map((id: string) => userEmails[id]).filter(Boolean)
        : null
    }))

    return NextResponse.json({ notifications: enrichedNotifications })
  } catch (error) {
    console.error('Error in scheduled API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
