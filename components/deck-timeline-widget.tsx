"use client"

import React from "react"
import { Calendar, Clock, Target, AlertCircle } from "lucide-react"
import { format, parseISO, differenceInDays } from "date-fns"
import type { ExamPlanSession } from "@/lib/exam-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface DeckTimelineWidgetProps {
  examSessions?: ExamPlanSession[]
  cardsDueSoon?: number
  className?: string
}

export function DeckTimelineWidget({
  examSessions = [],
  cardsDueSoon = 0,
  className
}: DeckTimelineWidgetProps) {
  const today = new Date().toISOString().split("T")[0]
  
  const upcomingSessions = examSessions
    .filter(s => s.session_date >= today)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 5)

  const todaySession = examSessions.find(s => s.session_date === today)
  
  const nextExamDate = examSessions.length > 0 
    ? examSessions.reduce((earliest, session) => 
        session.session_date < earliest.session_date ? session : earliest
      ).session_date
    : null

  const daysUntilExam = nextExamDate 
    ? differenceInDays(parseISO(nextExamDate), new Date())
    : null

  if (upcomingSessions.length === 0 && !todaySession) {
    return (
      <Card className={cn("border-neutral-200 dark:border-neutral-800", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <CardTitle className="text-sm">Revision Timeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-neutral-500">No scheduled sessions</p>
            <p className="text-xs text-neutral-400 mt-1">Schedule an exam to get started</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-neutral-200 dark:border-neutral-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-500" />
            <CardTitle className="text-sm">Revision Timeline</CardTitle>
          </div>
          {daysUntilExam !== null && daysUntilExam >= 0 && (
            <Badge 
              variant={daysUntilExam <= 7 ? "destructive" : "secondary"}
              className="text-xs"
            >
              {daysUntilExam === 0 ? "Exam Today" : `${daysUntilExam}d to exam`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Session */}
        {todaySession && (
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 p-3 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-neutral-500">Today</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded ml-auto",
                todaySession.focus === 'learning' ? "bg-neutral-200 dark:bg-neutral-700" :
                todaySession.focus === 'maintenance' ? "bg-neutral-300 dark:bg-neutral-600" :
                "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black"
              )}>
                {todaySession.focus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{todaySession.review_target + todaySession.new_target} cards</div>
                <div className="text-xs text-neutral-500">
                  {todaySession.review_target} reviews · {todaySession.new_target} new
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <Clock className="w-3 h-3" />
                ~{todaySession.estimated_minutes}m
              </div>
            </div>
          </div>
        )}

        {/* Cards Due Soon */}
        {cardsDueSoon > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {cardsDueSoon} card{cardsDueSoon > 1 ? 's' : ''} due for review
            </span>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Upcoming
            </div>
            <div className="space-y-1">
              {upcomingSessions.map((session) => {
                const daysUntil = differenceInDays(parseISO(session.session_date), new Date())
                const isTomorrow = daysUntil === 1
                
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        session.focus === 'learning' && "bg-green-500",
                        session.focus === 'maintenance' && "bg-blue-500",
                        session.focus === 'retrievability' && "bg-red-500"
                      )} />
                      <span className="text-xs text-neutral-500">
                        {isTomorrow ? "Tomorrow" : format(parseISO(session.session_date), "MMM d")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">
                        {session.review_target + session.new_target} cards
                      </span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded",
                        session.focus === 'learning' && "bg-neutral-200 dark:bg-neutral-700",
                        session.focus === 'maintenance' && "bg-neutral-300 dark:bg-neutral-600",
                        session.focus === 'retrievability' && "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black"
                      )}>
                        {session.focus}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Progress Overview */}
        {nextExamDate && daysUntilExam !== null && daysUntilExam > 0 && (
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500">Exam preparation</span>
              <span className="text-xs font-medium">
                {Math.max(0, 100 - (daysUntilExam * 8))}% complete
              </span>
            </div>
            <Progress 
              value={Math.max(0, Math.min(100, 100 - (daysUntilExam * 8)))} 
              className="h-1"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}