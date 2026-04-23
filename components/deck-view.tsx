"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Play, Plus, Edit, Trophy, BookText, Download, Calendar as CalendarIcon, ChevronRight, Layers, MoreHorizontal, LayoutList, ChevronDown } from "lucide-react"
import { Link } from "next-view-transitions"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { getCachedExamData } from "@/lib/exam-cache"
import type { Card } from "@/lib/supabase"
import { formatDate } from "@/lib/date-utils"
import { ScheduleExamModal } from "@/components/schedule-exam-modal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion"
import { haptics } from "@/lib/haptics"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Heatmap Calendar Mock Component
const ActivityHeatmap = () => {
  // Generate a mock grid of 52 weeks x 7 days
  const weeks = Array.from({ length: 52 }, () => 
    Array.from({ length: 7 }, () => Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0)
  );
  // Guarantee a single darker square toward the far right
  weeks[50][3] = 4;

  const getColor = (level: number) => {
    switch(level) {
      case 0: return 'bg-zinc-100 dark:bg-zinc-800/50';
      case 1: return 'bg-zinc-200 dark:bg-zinc-700';
      case 2: return 'bg-zinc-300 dark:bg-zinc-600';
      case 3: return 'bg-zinc-400 dark:bg-zinc-500';
      case 4: return 'bg-zinc-800 dark:bg-zinc-200';
      default: return 'bg-zinc-100 dark:bg-zinc-800/50';
    }
  }

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-none">
      <div className="min-w-[700px]">
        {/* Month labels mock */}
        <div className="flex text-[10px] text-zinc-400 mb-2 px-1 justify-between font-medium">
          <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span>
          <span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span>
          <span>Mar</span><span>Apr</span>
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-[3px]">
              {week.map((day, dIdx) => (
                <div key={`${wIdx}-${dIdx}`} className={`w-[11px] h-[11px] rounded-[2px] ${getColor(day)}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-zinc-400 font-medium">
          <span>Less</span>
          <div className="flex gap-[3px]">
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className={`w-[11px] h-[11px] rounded-[2px] ${getColor(level)}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}

interface DeckViewProps {
  deckId: number
}

export function DeckView({ deckId }: DeckViewProps) {
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
  
  const [isCardListVisible, setIsCardListVisible] = useState(false)
  const pullY = useMotionValue(0)
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false)
  const pullThreshold = -80
  const pullSpring = useSpring(pullY, { stiffness: 400, damping: 40 })

  // Fetch due cards when needed
  useEffect(() => {
    const handleOpenExport = () => setIsExportDialogOpen(true);
    const handleOpenSchedule = () => setIsScheduleExamOpen(true);
    
    window.addEventListener('open-export-modal', handleOpenExport);
    window.addEventListener('open-schedule-modal', handleOpenSchedule);
    
    return () => {
      window.removeEventListener('open-export-modal', handleOpenExport);
      window.removeEventListener('open-schedule-modal', handleOpenSchedule);
    }
  }, []);

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
    window.location.reload()
  }

  // Export handler
  const handleExport = () => {
    if (!deck || !deck.cards || deck.cards.length === 0) return

    const delimiter = exportOptions.format === 'csv' ? ',' : '\t'
    const fileExt = exportOptions.format

    const escapeValue = (value: string) => {
      if (!value) return exportOptions.format === 'csv' ? '""' : ''
      if (exportOptions.format === 'tsv') {
        return value.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '')
      }
      const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')
      const escaped = value.replace(/"/g, '""')
      return needsQuotes ? `"${escaped}"` : escaped
    }

    const headers: string[] = []
    if (exportOptions.includeFront) headers.push('Front')
    if (exportOptions.includeBack) headers.push('Back')
    if (isSpacedRepetitionEnabled && exportOptions.includeState) headers.push('State')
    if (isSpacedRepetitionEnabled && exportOptions.includeNextReview) headers.push('Next Review')
    if (isSpacedRepetitionEnabled && exportOptions.includeEaseFactor) headers.push('Ease Factor')

    let output = headers.join(delimiter) + '\n'

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

    const BOM = '\uFEFF'
    const mimeType = exportOptions.format === 'csv' ? 'text/csv' : 'text/tab-separated-values'
    const blob = new Blob([BOM + output], { type: `${mimeType};charset=utf-8;` })

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
      <div className="space-y-8 w-full max-w-2xl mx-auto py-12 flex flex-col items-center">
        <Skeleton className="h-10 w-10 rounded-xl mb-2" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-4 w-32 mt-2" />
        
        <div className="flex gap-3 mt-8">
          <Skeleton className="h-12 w-32 rounded-full" />
          <Skeleton className="h-12 w-32 rounded-full" />
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

  // Calculate stats
  let newCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  deck.cards?.forEach((card) => {
    const progress = (card as any).progress;
    if (isSpacedRepetitionEnabled && progress?.fsrs_state) {
      const state = progress.fsrs_state.state;
      if (state === 0) newCount++;
      else if (state === 1 || state === 3) learningCount++;
      else if (state === 2) masteredCount++;
    } else {
      newCount++;
    }
  });

  // Just a mock for "This week" to match the aesthetic if no real data is available,
  // or we could use recent reviews if we tracked them. We'll use 6 as requested or learning+mastered.
  const thisWeekCount = 6; 

  return (
    <div className="w-full max-w-3xl mx-auto space-y-12 py-8 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 rounded-2xl flex items-center justify-center shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">
          <Layers className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {deck.name}
          </h1>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {totalCards} card{totalCards !== 1 && "s"} in this deck
          </p>
        </div>
      </div>

      {/* ── Primary Actions ── */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex overflow-hidden rounded-full shadow-sm shadow-zinc-200/50 dark:shadow-none border border-zinc-900 dark:border-zinc-100">
          <Button asChild className="h-11 rounded-none rounded-l-full pl-6 pr-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-sm font-medium border-r border-zinc-800 dark:border-zinc-200">
            <Link href={`/deck/${deckId}/study`}>
              <Play className="h-4 w-4 mr-2 fill-current" />
              {isSpacedRepetitionEnabled && dueCards.length > 0 ? `Study ${dueCards.length}` : "Study"}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 w-11 p-0 rounded-none rounded-r-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem asChild className="rounded-xl">
                <Link href={`/deck/${deckId}/language-study`} className="cursor-pointer">Language Mode</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl">
                <Link href={`/deck/${deckId}/exam`} className="cursor-pointer">Exam Mode</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button variant="outline" asChild className="h-11 rounded-full px-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-sm text-sm font-medium">
          <Link href={`/deck/${deckId}/add`} style={{ viewTransitionName: 'add-card-button' }}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Link>
        </Button>
      </div>

      {/* ── Stats Panel ── */}
      <div className="max-w-2xl mx-auto space-y-6 pt-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{thisWeekCount}</div>
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-1">This week</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{newCount}</div>
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-1">New</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{learningCount}</div>
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-1">Learning</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{masteredCount}</div>
            <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-1">Mastered</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
          {totalCards > 0 && (
            <>
              <div style={{ width: `${(masteredCount / totalCards) * 100}%` }} className="bg-zinc-800 dark:bg-zinc-200 transition-all duration-500" />
              <div style={{ width: `${(learningCount / totalCards) * 100}%` }} className="bg-zinc-400 dark:bg-zinc-500 transition-all duration-500" />
              <div style={{ width: `${(newCount / totalCards) * 100}%` }} className="bg-zinc-200 dark:bg-zinc-700 transition-all duration-500" />
            </>
          )}
        </div>
      </div>

      {/* ── Heatmap Calendar ── */}
      <div className="max-w-2xl mx-auto pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
        <ActivityHeatmap />
      </div>

      {!isCardListVisible && (
        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto pt-8 pb-12">
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDrag={(_, info) => {
              pullY.set(info.offset.y)
              if (info.offset.y < pullThreshold && !hasTriggeredHaptic) {
                haptics.buttonPress()
                setHasTriggeredHaptic(true)
              } else if (info.offset.y > pullThreshold && hasTriggeredHaptic) {
                setHasTriggeredHaptic(false)
              }
            }}
            onDragEnd={(_, info) => {
              if (info.offset.y < pullThreshold) {
                setIsCardListVisible(true)
                haptics.navigation()
              }
              pullY.set(0)
              setHasTriggeredHaptic(false)
            }}
            style={{ y: pullSpring }}
            className="flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing group"
          >
            <motion.div 
              className="w-10 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700 transition-colors"
              animate={{
                scale: hasTriggeredHaptic ? 1.2 : 1,
                backgroundColor: hasTriggeredHaptic ? "rgb(113 113 122)" : undefined
              }}
            />
            <div className="flex items-center text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
              <ChevronDown className="h-3.5 w-3.5 mr-2 rotate-180" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
                {hasTriggeredHaptic ? "Release to view" : "Pull up for cards"}
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {isCardListVisible && (
        <div className="flex justify-center max-w-2xl mx-auto pt-4 pb-8">
          <Button 
            variant="ghost" 
            onClick={() => setIsCardListVisible(false)}
            className="rounded-full px-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5 mr-2" />
            Hide Cards
          </Button>
        </div>
      )}

      {/* ── Card List (Toggled) ── */}
      <AnimatePresence>
        {isCardListVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            className="max-w-2xl mx-auto overflow-hidden"
          >
            <div className="pt-4">
              <div className="flex items-center justify-between px-1 pb-3">
            <p className="text-[11px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600">
              Cards
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums">
              {totalCards}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 shadow-sm">
            {deck.cards?.map((card) => {
              const progress = (card as any).progress
              let stateLabel = ""
              let dotColor = "bg-zinc-200 dark:bg-zinc-700"

              if (isSpacedRepetitionEnabled && progress?.fsrs_state) {
                const state = progress.fsrs_state.state
                if (state === 0) {
                  dotColor = "bg-zinc-200 dark:bg-zinc-700"
                  stateLabel = "New"
                } else if (state === 1 || state === 3) {
                  dotColor = "bg-zinc-400 dark:bg-zinc-500"
                  stateLabel = state === 1 ? "Learning" : "Relearning"
                } else if (state === 2) {
                  dotColor = "bg-zinc-800 dark:bg-zinc-200"
                  stateLabel = "Mastered"
                }
              }

              return (
                <div
                  key={card.id}
                  className="group flex items-start gap-3 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="pt-1.5 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {card.front}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                      {card.back}
                    </p>
                  </div>
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
                <Button variant="outline" size="sm" className="mt-4 rounded-full text-xs" asChild>
                  <Link href={`/deck/${deckId}/add`} style={{ viewTransitionName: 'add-card-button' }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add your first card
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )}
      </AnimatePresence>

      {/* Export Options Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
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
