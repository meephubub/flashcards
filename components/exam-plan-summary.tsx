"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { format, differenceInDays, parseISO } from "date-fns"
import { Calendar, Clock, Target, TrendingUp, Archive, Trash2, CheckCircle2, Circle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import type { ExamPlan, ExamPlanSession } from "@/lib/exam-data"
import { getActiveExamPlan, getExamPlanSessions, getExamPlanStats, archiveExamPlan, deleteExamPlan, completeExamSession } from "@/lib/exam-data"
import { getDeckReadiness } from "@/lib/exam-scheduler"
import type { Card as CardType } from "@/lib/supabase"
import { useSettings } from "@/context/settings-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"

interface ExamPlanSummaryProps {
  deckId: number
  cards: CardType[]
  onScheduleNew?: () => void
}

export function ExamPlanSummary({ deckId, cards, onScheduleNew }: ExamPlanSummaryProps) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const supabase = createClient()

  const [plan, setPlan] = useState<ExamPlan | null>(null)
  const [sessions, setSessions] = useState<ExamPlanSession[]>([])
  const [stats, setStats] = useState<{
    totalSessions: number
    completedSessions: number
    upcomingSessions: number
    totalCards: number
    completedCards: number
  } | null>(null)
  const [readiness, setReadiness] = useState<{
    totalCards: number
    readyCards: number
    atRiskCards: number
    averageRetrievability: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const fsrsParams = settings?.studySettings?.fsrsParams || { request_retention: 0.9 }

  useEffect(() => {
    if (!user?.id) return
    loadPlan()
  }, [user?.id, deckId])

  async function loadPlan() {
    setLoading(true)
    const activePlan = await getActiveExamPlan(supabase, user!.id, deckId)
    setPlan(activePlan)

    if (activePlan) {
      // Get upcoming sessions
      const fromDate = new Date().toISOString().split("T")[0]
      const sessionData = await getExamPlanSessions(supabase, activePlan.id, fromDate)
      setSessions(sessionData)

      // Get stats
      const statsData = await getExamPlanStats(supabase, activePlan.id)
      setStats(statsData)

      // Calculate readiness
      const readinessData = getDeckReadiness(cards, activePlan.exam_date, fsrsParams.request_retention)
      setReadiness(readinessData)
    }

    setLoading(false)
  }

  async function handleArchive() {
    if (!plan) return
    const success = await archiveExamPlan(supabase, plan.id)
    if (success) {
      setPlan(null)
      setSessions([])
    }
    setShowArchiveDialog(false)
  }

  async function handleDelete() {
    if (!plan) return
    const success = await deleteExamPlan(supabase, plan.id)
    if (success) {
      setPlan(null)
      setSessions([])
    }
    setShowDeleteDialog(false)
  }

  async function handleCompleteSession(sessionId: string) {
    const success = await completeExamSession(supabase, sessionId)
    if (success) {
      await loadPlan()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
            <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-medium mb-1">No Active Exam Plan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Schedule an exam to optimize your study sessions
          </p>
          <Button onClick={onScheduleNew}>Schedule Exam</Button>
        </CardContent>
      </Card>
    )
  }

  const daysUntilExam = differenceInDays(parseISO(plan.exam_date), new Date())
  const progressPercent = stats ? (stats.completedSessions / Math.max(1, stats.totalSessions)) * 100 : 0
  const cardProgressPercent = stats ? (stats.completedCards / Math.max(1, stats.totalCards)) * 100 : 0

  // Get today's and upcoming sessions
  const today = new Date().toISOString().split("T")[0]
  const todaySession = sessions.find(s => s.session_date === today)
  const upcomingSessions = sessions.filter(s => s.session_date > today).slice(0, 3)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Exam Plan
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {daysUntilExam > 0 ? (
                  <>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{daysUntilExam}</span> days until{" "}
                    <span className="font-medium">{format(parseISO(plan.exam_date), "MMM d, yyyy")}</span>
                  </>
                ) : daysUntilExam === 0 ? (
                  <span className="font-medium text-amber-600">Exam is today!</span>
                ) : (
                  <span className="text-muted-foreground">Exam date passed</span>
                )}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowArchiveDialog(true)}
                title="Archive plan"
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete plan"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          {stats && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sessions</span>
                  <span className="font-medium">
                    {stats.completedSessions} / {stats.totalSessions}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cards</span>
                  <span className="font-medium">
                    {stats.completedCards.toLocaleString()} / {stats.totalCards.toLocaleString()}
                  </span>
                </div>
                <Progress value={cardProgressPercent} className="h-2" />
              </div>
            </div>
          )}

          {/* Readiness */}
          {readiness && (
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Readiness</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold">{Math.round(readiness.averageRetrievability * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Avg Recall</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-600">{readiness.readyCards}</p>
                  <p className="text-xs text-muted-foreground">Ready</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-amber-600">{readiness.atRiskCards}</p>
                  <p className="text-xs text-muted-foreground">At Risk</p>
                </div>
              </div>
              {readiness.atRiskCards > 0 && daysUntilExam <= 7 && (
                <div className="flex items-start gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{readiness.atRiskCards} cards need attention before exam</p>
                </div>
              )}
            </div>
          )}

          {/* Today's Session */}
          {todaySession ? (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Today&apos;s Session</span>
                </div>
                <span className={`
                  text-xs px-2 py-0.5 rounded
                  ${todaySession.focus === 'learning' ? 'bg-neutral-100 dark:bg-neutral-800' : ''}
                  ${todaySession.focus === 'maintenance' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}
                  ${todaySession.focus === 'retrievability' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black' : ''}
                `}>
                  {todaySession.focus.charAt(0).toUpperCase() + todaySession.focus.slice(1)}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>~{todaySession.estimated_minutes} min</span>
                </div>
                <div>
                  <span className="font-medium">{todaySession.review_target}</span>{" "}
                  <span className="text-muted-foreground">reviews</span>
                </div>
                <div>
                  <span className="font-medium">{todaySession.new_target}</span>{" "}
                  <span className="text-muted-foreground">new</span>
                </div>
              </div>

              <div className="flex gap-2">
                {todaySession.completed_at ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Completed
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCompleteSession(todaySession.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Done
                    </Button>
                    <Button size="sm" className="flex-1" asChild>
                      <Link href={`/deck/${deckId}/study`}>
                        Study Now
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              <Circle className="h-5 w-5 mx-auto mb-1 opacity-50" />
              <p>No session scheduled for today</p>
            </div>
          )}

          {/* Upcoming Sessions */}
          {upcomingSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Upcoming</p>
              <div className="space-y-1">
                {upcomingSessions.map(session => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-16">
                        {format(parseISO(session.session_date), "MMM d")}
                      </span>
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded
                        ${session.focus === 'learning' ? 'bg-neutral-100 dark:bg-neutral-800' : ''}
                        ${session.focus === 'maintenance' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}
                        ${session.focus === 'retrievability' ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black' : ''}
                      `}>
                        {session.focus.charAt(0).toUpperCase() + session.focus.slice(1)}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {session.review_target + session.new_target} cards
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Exam Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive your current exam plan. You can create a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your exam plan and all scheduled sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
