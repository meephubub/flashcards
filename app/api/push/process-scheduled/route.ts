import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@example.com'
const VAPID_CONTACT = VAPID_CONTACT_EMAIL.startsWith('mailto:') ? VAPID_CONTACT_EMAIL : `mailto:${VAPID_CONTACT_EMAIL}`

export async function POST(req: Request) {
  try {
    // Auth: only cron secret
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
      return NextResponse.json({ error: 'VAPID keys missing' }, { status: 500 })
    }

    webpush.setVapidDetails(VAPID_CONTACT, publicKey, privateKey)

    const admin = createAdminClient()

    // Find pending notifications that are due
    const { data: pending, error: fetchError } = await admin
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch pending' }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    console.log(`Processing ${pending.length} scheduled notifications`)

    const results = []

    for (const notification of pending) {
      try {
        // Build subscription query
        let query = admin.from('push_subscriptions').select('id, subscription, user_id')

        if (notification.target_user_ids && notification.target_user_ids.length > 0) {
          query = query.in('user_id', notification.target_user_ids)
        }

        const { data: subscriptions, error: subError } = await query

        if (subError) {
          console.error(`Error fetching subs for notification ${notification.id}:`, subError)
          await admin
            .from('scheduled_notifications')
            .update({ status: 'failed', result: { error: subError.message }, sent_at: new Date().toISOString() })
            .eq('id', notification.id)
          results.push({ id: notification.id, status: 'failed' })
          continue
        }

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          url: notification.url || '/',
          icon: '/IMG_2251.png',
        })

        let sentCount = 0
        let failedCount = 0
        let removedCount = 0

        const sendResults = await Promise.all(
          (subscriptions || []).map(async (subRecord: any) => {
            try {
              await webpush.sendNotification(subRecord.subscription, payload)
              sentCount++
              return { id: subRecord.id, status: 'success' }
            } catch (error: any) {
              if (error.statusCode === 404 || error.statusCode === 410) {
                await admin.from('push_subscriptions').delete().match({ id: subRecord.id })
                removedCount++
                return { id: subRecord.id, status: 'removed' }
              }
              failedCount++
              return { id: subRecord.id, status: 'failed' }
            }
          })
        )

        await admin
          .from('scheduled_notifications')
          .update({
            status: 'sent',
            result: { sentCount, failedCount, removedCount },
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id)

        results.push({ id: notification.id, status: 'sent', sentCount, failedCount, removedCount })
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error)
        await admin
          .from('scheduled_notifications')
          .update({ status: 'failed', result: { error: String(error) }, sent_at: new Date().toISOString() })
          .eq('id', notification.id)
        results.push({ id: notification.id, status: 'failed' })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('Process scheduled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
