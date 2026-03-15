import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

const ALLOWED_EMAIL = 'samthelegend68@gmail.com'

export async function POST(req: Request) {
  try {
    // Configure web-push with VAPID keys inside the handler
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      console.error('VAPID keys missing in environment')
      return NextResponse.json({ error: 'Server configuration error (missing keys)' }, { status: 500 })
    }

    webpush.setVapidDetails(
      'mailto:samthelegend68@gmail.com',
      publicKey,
      privateKey
    )
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

    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('Authorization')
    const secretHeader = req.headers.get('x-cron-secret')
    
    // Check if authorized via cron secret
    const isCronAuthorized = cronSecret && (
      secretHeader === cronSecret || 
      authHeader === `Bearer ${cronSecret}`
    )
    
    let isAuthorized = false
    let authorizedBy = ''

    if (isCronAuthorized) {
      isAuthorized = true
      authorizedBy = 'cron'
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email === ALLOWED_EMAIL) {
        isAuthorized = true
        authorizedBy = user.email
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`Push send request authorized by: ${authorizedBy}`)

    const { title, body, url } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Fetch all subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    console.log(`Sending notification to ${subscriptions?.length || 0} subscribers`)

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/IMG_2251.png'
    })

    const results = await Promise.all(
      subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
          return { id: subRecord.id, status: 'success' }
        } catch (error: any) {
          console.error(`Error sending to subscription ${subRecord.id}:`, error)
          
          // If subscription is expired or invalid, remove it from the database
          if (error.statusCode === 404 || error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .match({ id: subRecord.id })
            return { id: subRecord.id, status: 'removed' }
          }
          
          return { id: subRecord.id, status: 'failed', error: error.message }
        }
      })
    )

    return NextResponse.json({ 
      success: true, 
      sentCount: results.filter(r => r.status === 'success').length,
      removedCount: results.filter(r => r.status === 'removed').length,
      failedCount: results.filter(r => r.status === 'failed').length
    })
  } catch (error) {
    console.error('Push send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
