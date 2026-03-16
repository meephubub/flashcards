import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ALLOWED_EMAIL = 'samthelegend68@gmail.com'

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

    const { title, body, url, scheduledFor, userIds } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!scheduledFor) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 })
    }

    const scheduledDate = new Date(scheduledFor)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // If userIds is null or empty, schedule for all users (user_id = null means all)
    // If userIds has values, create one scheduled notification per user
    const notifications = []

    if (!userIds || userIds.length === 0) {
      // Schedule for all users
      notifications.push({
        title,
        body: body || null,
        url: url || '/',
        user_id: null,
        scheduled_for: scheduledFor,
        status: 'pending',
      })
    } else {
      // Schedule for specific users
      for (const userId of userIds) {
        notifications.push({
          title,
          body: body || null,
          url: url || '/',
          user_id: userId,
          scheduled_for: scheduledFor,
          status: 'pending',
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Error scheduling notification:', error)
      return NextResponse.json({ error: 'Failed to schedule notification' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      scheduled: data,
      count: notifications.length
    })
  } catch (error) {
    console.error('Error in schedule API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
