"use client"

import { useState, useMemo, useEffect } from "react"
import { useDecks } from "@/context/deck-context"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus, FilePlus, FolderPlus } from "lucide-react"
import { Link } from "next-view-transitions"
import { motion, AnimatePresence } from "framer-motion"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { StudySessionPopup } from "@/components/study-session-popup"
import { DeckOptionsMenu } from "@/components/deck-options-menu"
import { formatDate } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

type CardStatus = "new" | "learning" | "mastered" | "due"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function getCardStatus(card: any): CardStatus {
  if (!card.progress) return "new"
  const { repetitions, ease_factor, due_date } = card.progress
  const now = new Date()
  const due = new Date(due_date)
  
  if (now >= due) return "due"
  if (repetitions >= 5 && ease_factor >= 2.5) return "mastered"
  if (repetitions >= 2) return "learning"
  return "new"
}

function StatsBar({ stats }: { stats: { new: number; learning: number; mastered: number; due: number } }) {
  const total = stats.new + stats.learning + stats.mastered + stats.due
  if (total === 0) return null

  const segments = [
    { key: "mastered", count: stats.mastered, shade: "bg-zinc-900 dark:bg-zinc-100" },
    { key: "learning", count: stats.learning, shade: "bg-zinc-600 dark:bg-zinc-400" },
    { key: "due", count: stats.due, shade: "bg-zinc-400 dark:bg-zinc-600" },
    { key: "new", count: stats.new, shade: "bg-zinc-200 dark:bg-zinc-800" },
  ].filter(s => s.count > 0)

  return (
    <div className="w-full max-w-md">
      <div className="flex h-1.5 rounded-full overflow-hidden">
        {segments.map((segment, i) => (
          <motion.div
            key={segment.key}
            initial={{ width: 0 }}
            animate={{ width: `${(segment.count / total) * 100}%` }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className={cn(segment.shade, i === 0 && "rounded-l-full", i === segments.length - 1 && "rounded-r-full")}
          />
        ))}
      </div>
    </div>
  )
}

function DeckRow({ deck, index }: { deck: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link href={`/deck/${deck.id}`}>
        <div className="group flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors px-2 -mx-2 rounded">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {deck.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {deck.card_count || 0} cards · {formatDate(deck.last_studied, 'relative')}
            </p>
          </div>
          
          <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              asChild
              className="h-7 px-3 text-xs bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <Link href={`/deck/${deck.id}/study`} onClick={(e) => e.stopPropagation()}>
                Study
              </Link>
            </Button>
            <DeckOptionsMenu deckId={deck.id} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function FolderSection({ 
  name, 
  allDecks,
  defaultOpen = false 
}: { 
  name: string
  allDecks: any[]
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  const folderDecks = allDecks.filter(d => {
    if (!d.tag) return false
    const tags = d.tag.split('/')
    return tags[0] === name && tags.length === 1
  })
  
  const subfolders = useMemo(() => {
    const subfolderSet = new Map<string, any[]>()
    allDecks.forEach(d => {
      if (!d.tag) return
      const tags = d.tag.split('/')
      if (tags[0] === name && tags.length > 1) {
        const subName = tags[1]
        if (!subfolderSet.has(subName)) subfolderSet.set(subName, [])
        subfolderSet.get(subName)!.push(d)
      }
    })
    return Array.from(subfolderSet.entries())
  }, [allDecks, name])

  if (folderDecks.length === 0 && subfolders.length === 0) return null

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors px-2 -mx-2 rounded"
      >
        <span className="text-sm text-zinc-900 dark:text-zinc-100">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{folderDecks.length + subfolders.reduce((a, [, d]) => a + d.length, 0)} decks</span>
          <ChevronDown 
            className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", isOpen && "rotate-180")} 
          />
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-4 pb-2">
              {folderDecks.map((deck, i) => (
                <DeckRow key={deck.id} deck={deck} index={i} />
              ))}
              {subfolders.map(([subName, subDecks]) => (
                <div key={subName} className="mt-2">
                  <span className="text-xs text-zinc-400 uppercase tracking-wide pl-2">{subName}</span>
                  {subDecks.map((deck, i) => (
                    <DeckRow key={deck.id} deck={deck} index={i} />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Dashboard() {
  const { decks, loading } = useDecks()
  const { user } = useAuth()
  const { toast } = useToast()
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isStudyPopupOpen, setIsStudyPopupOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [lastDeckId, setLastDeckId] = useState<number | null>(null)

  // Load last visited deck from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lastVisitedDeckId')
    if (stored) {
      setLastDeckId(parseInt(stored, 10))
    }
  }, [])

  // Listen for create deck event from action search bar
  useEffect(() => {
    const handler = () => setIsCreateDeckOpen(true)
    window.addEventListener('open-create-deck', handler as EventListener)
    return () => window.removeEventListener('open-create-deck', handler as EventListener)
  }, [])

  const stats = useMemo(() => {
    const allCards: { status: CardStatus }[] = []
    let studiedToday = 0
    
    decks.forEach(deck => {
      if (deck.cards) {
        deck.cards.forEach((card: any) => {
          allCards.push({ status: getCardStatus(card) })
          if (card.progress?.last_reviewed) {
            const lastReviewed = new Date(card.progress.last_reviewed)
            const today = new Date()
            if (lastReviewed.toDateString() === today.toDateString()) {
              studiedToday++
            }
          }
        })
      }
    })

    return {
      new: allCards.filter(c => c.status === "new").length,
      learning: allCards.filter(c => c.status === "learning").length,
      mastered: allCards.filter(c => c.status === "mastered").length,
      due: allCards.filter(c => c.status === "due").length,
      studiedToday,
      total: allCards.length,
    }
  }, [decks])

  const streak = useMemo(() => {
    const studyDates = new Set<string>()
    decks.forEach(deck => {
      if (deck.last_studied && deck.last_studied !== 'Never') {
        try {
          studyDates.add(new Date(deck.last_studied).toDateString())
        } catch {}
      }
    })
    
    let currentStreak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() - i)
      if (studyDates.has(checkDate.toDateString())) {
        currentStreak++
      } else if (i > 0) {
        break
      }
    }
    return currentStreak
  }, [decks])

  const { rootDecks, folders } = useMemo(() => {
    const root: any[] = []
    const folderMap = new Map<string, any[]>()
    
    decks.forEach(deck => {
      if (!deck.tag) {
        root.push(deck)
      } else {
        const topLevel = deck.tag.split('/')[0]
        if (!folderMap.has(topLevel)) folderMap.set(topLevel, [])
        folderMap.get(topLevel)!.push(deck)
      }
    })
    
    return {
      rootDecks: root,
      folders: Array.from(folderMap.entries()).map(([name]) => ({ name }))
    }
  }, [decks])

  const allItems = [
    ...rootDecks.map(d => ({ type: 'deck' as const, data: d })),
    ...folders.map(f => ({ type: 'folder' as const, data: f }))
  ]
  
  const visibleItems = showAll ? allItems : allItems.slice(0, 3)

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    )
  }

  const greeting = getGreeting()
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
      <div className="max-w-xl w-full mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 mb-1">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-zinc-400">
            {stats.studiedToday > 0 ? `${stats.studiedToday} cards studied today` : "Ready to study?"}
            {streak > 0 && ` · ${streak} day streak`}
          </p>
        </div>

        {/* Stats Bar */}
        {stats.total > 0 && (
          <div className="mb-12">
            <StatsBar stats={stats} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <Button
            onClick={() => setIsStudyPopupOpen(true)}
            className="h-9 px-5 text-sm bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-medium"
          >
            Study
          </Button>
        </div>

        {/* Decks List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-wider text-zinc-400">Decks</h2>
            {allItems.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {showAll ? 'Show less' : `Show all ${allItems.length}`}
              </button>
            )}
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, index) => (
                <motion.div
                  key={item.type === 'deck' ? `deck-${item.data.id}` : `folder-${item.data.name}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {item.type === 'deck' ? (
                    <DeckRow deck={item.data} index={index} />
                  ) : (
                    <FolderSection 
                      name={item.data.name} 
                      allDecks={decks}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {allItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-400 mb-4">No decks yet</p>
              <Button
                onClick={() => setIsCreateDeckOpen(true)}
                className="h-9 px-4 text-sm bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Create your first deck
              </Button>
            </div>
          )}
        </div>
      </div>

      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <StudySessionPopup open={isStudyPopupOpen} onOpenChange={setIsStudyPopupOpen} decks={decks} />
    </div>
  )
}
