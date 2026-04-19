"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Play, Plus, Edit, Trophy, BookText, Download, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { CreateCardDialog } from "@/components/create-card-dialog"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { SpacedRepetitionStats } from "@/components/spaced-repetition-stats"
import { getCachedExamData } from "@/lib/exam-cache"
import type { Card } from "@/lib/supabase"
import { formatDate } from "@/lib/date-utils"
import { ScheduleExamModal } from "@/components/schedule-exam-modal"
import { ExamPlanSummary } from "@/components/exam-plan-summary"

interface DeckViewProps {
  deckId: number
}

export function DeckView({ deckId }: DeckViewProps) {
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    includeFront: true,
    includeBack: true,
    includeState: true,
    includeNextReview: true,
    includeEaseFactor: true,
    format: 'csv' as 'csv' | 'tsv'
  })
  const { getDeck, loading, getDueCards } = useDecks()
  const { settings } = useSettings()
  const router = useRouter()

  const deck = getDeck(deckId)
  const isSpacedRepetitionEnabled = settings.studySettings.enableSpacedRepetition
  const [dueCards, setDueCards] = useState<Card[]>([])

  // Fetch due cards when needed
  useEffect(() => {
    if (isSpacedRepetitionEnabled && deckId) {
      const fetchDueCards = async () => {
        try {
          const cards = await getDueCards(deckId)
          setDueCards(cards || [])
        } catch (error) {
          console.error(`Error fetching due cards for deck ${deckId}:`, error)
          setDueCards([])
        }
      }
      fetchDueCards()
    }
  }, [isSpacedRepetitionEnabled, deckId, getDueCards])

  const [hasInProgressExam, setHasInProgressExam] = useState(false)
  const [isScheduleExamOpen, setIsScheduleExamOpen] = useState(false)

  // Check for in-progress exam
  useEffect(() => {
    if (deckId) {
      const cachedExam = getCachedExamData(deckId)
      setHasInProgressExam(!!cachedExam)
    }
  }, [deckId])

  const handleExamScheduled = () => {
    setIsScheduleExamOpen(false)
    // Force refresh the deck data to show updated state
    window.location.reload()
  }

  // Export handler with customizable options
  const handleExport = () => {
    if (!deck || !deck.cards || deck.cards.length === 0) return

    const delimiter = exportOptions.format === 'csv' ? ',' : '\t'
    const fileExt = exportOptions.format

    // Helper to escape values based on format
    const escapeValue = (value: string) => {
      if (!value) return exportOptions.format === 'csv' ? '""' : ''
      if (exportOptions.format === 'tsv') {
        // For TSV, just escape tabs and newlines
        return value.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '')
      }
      // CSV escaping
      const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')
      const escaped = value.replace(/"/g, '""')
      return needsQuotes ? `"${escaped}"` : escaped
    }

    // Build header based on selected options
    const headers: string[] = []
    if (exportOptions.includeFront) headers.push('Front')
    if (exportOptions.includeBack) headers.push('Back')
    if (isSpacedRepetitionEnabled && exportOptions.includeState) headers.push('State')
    if (isSpacedRepetitionEnabled && exportOptions.includeNextReview) headers.push('Next Review')
    if (isSpacedRepetitionEnabled && exportOptions.includeEaseFactor) headers.push('Ease Factor')

    let output = headers.join(delimiter) + '\n'

    // Build rows
    deck.cards.forEach((card) => {
      const progress = (card as any).progress
      const values: string[] = []

      if (exportOptions.includeFront) values.push(escapeValue(card.front))
      if (exportOptions.includeBack) values.push(escapeValue(card.back))

      if (isSpacedRepetitionEnabled) {
        if (exportOptions.includeState) {
          let state = 'New'
          if (progress?.fsrs_state) {
            const stateNum = progress.fsrs_state.state
            if (stateNum === 1) state = 'Learning'
            else if (stateNum === 2) state = 'Review'
            else if (stateNum === 3) state = 'Relearning'
          }
          values.push(state)
        }
        if (exportOptions.includeNextReview) {
          const nextReview = progress?.due_date ? formatDate(progress.due_date, 'short') : 'N/A'
          values.push(nextReview)
        }
        if (exportOptions.includeEaseFactor) {
          const easeFactor = progress?.ease_factor?.toFixed(2) || '2.50'
          values.push(easeFactor)
        }
      }

      output += values.join(delimiter) + '\n'
    })

    // Create blob with UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF'
    const mimeType = exportOptions.format === 'csv' ? 'text/csv' : 'text/tab-separated-values'
    const blob = new Blob([BOM + output], { type: `${mimeType};charset=utf-8;` })

    // Trigger download
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${deck.name.replace(/[^a-z0-9]/gi, '_')}.${fileExt}`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
  }

  if (loading) {
    return (
      <div className="space-y-8 w-full">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-zinc-400 mb-4">Deck not found</p>
        <Button variant="outline" size="sm" asChild className="rounded-full">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    )
  }

  const totalCards = deck.cards?.length || deck.card_count || 0

  return (
    <div className="space-y-8 w-full">
      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {deck.name}
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {totalCards} card{totalCards !== 1 && "s"}
              {deck.tag && <span className="ml-2 text-zinc-300 dark:text-zinc-700">· {deck.tag}</span>}
            </p>
          </div>
        </div>
        {deck.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 pl-11">{deck.description}</p>
        )}
      </div>

      {/* ── Primary action ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild className="h-10 rounded-full px-6 bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-sm font-medium text-sm">
          <Link href={`/deck/${deckId}/study`}>
            <Play className="h-3.5 w-3.5 mr-2 fill-current" />
            {isSpacedRepetitionEnabled ? `Study · ${dueCards.length} due` : "Study"}
          </Link>
        </Button>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Link href={`/deck/${deckId}/exam`}>
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
              {hasInProgressExam ? "Resume Exam" : "Exam"}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsScheduleExamOpen(true)} className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Schedule
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsCreateCardOpen(true)} className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Card
          </Button>
          <Button variant="outline" size="sm" asChild className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Link href={`/deck/${deckId}/edit`}>
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" asChild className="h-9 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium">
            <Link href={`/deck/${deckId}/language-study`}>
              <BookText className="h-3.5 w-3.5 mr-1.5" />
              Language
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExamPlanSummary
          deckId={deckId}
          cards={deck.cards || []}
          onScheduleNew={() => setIsScheduleExamOpen(true)}
        />
        {isSpacedRepetitionEnabled && (
          <SpacedRepetitionStats deckId={deckId} />
        )}
      </div>

      {/* ── Card list ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 pb-3">
          <p className="text-[11px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600">
            Cards
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums">
            {totalCards}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {deck.cards?.map((card) => {
            const progress = (card as any).progress
            let stateLabel = ""
            let dotColor = "bg-zinc-300 dark:bg-zinc-700"

            if (isSpacedRepetitionEnabled && progress?.fsrs_state) {
              const state = progress.fsrs_state.state
              if (state === 0) {
                dotColor = "bg-zinc-400"
                stateLabel = "New"
              } else if (state === 1 || state === 3) {
                dotColor = "bg-zinc-500"
                stateLabel = state === 1 ? "Learning" : "Relearning"
              } else if (state === 2) {
                dotColor = "bg-zinc-900 dark:bg-zinc-100"
                stateLabel = "Review"
              }
            }

            return (
              <div
                key={card.id}
                className="group flex items-start gap-3 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* state dot */}
                <div className="pt-1.5 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                </div>

                {/* content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {card.front}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                    {card.back}
                  </p>
                </div>

                {/* meta */}
                <div className="shrink-0 flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-600">
                  {stateLabel && (
                    <span className="uppercase tracking-wider font-bold">{stateLabel}</span>
                  )}
                  {isSpacedRepetitionEnabled && progress?.due_date && (
                    <span className="tabular-nums hidden sm:inline">{formatDate(progress.due_date, 'short')}</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )
          }) || []}

          {totalCards === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-400">No cards yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-full text-xs"
                onClick={() => setIsCreateCardOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add your first card
              </Button>
            </div>
          )}
        </div>
      </div>

      <CreateCardDialog open={isCreateCardOpen} onOpenChange={setIsCreateCardOpen} deckId={deckId} />

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Export Deck</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Choose columns and format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Columns</Label>
              <div className="space-y-2.5">
                <div className="flex items-center space-x-2">
                  <Checkbox id="front" checked={exportOptions.includeFront} onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeFront: checked as boolean }))} />
                  <Label htmlFor="front" className="text-sm font-normal cursor-pointer">Front</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="back" checked={exportOptions.includeBack} onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeBack: checked as boolean }))} />
                  <Label htmlFor="back" className="text-sm font-normal cursor-pointer">Back</Label>
                </div>
                {isSpacedRepetitionEnabled && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="state" checked={exportOptions.includeState} onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeState: checked as boolean }))} />
                      <Label htmlFor="state" className="text-sm font-normal cursor-pointer">State</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="nextReview" checked={exportOptions.includeNextReview} onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeNextReview: checked as boolean }))} />
                      <Label htmlFor="nextReview" className="text-sm font-normal cursor-pointer">Next Review</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="easeFactor" checked={exportOptions.includeEaseFactor} onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeEaseFactor: checked as boolean }))} />
                      <Label htmlFor="easeFactor" className="text-sm font-normal cursor-pointer">Ease Factor</Label>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Format</Label>
              <RadioGroup value={exportOptions.format} onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as 'csv' | 'tsv' }))}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="text-sm font-normal cursor-pointer">CSV</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tsv" id="tsv" />
                  <Label htmlFor="tsv" className="text-sm font-normal cursor-pointer">TSV</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(false)} className="rounded-full text-xs">Cancel</Button>
            <Button size="sm" onClick={handleExport} disabled={!exportOptions.includeFront && !exportOptions.includeBack} className="rounded-full text-xs bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Exam Modal */}
      {deck && (
        <ScheduleExamModal
          open={isScheduleExamOpen}
          onOpenChange={setIsScheduleExamOpen}
          deck={deck}
          cards={deck.cards || []}
          onScheduled={handleExamScheduled}
        />
      )}
    </div>
  )
}
