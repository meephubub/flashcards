import type { ExamPlanSession } from './exam-data'
import type { HomeworkRow } from '@/types'

export type TimelineView = 'day' | 'week' | 'month' | 'exam'

export interface TimelineEvent {
  id: string
  type: 'exam' | 'review' | 'new' | 'task'
  title: string
  description?: string
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
  color: string
  category: string
  metadata?: any
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
}

export interface TimelineDay {
  date: string
  events: TimelineEvent[]
  workload: number
  isToday: boolean
  isPast: boolean
}

export interface TimelineRange {
  start: string
  end: string
  days: number
}

export interface WorkloadForecast {
  date: string
  workload: number
  level: 'low' | 'medium' | 'high' | 'critical'
  events: number
}

export interface TimelineStats {
  totalEvents: number
  completedEvents: number
  upcomingEvents: number
  highWorkloadDays: number
  averageDailyWorkload: number
  maxWorkload: number
}