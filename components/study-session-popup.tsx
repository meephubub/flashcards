"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { Deck } from "@/context/deck-context"
import { getEffectiveDueDate, isProgressDue } from "@/lib/spaced-repetition"

interface StudyOption {
  id: string
  title: string
  description: string
  count: number
}

const daysOptions = [1, 7, 30, 90]

interface StudySessionPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decks: Deck[]
}

type CardStatus = "new" | "learning" | "due"

function getCardStatus(card: any): CardStatus {
  if (!card.progress) return "new"
  const { repetitions } = card.progress

  if (isProgressDue(card.progress)) return "due"
  if (repetitions >= 2) return "learning"
  return "new"
}

export function StudySessionPopup({ open, onOpenChange, decks }: StudySessionPopupProps) {
  const router = useRouter()
  const [selected, setSelected] = useState("due")
  const [days, setDays] = useState(7)
  const [affectScheduling, setAffectScheduling] = useState(true)

  // Calculate real stats from decks
  const stats = useMemo(() => {
    let newCards = 0
    let learning = 0
    let due = 0

    decks.forEach(deck => {
      if (deck.cards) {
        deck.cards.forEach((card: any) => {
          const status = getCardStatus(card)
          if (status === "new") newCards++
          else if (status === "learning") learning++
          else if (status === "due") due++
        })
      }
    })

    return { new: newCards, learning, due }
  }, [decks])

  // Calculate counts for each study option
  const studyOptions: StudyOption[] = useMemo(() => {
    const now = new Date()
    
    // Due now: cards with due_date <= now
    const dueNowCount = decks.reduce((acc, deck) => {
      if (!deck.cards) return acc
      return acc + deck.cards.filter((c: any) => c.progress && isProgressDue(c.progress, now)).length
    }, 0)

    // Study ahead: due cards + cards due within selected days
    const aheadCount = decks.reduce((acc, deck) => {
      if (!deck.cards) return acc
      return acc + deck.cards.filter((c: any) => {
        if (!c.progress) return false
        const dueDate = getEffectiveDueDate(c.progress)
        if (!dueDate) return c.progress.repetitions > 0
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilDue <= days && daysUntilDue >= 0
      }).length
    }, 0)

    // New only: cards with no progress or repetitions = 0
    const newCount = decks.reduce((acc, deck) => {
      if (!deck.cards) return acc
      return acc + deck.cards.filter((c: any) => !c.progress || c.progress.repetitions === 0).length
    }, 0)

    // Review only: cards with progress and repetitions > 0
    const reviewCount = decks.reduce((acc, deck) => {
      if (!deck.cards) return acc
      return acc + deck.cards.filter((c: any) => c.progress && c.progress.repetitions > 0).length
    }, 0)

    return [
      { id: "due", title: "Due now", description: "Cards scheduled for today", count: dueNowCount },
      { id: "ahead", title: "Study ahead", description: "Review cards before they're due", count: aheadCount },
      { id: "new", title: "New only", description: "Skip reviews this session", count: newCount },
      { id: "review", title: "Review only", description: "Skip new cards this session", count: reviewCount },
    ]
  }, [decks, days])

  const selectedCount = studyOptions.find(o => o.id === selected)?.count ?? 0

  const handleStartSession = () => {
    if (selectedCount === 0) return
    
    // Build query params based on selection
    const params = new URLSearchParams()
    params.set("mode", selected)
    if (selected === "ahead") {
      params.set("days", days.toString())
    }
    if (!affectScheduling) {
      params.set("noSchedule", "true")
    }
    
    router.push(`/study/all-due?${params.toString()}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[380px] w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden bg-background border border-border/60 shadow-xl rounded-2xl [&>button]:hidden"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">Study session</span>
          <button
            onClick={() => onOpenChange(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="mx-5 mb-4 grid grid-cols-3 divide-x divide-border/50 rounded-xl border border-border/50 bg-muted/30">
          {[
            { value: stats.new, label: "New" },
            { value: stats.learning, label: "Learning" },
            { value: stats.due, label: "Review" },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center py-3">
              <span className="text-base font-semibold tabular-nums text-foreground">{stat.value}</span>
              <span className="text-[10px] font-medium text-muted-foreground/70 tracking-wide uppercase mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Options — single bordered group with dividers */}
        <div className="mx-5 mb-1 rounded-xl border border-border/50 overflow-hidden divide-y divide-border/50">
          {studyOptions.map(option => {
            const isSelected = selected === option.id
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors",
                  isSelected ? "bg-foreground/[0.05]" : "hover:bg-muted/30"
                )}
              >
                {/* Radio — filled circle with inner dot when selected */}
                <div className={cn(
                  "shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150",
                  isSelected
                    ? "border-foreground bg-foreground"
                    : "border-border/60 bg-transparent"
                )}>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.14, ease: [0.175, 0.885, 0.32, 1.15] }}
                        className="w-[7px] h-[7px] rounded-full bg-background"
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium leading-none",
                    isSelected ? "text-foreground" : "text-foreground/75"
                  )}>{option.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-none">{option.description}</p>
                </div>

                {/* Count badge */}
                <span className={cn(
                  "shrink-0 text-xs font-medium tabular-nums px-2 py-0.5 rounded-full transition-colors duration-150",
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}>
                  {option.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Study ahead options — animated */}
        <AnimatePresence initial={false}>
          {selected === "ahead" && (
            <motion.div
              key="ahead-options"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mx-5 mt-3 space-y-3">

                {/* Days ahead */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
                    Days ahead
                  </p>
                  <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/40">
                    {daysOptions.map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className="relative flex-1 py-1.5 rounded-lg transition-colors"
                      >
                        {days === d && (
                          <motion.div
                            layoutId="days-bg"
                            className="absolute inset-0 bg-background rounded-lg border border-border/50"
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        <span className={cn(
                          "relative z-10 text-sm font-medium",
                          days === d ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {d}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Affect scheduling */}
                <div className="flex items-center justify-between py-3 border-t border-border/40">
                  <div>
                    <p className="text-sm font-medium text-foreground">Affect scheduling</p>
                    <p className="text-xs text-muted-foreground mt-0.5">FSRS updates intervals from answers</p>
                  </div>
                  <Switch
                    checked={affectScheduling}
                    onCheckedChange={setAffectScheduling}
                    className="shrink-0"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start button */}
        <div className="px-5 py-4">
          <Button
            onClick={handleStartSession}
            disabled={selectedCount === 0}
            className="w-full rounded-xl h-10 text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <motion.span whileTap={{ scale: 0.98 }} className="flex items-center">
              <span>Start session</span>
              <span className="ml-1.5 tabular-nums opacity-60">({selectedCount})</span>
              <ArrowRight className="ml-2 w-3.5 h-3.5" />
            </motion.span>
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}