
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActivityStat {
    date: string
    duration_seconds: number
    activity_type: string
    subject_id: string | null
}

export interface SubjectDuration {
    subject_id: string
    subject_name: string
    duration_seconds: number
    activity_type: string
}

/**
 * Get activity stats for the last N days
 */
export async function getActivityStats(
    supabase: SupabaseClient,
    userId: string,
    days: number = 7
): Promise<ActivityStat[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
        .from('user_activity')
        .select('start_time, duration_seconds, activity_type, subject_id')
        .eq('user_id', userId)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true })

    if (error) {
        console.error('Error fetching activity stats:', error)
        return []
    }

    // Transform to friendlier format
    return data.map(row => ({
        date: new Date(row.start_time).toISOString().split('T')[0],
        duration_seconds: row.duration_seconds,
        activity_type: row.activity_type,
        subject_id: row.subject_id
    }))
}

/**
 * Get total duration per subject for the last N days
 */
export async function getSubjectDurations(
    supabase: SupabaseClient,
    userId: string,
    days: number = 7
): Promise<SubjectDuration[]> {
    const stats = await getActivityStats(supabase, userId, days)

    // Fetch deck names for mapping
    const { data: decks } = await supabase
        .from('decks')
        .select('id, name')
        .eq('user_id', userId)

    const deckMap = new Map<string, string>()
    if (decks) {
        decks.forEach(d => deckMap.set(d.id.toString(), d.name))
    }

    const subjectMap = new Map<string, number>()

    stats.forEach(stat => {
        if (!stat.subject_id) return

        // Key by subject_id
        const key = stat.subject_id
        const current = subjectMap.get(key) || 0
        subjectMap.set(key, current + stat.duration_seconds)
    })

    return Array.from(subjectMap.entries()).map(([subject_id, duration]) => {
        const sample = stats.find(s => s.subject_id === subject_id)
        const activityType = sample?.activity_type || 'unknown'

        let subjectName = subject_id
        if (activityType === 'review' || activityType === 'study') {
            subjectName = deckMap.get(subject_id) || `Deck ${subject_id}`
        } else if (activityType === 'essay') {
            subjectName = "Essay Writing"
        } else {
            // Capitalize first letter of activity type or subject_id
            subjectName = subject_id.charAt(0).toUpperCase() + subject_id.slice(1)
        }

        return {
            subject_id,
            subject_name: subjectName,
            duration_seconds: duration,
            activity_type: activityType
        }
    })
}

export async function getUserHeatmap(
    supabase: SupabaseClient,
    userId: string
): Promise<{ date: string; count: number }[]> {
    const { data, error } = await supabase
        .from('user_activity')
        .select('start_time, duration_seconds')
        .eq('user_id', userId)
        .order('start_time', { ascending: true })

    if (error) return []

    // Group by day YYYY-MM-DD
    const counts: Record<string, number> = {}
    data.forEach(row => {
        if (row.duration_seconds < 30) return // Ignore trivial <30s
        const day = new Date(row.start_time).toISOString().split('T')[0]
        // Count magnitude of activity (e.g. 1 point per minute)
        const points = Math.ceil(row.duration_seconds / 60)
        counts[day] = (counts[day] || 0) + points
    })

    return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

export async function getUserStreak(
    supabase: SupabaseClient,
    userId: string
): Promise<{ currentStreak: number; longestStreak: number }> {
    const { data, error } = await supabase
        .from('user_activity')
        .select('start_time')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })

    if (error || !data) return { currentStreak: 0, longestStreak: 0 }

    // Unique days sorted desc
    const days = Array.from(new Set(data.map(d => new Date(d.start_time).toISOString().split('T')[0])))

    if (days.length === 0) return { currentStreak: 0, longestStreak: 0 }

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Calculate current
    if (days[0] === today) {
        currentStreak = 1
    } else if (days[0] === yesterday) {
        currentStreak = 1 // will be incremented in loop if strictly sequential? No, simple logic:
    }

    // Actually, simple loop approach
    // convert to Date objects to check difference

    const dateObjs = days.map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime()) // Descending

    // Current Streak
    // If most recent is today or yesterday, we have a live streak.
    const lastActive = dateObjs[0]
    const diffToLast = (new Date(today).getTime() - lastActive.getTime()) / (1000 * 3600 * 24)

    if (diffToLast <= 1.5) { // 1.5 allows for timezone fuzziness approx, simple check
        currentStreak = 1
        for (let i = 0; i < dateObjs.length - 1; i++) {
            const diff = (dateObjs[i].getTime() - dateObjs[i + 1].getTime()) / (1000 * 3600 * 24)
            if (Math.abs(diff - 1) < 0.1) {
                currentStreak++
            } else {
                break
            }
        }
    }

    // Longest Streak
    tempStreak = 1
    longestStreak = 1
    for (let i = 0; i < dateObjs.length - 1; i++) {
        const diff = (dateObjs[i].getTime() - dateObjs[i + 1].getTime()) / (1000 * 3600 * 24)
        if (Math.abs(diff - 1) < 0.1) {
            tempStreak++
        } else {
            if (tempStreak > longestStreak) longestStreak = tempStreak
            tempStreak = 1
        }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak

    return { currentStreak, longestStreak }
}
