"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card as UICard, CardContent } from "@/components/ui/card"
import { ArrowLeft, Play, Plus, Edit, Trophy, BookText, Download } from "lucide-react"
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

  // Check for in-progress exam
  useEffect(() => {
    if (deckId) {
      const cachedExam = getCachedExamData(deckId)
      setHasInProgressExam(!!cachedExam)
    }
  }, [deckId])

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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <Skeleton className="h-5 w-full max-w-lg" />

        <div className="flex gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <UICard key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-full mb-4" />
                <Skeleton className="h-20 w-full mt-4" />
              </CardContent>
            </UICard>
          ))}
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Deck not found</h2>
        <p className="text-gray-500 mb-6">The deck you're looking for doesn't exist or has been deleted.</p>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{deck.name}</h1>
          <p className="text-gray-500">{deck.cards?.length || deck.card_count || 0} cards</p>
        </div>
      </div>

      {deck.description && <p className="text-gray-600 dark:text-gray-300">{deck.description}</p>}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/deck/${deckId}/study`}>
            <Play className="h-4 w-4 mr-2" />
            {isSpacedRepetitionEnabled ? `Study (${dueCards.length} due)` : "Study"}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/deck/${deckId}/exam`}>
            <Trophy className="h-4 w-4 mr-2" />
            {hasInProgressExam ? "Resume Exam" : "Exam Mode"}
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setIsCreateCardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/deck/${deckId}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Deck
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/deck/${deckId}/language-study`}>
            <BookText className="h-4 w-4 mr-2" />
            Language Study
          </Link>
        </Button>
      </div>

      {/* Spaced Repetition Stats */}
      {isSpacedRepetitionEnabled && (
        <div className="max-w-sm">
          <SpacedRepetitionStats deckId={deckId} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deck.cards?.map((card) => {
          const progress = (card as any).progress
          let borderColor = ""
          let stateLabel = ""

          if (isSpacedRepetitionEnabled && progress?.fsrs_state) {
            const state = progress.fsrs_state.state
            // 0=New, 1=Learning, 2=Review, 3=Relearning
            if (state === 0) {
              borderColor = "border-blue-400 dark:border-blue-600"
              stateLabel = "New"
            } else if (state === 1 || state === 3) {
              borderColor = "border-orange-400 dark:border-orange-600"
              stateLabel = state === 1 ? "Learning" : "Relearning"
            } else if (state === 2) {
              borderColor = "border-green-400 dark:border-green-600"
              stateLabel = "Review"
            }
          }

          return (
            <UICard
              key={card.id}
              className={`overflow-hidden hover:shadow-md transition-shadow ${borderColor ? `border-2 ${borderColor}` : ""}`}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-medium">{card.front}</div>
                  {stateLabel && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${stateLabel === "New" ? "bg-blue-50 text-blue-600 border-blue-200" :
                      stateLabel === "Review" ? "bg-green-50 text-green-600 border-green-200" :
                        "bg-orange-50 text-orange-600 border-orange-200"
                      }`}>
                      {stateLabel}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 pt-4 border-t">{card.back}</div>
                {isSpacedRepetitionEnabled && progress && (
                  <div className="mt-2 pt-2 border-t text-xs text-gray-500 flex justify-between">
                    <span>Next: {formatDate(progress.due_date, 'short')}</span>
                    <span>Ease: {progress.ease_factor?.toFixed(2) || "2.50"}</span>
                  </div>
                )}
              </CardContent>
            </UICard>
          )
        }) || []}
      </div>

      <CreateCardDialog open={isCreateCardOpen} onOpenChange={setIsCreateCardOpen} deckId={deckId} />

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Deck</DialogTitle>
            <DialogDescription>
              Choose which columns to include and the export format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Columns to Include</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="front"
                    checked={exportOptions.includeFront}
                    onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeFront: checked as boolean }))}
                  />
                  <Label htmlFor="front" className="text-sm font-normal cursor-pointer">Front</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="back"
                    checked={exportOptions.includeBack}
                    onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeBack: checked as boolean }))}
                  />
                  <Label htmlFor="back" className="text-sm font-normal cursor-pointer">Back</Label>
                </div>
                {isSpacedRepetitionEnabled && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="state"
                        checked={exportOptions.includeState}
                        onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeState: checked as boolean }))}
                      />
                      <Label htmlFor="state" className="text-sm font-normal cursor-pointer">State (New/Learning/Review)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="nextReview"
                        checked={exportOptions.includeNextReview}
                        onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeNextReview: checked as boolean }))}
                      />
                      <Label htmlFor="nextReview" className="text-sm font-normal cursor-pointer">Next Review Date</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="easeFactor"
                        checked={exportOptions.includeEaseFactor}
                        onCheckedChange={(checked) => setExportOptions(prev => ({ ...prev, includeEaseFactor: checked as boolean }))}
                      />
                      <Label htmlFor="easeFactor" className="text-sm font-normal cursor-pointer">Ease Factor</Label>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <RadioGroup
                value={exportOptions.format}
                onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as 'csv' | 'tsv' }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="text-sm font-normal cursor-pointer">CSV (Comma-separated)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tsv" id="tsv" />
                  <Label htmlFor="tsv" className="text-sm font-normal cursor-pointer">TSV (Tab-separated)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={!exportOptions.includeFront && !exportOptions.includeBack}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
