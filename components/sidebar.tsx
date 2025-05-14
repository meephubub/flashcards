"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ModeToggle } from "@/components/mode-toggle"
import { PlusCircle, Search, Settings, FileUp, Sparkles, BookText } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { useDecks } from "@/context/deck-context"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { usePathname } from "next/navigation"

export function Sidebar() {
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { decks, loading } = useDecks()
  const pathname = usePathname()

  const filteredDecks = decks.filter((deck) => deck.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <>
      <div className="w-64 h-full glass border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-semibold">Flashcards</h1>
          <ModeToggle />
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search decks..."
              className="pl-8 bg-gray-100 dark:bg-gray-800 border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="p-3">
          <Button className="w-full justify-start gap-2" variant="default" onClick={() => setIsCreateDeckOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            New Deck
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-2">MY DECKS</h2>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="px-2 py-2">
                    <Skeleton className="h-5 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              filteredDecks.map((deck) => (
                <Button
                  key={deck.id}
                  variant="ghost"
                  className="w-full justify-start text-left font-normal h-auto py-2"
                  asChild
                >
                  <Link href={`/deck/${deck.id}`}>
                    <div className="flex flex-col items-start">
                      <span>{deck.name}</span>
                      <span className="text-xs text-gray-500">{deck.cardCount} cards</span>
                    </div>
                  </Link>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 ${pathname === "/notes" ? "bg-accent" : ""}`}
            asChild
          >
            <Link href="/notes">
              <BookText className="h-4 w-4" />
              Notes
            </Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setIsGenerateOpen(true)}>
            <Sparkles className="h-4 w-4" />
            AI Generate
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setIsImportOpen(true)}>
            <FileUp className="h-4 w-4" />
            Import Markdown
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 ${pathname === "/settings" ? "bg-accent" : ""}`}
            asChild
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </>
  )
}
