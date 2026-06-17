"use client"

import { Calendar, Clock, Settings2, Brain, AlertCircle, TrendingDown } from "lucide-react"
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
import { GCSEAnalytics, getGCSEAnalytics } from "@/lib/stats"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useMemo } from "react"
import { isProgressDue } from "@/lib/spaced-repetition"

interface SpacedRepetitionStatsProps {
  deckId: number
}

export function SpacedRepetitionStats({ deckId }: SpacedRepetitionStatsProps) {
  const { getDeck } = useDecks()
  const { settings, updateSettings } = useSettings()
  const { session } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const deck = getDeck(deckId)

  const [fsrsParams, setFsrsParams] = useState<any>(null)
  const [gcseData, setGcseData] = useState<GCSEAnalytics | null>(null)

  useEffect(() => {
    if (settings?.studySettings?.fsrsParams) {
      setFsrsParams(settings.studySettings.fsrsParams)
    }
  }, [settings])

  useEffect(() => {
    if (session?.user?.id && supabase) {
      getGCSEAnalytics(supabase, session.user.id).then(setGcseData)
    }
  }, [session, supabase, deckId])

  if (!deck) return null

  const totalCards = deck.cards.length
  const cardsWithProgress = deck.cards.filter((card) => (card as any).progress).length

  const dueCards = deck.cards.filter((card) => {
    const progress = (card as any).progress
    return isProgressDue(progress)
  }).length

  const percentInSystem = totalCards > 0 ? Math.round((cardsWithProgress / totalCards) * 100) : 0

  const handleSaveParams = async (newParams: any) => {
    setFsrsParams(newParams)
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
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
            <Brain className="h-4 w-4 text-blue-500" />
            <span>Learning Stats</span>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Settings2 className="h-4 w-4 text-zinc-500" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle>Study Configuration</DialogTitle>
                <DialogDescription>
                  Adjust your revision intensity and advanced SRS settings.
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

        <div className="grid grid-cols-3 gap-3 text-center mb-6">
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 py-4 px-2">
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{dueCards}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Due Now</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 py-4 px-2">
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{percentInSystem}%</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Mastery</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 py-4 px-2">
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{cardsWithProgress}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">Tracked</div>
          </div>
        </div>

        {gcseData && (
          <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-500/20">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-orange-900 dark:text-orange-300">GCSE Forecast</div>
                  <div className="text-[10px] text-orange-700 dark:text-orange-500 opacity-80 font-medium">Predicted for {gcseData.examDateStr}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-orange-600">-{gcseData.predictedForgetCount} cards</div>
                <div className="text-[9px] font-black text-orange-500 uppercase tracking-tight">Likely to forget</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-500/20">
                  <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-300">Weakest Section</div>
                  <div className="text-[10px] text-rose-700 dark:text-rose-500 opacity-80 font-medium">{gcseData.weakestTopic}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-rose-600">{gcseData.weakestTopicAccuracy}%</div>
                <div className="text-[9px] font-black text-rose-500 uppercase tracking-tight">Retention</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-zinc-500 font-medium">
            <Clock className="h-3.5 w-3.5" />
            Last session
          </span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatDate(deck.last_studied, 'relative')}</span>
        </div>
      </div>
    </div>
  )
}
