
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { sessionId, type, subjectId } = body

        if (!sessionId || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Upsert activity
        // We first try to select to see if it exists to get the start_time
        const { data: existingActivity } = await supabase
            .from('user_activity')
            .select('start_time')
            .eq('session_id', sessionId)
            .single()

        const now = new Date().toISOString()
        let result

        if (existingActivity) {
            // Update
            const startTime = new Date(existingActivity.start_time)
            const durationSeconds = Math.round((new Date().getTime() - startTime.getTime()) / 1000)

            result = await supabase
                .from('user_activity')
                .update({
                    last_heartbeat: now,
                    duration_seconds: durationSeconds,
                    updated_at: now
                })
                .eq('session_id', sessionId)
        } else {
            // Insert
            result = await supabase
                .from('user_activity')
                .insert({
                    user_id: user.id,
                    session_id: sessionId,
                    activity_type: type,
                    subject_id: subjectId,
                    start_time: now,
                    last_heartbeat: now,
                    duration_seconds: 0
                })
        }

        if (result.error) {
            console.error('Error recording activity:', result.error)
            return NextResponse.json({ error: result.error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Heartbeat error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
