// Exam planning data operations
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamSession } from './exam-scheduler'

export interface ExamPlan {
  id: string
  user_id: string
  deck_id: number
  exam_date: string
  strategy: 'start_today' | 'with_breaks' | 'start_later'
  status: 'active' | 'archived' | 'completed'
  daily_review_cap: number
  daily_new_cap: number
  estimated_minutes_per_day: number
  retrievability_window_days: number
  created_at: string
  updated_at: string
}

export interface ExamPlanSession {
  id: string
  exam_plan_id: string
  user_id: string
  deck_id: number
  session_date: string
  new_target: number
  review_target: number
  focus: 'learning' | 'maintenance' | 'retrievability'
  estimated_minutes: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Create a new exam plan with sessions
 */
export async function createExamPlan(
  supabase: SupabaseClient,
  userId: string,
  deckId: number,
  examDate: string,
  strategy: 'start_today' | 'with_breaks' | 'start_later',
  sessions: ExamSession[],
  config: {
    dailyReviewCap: number
    dailyNewCap: number
    estimatedMinutesPerDay: number
    retrievabilityWindowDays: number
  }
): Promise<{ plan: ExamPlan | null; error: Error | null }> {
  try {
    // Create the plan
    const { data: plan, error: planError } = await supabase
      .from('exam_plans')
      .insert({
        user_id: userId,
        deck_id: deckId,
        exam_date: examDate,
        strategy,
        status: 'active',
        daily_review_cap: config.dailyReviewCap,
        daily_new_cap: config.dailyNewCap,
        estimated_minutes_per_day: config.estimatedMinutesPerDay,
        retrievability_window_days: config.retrievabilityWindowDays
      })
      .select()
      .single()

    if (planError || !plan) {
      return { plan: null, error: planError || new Error('Failed to create exam plan') }
    }

    // Create sessions
    const sessionRows = sessions.map(s => ({
      exam_plan_id: plan.id,
      user_id: userId,
      deck_id: deckId,
      session_date: s.date,
      new_target: s.newTarget,
      review_target: s.reviewTarget,
      focus: s.focus,
      estimated_minutes: s.estimatedMinutes
    }))

    const { error: sessionsError } = await supabase
      .from('exam_plan_sessions')
      .insert(sessionRows)

    if (sessionsError) {
      console.error('Error creating exam sessions:', sessionsError)
      // Don't fail the whole operation if sessions fail
    }

    // Create corresponding homework tasks for each session
    await createHomeworkTasksForSessions(supabase, userId, deckId, plan.id, sessions)

    return { plan, error: null }
  } catch (error) {
    return { plan: null, error: error as Error }
  }
}

/**
 * Create homework tasks for exam sessions
 */
async function createHomeworkTasksForSessions(
  supabase: SupabaseClient,
  userId: string,
  deckId: number,
  examPlanId: string,
  sessions: ExamSession[]
): Promise<void> {
  const tasks = sessions.map(s => {
    const focusLabel = s.focus === 'learning' ? 'Learning' : s.focus === 'maintenance' ? 'Maintenance' : 'Retrievability'
    return {
      user_id: userId,
      due_date: s.date,
      subject: `Revision Session: ${focusLabel}`,
      priority: s.focus === 'retrievability' ? 3 : s.focus === 'learning' ? 2 : 1,
      done: false,
      reminder_minutes: 60,
      metadata: {
        type: 'exam_session',
        deckId,
        examPlanId,
        sessionDate: s.date,
        newTarget: s.newTarget,
        reviewTarget: s.reviewTarget,
        focus: s.focus,
        estimatedMinutes: s.estimatedMinutes
      }
    }
  })

  const { error } = await supabase.from('homework').insert(tasks)

  if (error) {
    console.error('Error creating homework tasks:', error)
  }

  // Schedule push notifications for each session (1 hour before due date)
  await scheduleSessionNotifications(supabase, userId, deckId, sessions)
}

/**
 * Schedule push notifications for exam sessions
 */
async function scheduleSessionNotifications(
  supabase: SupabaseClient,
  userId: string,
  deckId: number,
  sessions: ExamSession[]
): Promise<void> {
  // Get deck name for the notification
  const { data: deck } = await supabase
    .from('decks')
    .select('name')
    .eq('id', deckId)
    .single()

  const deckName = deck?.name || 'Your deck'

  // Schedule notifications for each session (due date at 9am)
  const notifications = sessions.map(s => {
    const sessionDate = new Date(s.date)
    sessionDate.setHours(9, 0, 0, 0) // 9 AM on the session date

    const focusLabel = s.focus === 'learning' ? 'Learning' : s.focus === 'maintenance' ? 'Maintenance' : 'Retrievability'

    return {
      title: `Revision Session: ${deckName}`,
      body: `${focusLabel} phase: ${s.reviewTarget} reviews, ${s.newTarget} new cards (~${s.estimatedMinutes} min)`,
      url: `/deck/${deckId}/study`,
      target_user_ids: [userId],
      scheduled_at: sessionDate.toISOString(),
      status: 'pending'
    }
  })

  const { error } = await supabase.from('scheduled_notifications').insert(notifications)

  if (error) {
    console.error('Error scheduling session notifications:', error)
  }
}

/**
 * Get active exam plan for a deck
 */
export async function getActiveExamPlan(
  supabase: SupabaseClient,
  userId: string,
  deckId: number
): Promise<ExamPlan | null> {
  const { data, error } = await supabase
    .from('exam_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as ExamPlan
}

/**
 * Get sessions for an exam plan
 */
export async function getExamPlanSessions(
  supabase: SupabaseClient,
  planId: string,
  fromDate?: string,
  toDate?: string
): Promise<ExamPlanSession[]> {
  let query = supabase
    .from('exam_plan_sessions')
    .select('*')
    .eq('exam_plan_id', planId)
    .order('session_date', { ascending: true })

  if (fromDate) {
    query = query.gte('session_date', fromDate)
  }

  if (toDate) {
    query = query.lte('session_date', toDate)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data as ExamPlanSession[]
}

/**
 * Get upcoming sessions for a user
 */
export async function getUpcomingExamSessions(
  supabase: SupabaseClient,
  userId: string,
  days: number = 7
): Promise<(ExamPlanSession & { deck_name: string })[]> {
  const fromDate = new Date().toISOString().split('T')[0]
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + days)
  const toDateStr = toDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('exam_plan_sessions')
    .select(`
      *,
      decks!inner(name)
    `)
    .eq('user_id', userId)
    .is('completed_at', null)
    .gte('session_date', fromDate)
    .lte('session_date', toDateStr)
    .order('session_date', { ascending: true })
    .limit(50)

  if (error || !data) {
    console.error('Error fetching upcoming sessions:', error)
    return []
  }

  return data.map(row => ({
    ...row,
    deck_name: row.decks?.name || 'Unknown Deck'
  })) as (ExamPlanSession & { deck_name: string })[]
}

/**
 * Mark a session as completed
 */
export async function completeExamSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('exam_plan_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    console.error('Error completing session:', error)
    return false
  }

  return true
}

/**
 * Archive an exam plan
 */
export async function archiveExamPlan(
  supabase: SupabaseClient,
  planId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('exam_plans')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString()
    })
    .eq('id', planId)

  if (error) {
    console.error('Error archiving exam plan:', error)
    return false
  }

  return true
}

/**
 * Delete an exam plan and all its sessions
 */
export async function deleteExamPlan(
  supabase: SupabaseClient,
  planId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('exam_plans')
    .delete()
    .eq('id', planId)

  if (error) {
    console.error('Error deleting exam plan:', error)
    return false
  }

  return true
}

/**
 * Get exam plan stats
 */
export async function getExamPlanStats(
  supabase: SupabaseClient,
  planId: string
): Promise<{
  totalSessions: number
  completedSessions: number
  upcomingSessions: number
  totalCards: number
  completedCards: number
}> {
  const { data: sessions, error } = await supabase
    .from('exam_plan_sessions')
    .select('*')
    .eq('exam_plan_id', planId)

  if (error || !sessions) {
    return {
      totalSessions: 0,
      completedSessions: 0,
      upcomingSessions: 0,
      totalCards: 0,
      completedCards: 0
    }
  }

  const completed = sessions.filter(s => s.completed_at).length
  const totalCards = sessions.reduce((sum, s) => sum + s.new_target + s.review_target, 0)
  const completedCards = sessions
    .filter(s => s.completed_at)
    .reduce((sum, s) => sum + s.new_target + s.review_target, 0)

  return {
    totalSessions: sessions.length,
    completedSessions: completed,
    upcomingSessions: sessions.length - completed,
    totalCards,
    completedCards
  }
}
