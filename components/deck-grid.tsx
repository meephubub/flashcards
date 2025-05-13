"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Play, FileUp, Sparkles, X } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { DeckOptionsMenu } from "@/components/deck-options-menu"
import { useDecks } from "@/context/deck-context"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DeckGrid() {
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const { decks, loading } = useDecks()

  // Get unique tags from all decks
  const uniqueTags = Array.from(new Set(decks.filter(deck => deck.tag).map(deck => deck.tag)))

  // Filter decks by selected tag
  const filteredDecks = selectedTag
    ? decks.filter(deck => deck.tag === selectedTag)
    : decks

  const handleTagChange = (value: string) => {
    setSelectedTag(value === "all" ? null : value)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Flashcard Decks</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsGenerateOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Generate
          </Button>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsCreateDeckOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Deck
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedTag || "all"} onValueChange={handleTagChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decks</SelectItem>
              {uniqueTags.map((tag) => (
                <SelectItem key={tag} value={tag || ""}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedTag && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTag(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDecks.map((deck) => (
          <Card key={deck.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <Link href={`/deck/${deck.id}`}>
              <CardContent className="p-6 cursor-pointer">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-medium">{deck.name}</h2>
                  <div className="flex items-center gap-2">
                    {deck.tag && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {deck.tag}
                      </span>
                    )}
                    <DeckOptionsMenu deckId={deck.id} />
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>{deck.cardCount} cards</p>
                  <p>Last studied: {deck.lastStudied}</p>
                </div>
              </CardContent>
            </Link>
            <CardFooter className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/deck/${deck.id}/edit`}>Edit Cards</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/deck/${deck.id}/study`}>
                  <Play className="h-4 w-4 mr-2" />
                  Study
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}

        <Card
          className="border-dashed border-2 flex items-center justify-center h-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setIsCreateDeckOpen(true)}
        >
          <div className="text-center p-6">
            <PlusCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium">Create New Deck</p>
          </div>
        </Card>
      </div>

      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </div>
  )
}
