"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, Play, FileUp, Sparkles, Clock, ChevronRight, Folder } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { DeckOptionsMenu } from "@/components/deck-options-menu"
import { useDecks } from "@/context/deck-context"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/date-utils"
import { useSearchParams } from "next/navigation"

// ── Deck card ──
function DeckCard({ deck, index }: { deck: any; index: number }) {
  return (
    <Link href={`/deck/${deck.id}`} className="group block">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
        <div className="p-5">
          <div className="flex justify-between items-start">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-2">
              {deck.name}
            </h2>
            <DeckOptionsMenu deckId={deck.id} />
          </div>

          <div className="mt-4 space-y-2">
            {deck.tag && (
              <span className="inline-block text-[10px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600">
                {deck.tag}
              </span>
            )}
            <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
              <span className="tabular-nums">{deck.card_count || 0} cards</span>
              <span>{formatDate(deck.last_studied, 'relative')}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-300 dark:text-zinc-700">
            deck
          </span>
          <Button
            size="sm"
            asChild
            className="h-7 rounded-full px-4 text-xs bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Link href={`/deck/${deck.id}/study`}>
              <Play className="h-3 w-3 mr-1.5 fill-current" />
              Study
            </Link>
          </Button>
        </div>
      </div>
    </Link>
  )
}

// ── Folder card ──
function FolderCard({
  name,
  count,
  weakness,
  onClick,
}: {
  name: string
  count: number
  weakness: number
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="group block w-full text-left">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
              <Folder className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            </div>
            {weakness < 0.6 && (
              <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 dark:text-zinc-600">
                needs work
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</h3>

          <div className="mt-3 flex items-center gap-4">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">{count} items</span>
            <div className="flex-1 max-w-[64px]">
              <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-400 dark:bg-zinc-600 transition-all"
                  style={{ width: `${Math.round(weakness * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-300 dark:text-zinc-700">
            folder
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors" />
        </div>
      </div>
    </button>
  )
}

// ── Create card ──
function CreateNewDeckCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group block w-full text-left h-full">
      <div className="h-full rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-center min-h-[180px]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
            <PlusCircle className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">New Deck</p>
          <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-1">Start a new collection</p>
        </div>
      </div>
    </button>
  )
}

// ── Main grid ──
export function DeckGrid() {
  const searchParams = useSearchParams()
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)

  const [currentPath, setCurrentPath] = useState<string[]>(() => {
    const pathParam = searchParams.get('path')
    return pathParam ? pathParam.split('/') : []
  })

  const { decks, loading } = useDecks()

  // Sync URL with folder path
  useEffect(() => {
    const path = currentPath.join('/')
    const url = path ? `/?path=${path}` : '/'
    window.history.replaceState(null, '', url)
  }, [currentPath])

  // Weakness helper
  const getDeckWeakness = (deck: any) => {
    if (!deck.cards || deck.cards.length === 0) return 1.0
    const progressCards = deck.cards.filter((c: any) => c.progress)
    if (progressCards.length === 0) return 0.5
    const totalEase = progressCards.reduce((acc: number, c: any) => acc + (c.progress.ease_factor || 2.5), 0)
    return totalEase / (progressCards.length * 5)
  }



  // Get items at current level
  const getItemsAtLevel = () => {
    const items: any[] = []
    const seenFolders = new Set<string>()

    decks.forEach(deck => {
      // If deck has no tag, it's effectively at the root ([])
      const tags = deck.tag ? deck.tag.split('/') : []
      
      // Check if the deck's path starts with the current path
      const isMatch = currentPath.every((part, i) => tags[i] === part)
      if (!isMatch) return

      if (tags.length > currentPath.length) {
        // It's in a subfolder relative to the current path
        const folderName = tags[currentPath.length]
        if (!seenFolders.has(folderName)) {
          seenFolders.add(folderName)
          
          // Calculate folder stats
          const folderDecks = decks.filter(d => {
            const dTags = d.tag ? d.tag.split('/') : []
            const dMatch = currentPath.every((p, i) => dTags[i] === p)
            return dMatch && dTags[currentPath.length] === folderName
          })
          
          const weakness = folderDecks.reduce((acc, d) => acc + getDeckWeakness(d), 0) / folderDecks.length
          
          items.push({
            id: `folder-${currentPath.join('-')}-${folderName}`,
            name: folderName,
            isFolder: true,
            count: folderDecks.length,
            weakness
          })
        }
      } else if (tags.length === currentPath.length) {
        // It's a deck at this exact level
        items.push({ ...deck, isFolder: false })
      }
    })

    return items
  }

  const items = getItemsAtLevel()

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-8 w-full">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {currentPath.length > 0 ? currentPath[currentPath.length - 1] : "Collections"}
          </h1>

          {currentPath.length > 0 && (
            <div className="flex items-center mt-1.5 text-xs text-zinc-400 dark:text-zinc-600">
              <button onClick={() => setCurrentPath([])} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                Collections
              </button>
              {currentPath.map((part, i) => (
                <span key={i} className="flex items-center">
                  <ChevronRight className="h-3 w-3 mx-1.5 opacity-40" />
                  <button
                    onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                    className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${i === currentPath.length - 1 ? 'text-zinc-900 dark:text-zinc-100 font-medium' : ''}`}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium"
          >
            <Link href="/study/all-due">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              All due
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGenerateOpen(true)}
            className="h-8 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            AI Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="h-8 rounded-full border-zinc-200 dark:border-zinc-800 text-xs font-medium"
          >
            <FileUp className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
          <Button
            onClick={() => setIsCreateDeckOpen(true)}
            size="sm"
            className="h-8 rounded-full px-4 text-xs font-medium bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            New Deck
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) =>
          item.isFolder ? (
            <FolderCard
              key={item.id}
              name={item.name}
              count={item.count}
              weakness={item.weakness}
              onClick={() => setCurrentPath([...currentPath, item.name])}
            />
          ) : (
            <DeckCard key={item.id} deck={item} index={index} />
          )
        )}

        <CreateNewDeckCard onClick={() => setIsCreateDeckOpen(true)} />
      </div>

      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </div>
  )
}
