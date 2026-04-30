import { type TimelineEvent, type TimelineDay, type TimelineRange, type WorkloadForecast, type TimelineStats } from './timeline-types'
import { format, parseISO, isSameDay, isPast, isFuture, isWithinInterval, addDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'

const TYPE_COLORS = {
  exam: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
  review: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  new: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
  task: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' },
} as const

export function aggregateTimelineEvents(
  examSessions: ExamPlanSession[] = [],
  homeworkTasks: any[] = [],
  cardReviews: any[] = []
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Process exam sessions
  examSessions.forEach(session => {
    events.push({
      id: `exam-${session.id}`,
      type: session.focus === 'learning' ? 'new' : session.focus === 'retrievability' ? 'exam' : 'review',
      title: `${session.review_target + session.new_target} cards - ${session.focus}`,
      description: `${session.deck_name || 'Deck'} • ${session.review_target} reviews, ${session.new_target} new`,
      startDate: session.session_date,
      color: TYPE_COLORS[session.focus === 'learning' ? 'new' : session.focus === 'retrievability' ? 'exam' : 'review'].dot,
      category: session.focus,
      priority: session.focus === 'retrievability' ? 'high' : 'medium',
      metadata: session
    })
  })

  // Process homework tasks
  homeworkTasks.forEach(task => {
    if (!task.due_date) return
    events.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.subject || 'Untitled task',
      description: task.metadata?.note_id ? 'Linked to note' : undefined,
      startDate: task.due_date.split('T')[0],
      color: TYPE_COLORS.task.dot,
      category: 'task',
      priority: task.priority === 3 ? 'high' : task.priority === 2 ? 'medium' : 'low',
      completed: task.done || false,
      metadata: task
    })
  })

  // Process card reviews (due cards)
  cardReviews.forEach(card => {
    if (!card.due_date) return
    events.push({
      id: `review-${card.id}`,
      type: 'review',
      title: card.front?.substring(0, 50) || 'Card review',
      description: `Due for review`,
      startDate: card.due_date.split('T')[0],
      color: TYPE_COLORS.review.dot,
      category: 'review',
      priority: 'medium',
      metadata: card
    })
  })

  // Sort by date
  return events.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function generateTimelineDays(
  events: TimelineEvent[],
  range: TimelineRange,
  today: string = new Date().toISOString().split('T')[0]
): TimelineDay[] {
  const days = eachDayOfInterval({
    start: parseISO(range.start),
    end: parseISO(range.end)
  }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEvents = events.filter(e => e.startDate === dateStr)
    const workload = dayEvents.reduce((sum, e) => {
      if (e.type === 'exam') return sum + 3
      if (e.type === 'review') return sum + 1
      if (e.type === 'new') return sum + 2
      return sum + 1
    }, 0)

    return {
      date: dateStr,
      events: dayEvents,
      workload,
      isToday: dateStr === today,
      isPast: dateStr < today
    }
  })

  return days
}

export function calculateWorkloadForecast(
  events: TimelineEvent[],
  days: number = 30
): WorkloadForecast[] {
  const today = new Date()
  const forecast: WorkloadForecast[] = []

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEvents = events.filter(e => e.startDate === dateStr)
    const workload = dayEvents.reduce((sum, e) => {
      if (e.type === 'exam') return sum + 3
      if (e.type === 'review') return sum + 1
      if (e.type === 'new') return sum + 2
      return sum + 1
    }, 0)

    let level: WorkloadForecast['level'] = 'low'
    if (workload >= 5) level = 'critical'
    else if (workload >= 3) level = 'high'
    else if (workload >= 2) level = 'medium'

    forecast.push({
      date: dateStr,
      workload,
      level,
      events: dayEvents.length
    })
  }

  return forecast
}

export function calculateTimelineStats(events: TimelineEvent[]): TimelineStats {
  const today = new Date().toISOString().split('T')[0]
  const completed = events.filter(e => e.completed).length
  const upcoming = events.filter(e => e.startDate >= today).length
  
  const workloadByDay: Record<string, number> = {}
  events.forEach(event => {
    if (!workloadByDay[event.startDate]) {
      workloadByDay[event.startDate] = 0
    }
    workloadByDay[event.startDate]! += 1
  })

  const workloads = Object.values(workloadByDay)
  const highWorkloadDays = workloads.filter(w => w >= 3).length
  const averageDailyWorkload = workloads.length > 0 
    ? workloads.reduce((a, b) => a + b, 0) / workloads.length 
    : 0
  const maxWorkload = workloads.length > 0 ? Math.max(...workloads) : 0

  return {
    totalEvents: events.length,
    completedEvents: completed,
    upcomingEvents: upcoming,
    highWorkloadDays,
    averageDailyWorkload,
    maxWorkload
  }
}

export function getTimelineRange(view: TimelineView, examDate?: string): TimelineRange {
  const today = new Date()
  const start = startOfDay(today)
  
  switch (view) {
    case 'day':
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(addDays(start, 1), 'yyyy-MM-dd'),
        days: 1
      }
    case 'week':
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(addDays(start, 7), 'yyyy-MM-dd'),
        days: 7
      }
    case 'month':
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(addDays(start, 30), 'yyyy-MM-dd'),
        days: 30
      }
    case 'exam':
      if (examDate) {
        const exam = parseISO(examDate)
        const daysUntilExam = Math.ceil((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: examDate,
          days: Math.max(1, daysUntilExam + 1)
        }
      }
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(addDays(start, 7), 'yyyy-MM-dd'),
        days: 7
      }
  }
}