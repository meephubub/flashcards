import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_EMAIL = process.env.PUSH_ADMIN_EMAIL || ''

async function checkAdmin() {
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
  return ALLOWED_EMAIL && user && user.email === ALLOWED_EMAIL ? user : null
}

// GET — list scheduled notifications
export async function GET() {
  try {
    const user = await checkAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('scheduled_notifications')
      .select('*')
      .in('status', ['pending', 'sent', 'failed'])
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Error fetching scheduled notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    return NextResponse.json({ notifications: data })
  } catch (error) {
    console.error('Schedule GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — create a scheduled notification
export async function POST(req: Request) {
  try {
    const user = await checkAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, body, url, targetUserIds, scheduledAt } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!scheduledAt) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('scheduled_notifications')
      .insert({
        title,
        body: body || null,
        url: url || '/',
        target_user_ids: targetUserIds?.length ? targetUserIds : null,
        scheduled_at: scheduledAt,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating scheduled notification:', error)
      return NextResponse.json({ error: 'Failed to schedule' }, { status: 500 })
    }

    return NextResponse.json({ notification: data })
  } catch (error) {
    console.error('Schedule POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — cancel a scheduled notification
export async function DELETE(req: Request) {
  try {
    const user = await checkAdmin()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('scheduled_notifications')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending')

    if (error) {
      console.error('Error cancelling notification:', error)
      return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Schedule DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
