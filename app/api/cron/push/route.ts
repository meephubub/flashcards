import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

// This endpoint is called by Supabase cron or Vercel cron to process scheduled notifications
export async function GET(req: Request) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('Authorization')
    const secretHeader = req.headers.get('x-cron-secret')
    
    const isCronAuthorized = cronSecret && (
      secretHeader === cronSecret || 
      authHeader === `Bearer ${cronSecret}`
    )

    if (!isCronAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Configure web-push
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      console.error('VAPID keys missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    webpush.setVapidDetails(
      'mailto:samthelegend68@gmail.com',
      publicKey,
      privateKey
    )

    // Use service role client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50)

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({ message: 'No pending notifications', processed: 0 })
    }

    console.log(`Processing ${pendingNotifications.length} scheduled notifications`)

    const results = []

    for (const notification of pendingNotifications) {
      try {
        // Fetch subscriptions for this notification
        let query = supabase
          .from('push_subscriptions')
          .select('id, subscription, user_id')

        // If user_ids array is specified, only send to those users
        if (notification.user_ids && Array.isArray(notification.user_ids) && notification.user_ids.length > 0) {
          query = query.in('user_id', notification.user_ids)
        }

        const { data: subscriptions, error: subError } = await query

        if (subError) {
          console.error(`Error fetching subscriptions for notification ${notification.id}:`, subError)
          
          // Mark as failed
          await supabase
            .from('scheduled_notifications')
            .update({ 
              status: 'failed', 
              error_message: subError.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          
          results.push({ id: notification.id, status: 'failed', error: subError.message })
          continue
        }

        if (!subscriptions || subscriptions.length === 0) {
          // No subscriptions to send to, mark as sent (nothing to do)
          await supabase
            .from('scheduled_notifications')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id)
          
          results.push({ id: notification.id, status: 'sent', sentCount: 0 })
          continue
        }

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          url: notification.url || '/',
          icon: '/IMG_2251.png'
        })

        let sentCount = 0
        let removedCount = 0

        // Send to all subscriptions
        await Promise.all(
          subscriptions.map(async (subRecord: any) => {
            try {
              await webpush.sendNotification(subRecord.subscription, payload)
              sentCount++
            } catch (error: any) {
              console.error(`Error sending to subscription ${subRecord.id}:`, error)
              
              // Remove expired/invalid subscriptions
              if (error.statusCode === 404 || error.statusCode === 410) {
                await supabase
                  .from('push_subscriptions')
                  .delete()
                  .match({ id: subRecord.id })
                removedCount++
              }
            }
          })
        )

        // Mark notification as sent
        await supabase
          .from('scheduled_notifications')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id)

        results.push({ 
          id: notification.id, 
          status: 'sent', 
          sentCount, 
          removedCount 
        })

      } catch (error: any) {
        console.error(`Error processing notification ${notification.id}:`, error)
        
        await supabase
          .from('scheduled_notifications')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id)
        
        results.push({ id: notification.id, status: 'failed', error: error.message })
      }
    }

    const summary = {
      processed: results.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    }

    console.log('Cron job complete:', summary)
    return NextResponse.json(summary)

  } catch (error) {
    console.error('Cron push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support POST for flexibility
export async function POST(req: Request) {
  return GET(req)
}
