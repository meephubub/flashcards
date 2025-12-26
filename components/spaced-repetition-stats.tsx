"use client"

import { Calendar, Clock, Settings2 } from "lucide-react"
import { useDecks } from "@/context/deck-context"
import { formatDate } from "@/lib/date-utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FSRSControls, DEFAULT_FSRS_PARAMS } from "@/components/fsrs-controls"
import { useSettings } from "@/context/settings-context"
import { useState, useEffect } from "react"

interface SpacedRepetitionStatsProps {
  deckId: number
}

export function SpacedRepetitionStats({ deckId }: SpacedRepetitionStatsProps) {
  const { getDeck } = useDecks()
  const { settings, updateSettings } = useSettings()
  const deck = getDeck(deckId)

  // Local state for FSRS params to avoid direct updates while sliding
  const [fsrsParams, setFsrsParams] = useState<any>(null)

  // Sync with global settings when valid
  useEffect(() => {
    if (settings?.studySettings?.fsrsParams) {
      setFsrsParams(settings.studySettings.fsrsParams)
    }
  }, [settings])

  if (!deck) return null

  // Count cards with progress data
  const totalCards = deck.cards.length
  const cardsWithProgress = deck.cards.filter((card) => (card as any).progress).length

  // Count due cards - use database field names (snake_case)
  const now = new Date()
  const dueCards = deck.cards.filter((card) => {
    const progress = (card as any).progress
    if (!progress) return true // If no progress, it's due
    const dueDate = new Date(progress.due_date)
    return now >= dueDate
  }).length

  // Calculate percentage of cards in the system
  const percentInSystem = totalCards > 0 ? Math.round((cardsWithProgress / totalCards) * 100) : 0

  const handleSaveParams = async (newParams: any) => {
    // Update local state immediately for UI responsiveness
    setFsrsParams(newParams)

    // Save to global settings
    if (settings) {
      await updateSettings({
        ...settings,
        studySettings: {
          ...settings.studySettings,
          fsrsParams: newParams
        }
      })
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Calendar className="h-4 w-4 text-zinc-500" />
          <span>SRS Stats</span>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="sr-only">Configure FSRS</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>FSRS Configuration</DialogTitle>
              <DialogDescription>
                Adjust the spaced repetition algorithm parameters. These settings apply globally.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FSRSControls
                params={fsrsParams || DEFAULT_FSRS_PARAMS}
                onParamsChange={handleSaveParams}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/50 py-2 px-1">
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{dueCards}</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Due</div>
        </div>
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/50 py-2 px-1">
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{cardsWithProgress}</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tracked</div>
        </div>
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/50 py-2 px-1">
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{percentInSystem}%</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Progress</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last studied
        </span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatDate(deck.last_studied, 'relative')}</span>
      </div>
    </div>
  )
}

