"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { format, differenceInDays } from "date-fns"
import { CalendarIcon, Loader2, TrendingUp, BookOpen, Target, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/context/settings-context"
import type { Card } from "@/lib/supabase"
import { generateExamSchedule, getDeckReadiness, formatSessionSummary, type ExamSession } from "@/lib/exam-scheduler"
import { createExamPlan } from "@/lib/exam-data"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"

interface ScheduleExamModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deck: { id: number; name?: string }
  cards: Card[]
  onScheduled?: () => void
}

interface StrategyOption {
  id: "start_today" | "with_breaks" | "start_later"
  label: string
  description: string
  repetitions: string
  bestFor: string
}

const strategies: StrategyOption[] = [
  {
    id: "start_today",
    label: "Start Today",
    description: "Learn now, practice until exam.",
    repetitions: "~6 repetitions per card",
    bestFor: "Best for exams in the next few weeks."
  },
  {
    id: "with_breaks",
    label: "Start Today, With Breaks",
    description: "Learn now, reinforce before exam.",
    repetitions: "~4 repetitions per card",
    bestFor: "Best for exams in a few months."
  },
  {
    id: "start_later",
    label: "Start Later",
    description: "Start learning closer to the exam.",
    repetitions: "~4 repetitions per card",
    bestFor: "Best for imported cards or cramming."
  }
]

export function ScheduleExamModal({
  open,
  onOpenChange,
  deck,
  cards,
  onScheduled
}: ScheduleExamModalProps) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const supabase = createClient()

  const [examDate, setExamDate] = useState<Date | undefined>(undefined)
  const [strategy, setStrategy] = useState<"start_today" | "with_breaks" | "start_later">("start_today")
  const [dailyReviewCap, setDailyReviewCap] = useState(50)
  const [dailyNewCap, setDailyNewCap] = useState(20)
  const [retrievabilityWindow, setRetrievabilityWindow] = useState(7)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewSessions, setPreviewSessions] = useState<ExamSession[] | null>(null)
  const [readiness, setReadiness] = useState<{
    totalCards: number
    readyCards: number
    atRiskCards: number
    averageRetrievability: number
  } | null>(null)

  // Get FSRS params from settings
  const fsrsParams = settings?.studySettings?.fsrsParams || {
    request_retention: 0.9,
    maximum_interval: 36500,
    w: [0.40255, 1.18385, 3.173, 15.69105, 7.19605, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2711, 0.28755, 2.9748, 0.43255, 0.5529]
  }

  // Generate preview when inputs change
  useEffect(() => {
    if (!examDate || !cards.length) {
      setPreviewSessions(null)
      setReadiness(null)
      return
    }

    const dateStr = examDate.toISOString().split("T")[0]

    // Calculate current readiness
    const currentReadiness = getDeckReadiness(cards, dateStr, fsrsParams.request_retention)
    setReadiness(currentReadiness)

    // Generate preview schedule
    const sessions = generateExamSchedule(cards, {
      examDate: dateStr,
      strategy,
      dailyReviewCap,
      dailyNewCap,
      estimatedMinutesPerDay: 15,
      retrievabilityWindowDays: retrievabilityWindow
    }, fsrsParams)

    setPreviewSessions(sessions)
  }, [examDate, strategy, dailyReviewCap, dailyNewCap, retrievabilityWindow, cards, fsrsParams])

  const handleConfirm = useCallback(async () => {
    if (!examDate || !user?.id || !previewSessions?.length) return

    setIsGenerating(true)

    try {
      const dateStr = examDate.toISOString().split("T")[0]

      const { plan, error } = await createExamPlan(
        supabase,
        user.id,
        deck.id,
        dateStr,
        strategy,
        previewSessions,
        {
          dailyReviewCap,
          dailyNewCap,
          estimatedMinutesPerDay: 15,
          retrievabilityWindowDays: retrievabilityWindow
        }
      )

      if (error) {
        console.error("Error creating exam plan:", error)
        return
      }

      if (plan) {
        onOpenChange(false)
        onScheduled?.()
      }
    } finally {
      setIsGenerating(false)
    }
  }, [examDate, user?.id, previewSessions, deck.id, strategy, dailyReviewCap, dailyNewCap, retrievabilityWindow, supabase, onOpenChange, onScheduled])

  const summary = previewSessions ? formatSessionSummary(previewSessions) : null
  const daysUntilExam = examDate ? differenceInDays(examDate, new Date()) : 0

  // Generate histogram data for visualization
  const histogramData = previewSessions
    ? previewSessions.map((s, i) => {
        const total = s.newTarget + s.reviewTarget
        return {
          day: i,
          new: s.newTarget,
          review: s.reviewTarget,
          total,
          focus: s.focus
        }
      })
    : []

  const maxValue = Math.max(...histogramData.map(d => d.total), 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Schedule Exam</DialogTitle>
          <DialogDescription>
            We&apos;ll optimize your practice schedule for the best recall on your exam date.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            {/* Exam Date */}
            <div className="space-y-2">
              <Label>Exam Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !examDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {examDate ? format(examDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={examDate}
                    onSelect={setExamDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {examDate && (
                <p className="text-sm text-muted-foreground">
                  {daysUntilExam > 0 ? `${daysUntilExam} days until exam` : "Exam is today"}
                </p>
              )}
            </div>

            {/* Strategy Selection */}
            <div className="space-y-3">
              <Label>Which study plan suits you best?</Label>
              <RadioGroup
                value={strategy}
                onValueChange={(v) => setStrategy(v as typeof strategy)}
                className="space-y-3"
              >
                {strategies.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      strategy === s.id
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-900"
                        : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                    )}
                    onClick={() => setStrategy(s.id)}
                  >
                    <RadioGroupItem value={s.id} id={s.id} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={s.id} className="font-medium cursor-pointer">
                          {s.label}
                        </Label>
                        {s.id === "with_breaks" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            Suggested
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{s.description}</p>
                      <p className="text-xs text-muted-foreground">{s.repetitions}</p>
                      <p className="text-xs text-muted-foreground">{s.bestFor}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Daily Limits */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Daily Review Cap</Label>
                  <span className="text-sm text-muted-foreground">{dailyReviewCap} cards</span>
                </div>
                <Slider
                  value={[dailyReviewCap]}
                  onValueChange={(v) => setDailyReviewCap(v[0])}
                  min={10}
                  max={200}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Daily New Cards Cap</Label>
                  <span className="text-sm text-muted-foreground">{dailyNewCap} cards</span>
                </div>
                <Slider
                  value={[dailyNewCap]}
                  onValueChange={(v) => setDailyNewCap(v[0])}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Retrievability Window</Label>
                  <span className="text-sm text-muted-foreground">{retrievabilityWindow} days</span>
                </div>
                <Slider
                  value={[retrievabilityWindow]}
                  onValueChange={(v) => setRetrievabilityWindow(v[0])}
                  min={3}
                  max={14}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Days before exam to focus on high-retrievability practice
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="space-y-4">
            {readiness && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Current Readiness
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Total Cards</p>
                    <p className="font-medium">{readiness.totalCards}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Ready for Exam</p>
                    <p className="font-medium text-green-600">{readiness.readyCards}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">At Risk</p>
                    <p className="font-medium text-amber-600">{readiness.atRiskCards}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Avg Retrievability</p>
                    <p className="font-medium">{Math.round(readiness.averageRetrievability * 100)}%</p>
                  </div>
                </div>
                {readiness.atRiskCards > 0 && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{readiness.atRiskCards} cards need more practice before the exam date.</p>
                  </div>
                )}
              </div>
            )}

            {summary && (
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Exam Practice Schedule
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <span>{readiness?.totalCards || 0} total cards</span>
                  <span className="text-muted-foreground">·</span>
                  <span>~{summary.averagePerDay}x each</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    &lt;{Math.ceil(summary.totalSessions * 15 / Math.max(1, summary.totalSessions))} min per day
                  </span>
                </div>

                {/* Histogram */}
                <div className="pt-2">
                  <div className="flex items-end gap-1 h-24">
                    {histogramData.map((d, i) => (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end gap-0.5"
                        title={`Day ${i + 1}: ${d.total} cards (${d.focus})`}
                      >
                        <div
                          className={cn(
                            "w-full rounded-sm min-h-[2px]",
                            d.focus === "learning" && "bg-neutral-400 dark:bg-neutral-600",
                            d.focus === "maintenance" && "bg-neutral-500 dark:bg-neutral-500",
                            d.focus === "retrievability" && "bg-neutral-700 dark:bg-neutral-300"
                          )}
                          style={{ height: `${(d.total / maxValue) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Phase Labels */}
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                    <span>Today</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600" />
                      Learning
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-500" />
                      Maintenance
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-neutral-700 dark:bg-neutral-300" />
                      Retrievability
                    </span>
                    <span>Exam</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2 rounded bg-neutral-50 dark:bg-neutral-900">
                    <p className="text-lg font-semibold">{summary.learningDays}</p>
                    <p className="text-xs text-muted-foreground">Learning Days</p>
                  </div>
                  <div className="text-center p-2 rounded bg-neutral-50 dark:bg-neutral-900">
                    <p className="text-lg font-semibold">{summary.maintenanceDays}</p>
                    <p className="text-xs text-muted-foreground">Maintenance Days</p>
                  </div>
                  <div className="text-center p-2 rounded bg-neutral-50 dark:bg-neutral-900">
                    <p className="text-lg font-semibold">{summary.retrievabilityDays}</p>
                    <p className="text-xs text-muted-foreground">Retrievability Days</p>
                  </div>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Total Reviews:</span>
                  <span className="font-medium">{summary.totalReviewCards.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Cards:</span>
                  <span className="font-medium">{summary.totalNewCards.toLocaleString()}</span>
                </div>
              </div>
            )}

            {!previewSessions && examDate && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Generating schedule preview...</p>
              </div>
            )}

            {!examDate && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Select an exam date to see your optimized schedule</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!examDate || !previewSessions?.length || isGenerating}
            className="min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Confirm Schedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
