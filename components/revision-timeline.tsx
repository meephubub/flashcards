"use client"

import { useState, useMemo, useEffect } from 'react'
import { format, isSameDay, isPast, parseISO } from 'date-fns'
import { Calendar, Clock, CheckCircle2, Circle, AlertCircle, Target, BookOpen, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineEvent, TimelineDay, TimelineView, WorkloadForecast, TimelineStats } from './timeline-types'
import { aggregateTimelineEvents, generateTimelineDays, calculateWorkloadForecast, calculateTimelineStats, getTimelineRange } from './timeline'

interface RevisionTimelineProps {
  examSessions?: any[]
  homeworkTasks?: any[]
  cardReviews?: any[]
  examDate?: string
  className?: string
}

export function RevisionTimeline({
  examSessions = [],
  homeworkTasks = [],
  cardReviews = [],
  examDate,
  className
}: RevisionTimelineProps) {
  const [view, setView] = useState<TimelineView>('week')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]

  const events = useMemo(() => 
    aggregateTimelineEvents(examSessions, homeworkTasks, cardReviews),
    [examSessions, homeworkTasks, cardReviews]
  )

  const range = useMemo(() => getTimelineRange(view, examDate), [view, examDate])
  
  const days = useMemo(() => 
    generateTimelineDays(events, range, today),
    [events, range, today]
  )

  const forecast = useMemo(() => 
    calculateWorkloadForecast(events, 14),
    [events]
  )

  const stats = useMemo(() => 
    calculateTimelineStats(events),
    [events]
  )

  const selectedDayEvents = selectedDate 
    ? days.find(d => d.date === selectedDate)?.events || []
    : days.find(d => d.isToday)?.events || []

  const getWorkloadColor = (level: WorkloadForecast['level']) => {
    switch (level) {
      case 'critical': return 'bg-red-500/30 border-red-500/50'
      case 'high': return 'bg-orange-500/30 border-orange-500/50'
      case 'medium': return 'bg-blue-500/30 border-blue-500/50'
      case 'low': return 'bg-neutral-500/20 border-neutral-500/30'
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-neutral-100">Revision Timeline</h2>
            <p className="text-xs text-neutral-500">{range.days} days overview</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('day')}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-all",
              view === 'day'
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            )}
          >
            Day
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-all",
              view === 'week'
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            )}
          >
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-all",
              view === 'month'
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            )}
          >
            Month
          </button>
          {examDate && (
            <button
              onClick={() => setView('exam')}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-all",
                view === 'exam'
                  ? "bg-red-500/20 text-red-400"
                  : "text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              Exam
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800/50 bg-neutral-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neutral-500" />
            <span className="text-xs text-neutral-500">{stats.totalEvents} total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-neutral-500">{stats.upcomingEvents} upcoming</span>
          </div>
          {stats.highWorkloadDays > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-amber-500">{stats.highWorkloadDays} busy days</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Main Timeline */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {days.map((day) => {
              const hasEvents = day.events.length > 0
              const isSelected = selectedDate === day.date
              
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(isSelected ? null : day.date)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl mb-3 transition-all border",
                    day.isToday
                      ? "border-neutral-700 bg-neutral-800/50"
                      : day.isPast
                      ? "border-neutral-800/50 bg-neutral-900/30"
                      : "border-neutral-800/50 bg-neutral-900/20 hover:bg-neutral-800/30 hover:border-neutral-700",
                    isSelected && "border-neutral-700 bg-neutral-800/50 ring-1 ring-neutral-700"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-300">
                          {format(parseISO(day.date), 'EEE')}
                        </span>
                        <span className="text-sm text-neutral-500">
                          {format(parseISO(day.date), 'MMM d')}
                        </span>
                        {day.isToday && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-700 text-neutral-300">
                            Today
                          </span>
                        )}
                      </div>
                      {hasEvents && (
                        <span className="text-xs text-neutral-500 mt-0.5">
                          {day.events.length} event{day.events.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {day.workload > 0 && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(day.workload, 4) }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              day.workload >= 4 ? "bg-red-500/60" :
                              day.workload >= 3 ? "bg-orange-500/60" :
                              day.workload >= 2 ? "bg-blue-500/60" :
                              "bg-neutral-500/60"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {isSelected && hasEvents && (
                    <div className="space-y-2 pt-3 border-t border-neutral-800/50">
                      {day.events.map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            event.type === 'exam' && "border-red-500/30 bg-red-500/10",
                            event.type === 'review' && "border-blue-500/30 bg-blue-500/10",
                            event.type === 'new' && "border-green-500/30 bg-green-500/10",
                            event.type === 'task' && "border-purple-500/30 bg-purple-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full flex-shrink-0",
                                    event.type === 'exam' && "bg-red-500",
                                    event.type === 'review' && "bg-blue-500",
                                    event.type === 'new' && "bg-green-500",
                                    event.type === 'task' && "bg-purple-500"
                                  )}
                                />
                                <span className="text-sm font-medium text-neutral-200 truncate">
                                  {event.title}
                                </span>
                              </div>
                              {event.description && (
                                <p className="text-xs text-neutral-500 mt-1 ml-4">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            {event.priority === 'high' && (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasEvents && (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-neutral-600 text-sm">No events</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Workload Forecast Sidebar */}
        <div className="w-64 border-l border-neutral-800 bg-neutral-900/50">
          <div className="p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Workload Forecast
            </h3>
            <div className="space-y-2">
              {forecast.slice(0, 7).map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    getWorkloadColor(day.level),
                    day.workload === 0 && "opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">
                      {format(parseISO(day.date), 'MMM d')}
                    </span>
                    {day.workload > 0 && (
                      <span className="text-xs font-medium text-neutral-300">
                        {day.workload}
                      </span>
                    )}
                  </div>
                  {day.events > 0 && (
                    <div className="mt-1 h-1.5 bg-neutral-800/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-400 transition-all"
                        style={{ width: `${Math.min(100, (day.events / stats.maxWorkload) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {examDate && (
            <div className="p-4 border-t border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Exam Countdown
                </span>
              </div>
              <div className="text-center">
                <div className="text-3xl font-light text-neutral-300">
                  {Math.ceil((parseISO(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-xs text-neutral-500">days remaining</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}