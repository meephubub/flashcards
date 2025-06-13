"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Play, FileUp, Sparkles, X, Clock, Hash } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { ImportMarkdownDialog } from "@/components/import-markdown-dialog"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { DeckOptionsMenu } from "@/components/deck-options-menu"
import { useDecks } from "@/context/deck-context"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"

// Card component with hover effect
function DeckCard({ deck, index }: { deck: any, index: number }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };
  
  return (
    <motion.div
      key={deck.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.05 }}
      className="h-full"
    >
      <div 
        className={`relative h-full rounded-2xl group cursor-pointer overflow-hidden transition-all duration-300 ${isHovering ? 'transform -translate-y-1 scale-[1.02]' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/30 dark:from-gray-800/80 dark:to-gray-900/30 rounded-2xl"></div>
        
        {/* Animated highlight effect */}
        <div 
          className="absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none"
          style={{
            opacity: isHovering ? 0.7 : 0,
            background: isHovering 
              ? `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.8) 0%, transparent 60%)` 
              : 'none',
          }}
        />
        
        <Card className="overflow-hidden border-0 rounded-2xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl h-full flex flex-col shadow-[0_10px_20px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_20px_-15px_rgba(0,0,0,0.3)]">
          <Link href={`/deck/${deck.id}`} className="flex-1">
            <CardContent className="p-6 cursor-pointer">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">{deck.name}</h2>
                <DeckOptionsMenu deckId={deck.id} />
              </div>
              <div className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {deck.tag && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100/80 text-gray-700 dark:bg-gray-800/80 dark:text-gray-300 backdrop-blur-sm">
                    {deck.tag}
                  </span>
                )}
                <div className="flex items-center pt-2">
                  <Hash className="h-4 w-4 mr-2 opacity-60" />
                  <p>{deck.card_count || 0} cards</p>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 opacity-60" />
                  <p>Last studied: {deck.last_studied || 'Never'}</p>
                </div>
              </div>
            </CardContent>
          </Link>
          <CardFooter className="border-t border-gray-200/30 dark:border-white/10 p-4 flex justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              asChild
              className="rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-200"
            >
              <Link href={`/deck/${deck.id}/edit`}>Edit Cards</Link>
            </Button>
            <Button 
              size="sm" 
              asChild
              className="rounded-full bg-gray-900/90 hover:bg-black text-white dark:bg-white/90 dark:text-black dark:hover:bg-white transition-all duration-200"
            >
              <Link href={`/deck/${deck.id}/study`}>
                <Play className="h-4 w-4 mr-2" />
                Study
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </motion.div>
  );
}

// Create New Deck card component with hover effect
function CreateNewDeckCard({ onClick, index }: { onClick: () => void, index: number }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.05 }}
      className="h-full"
    >
      <div
        onClick={onClick}
        className={`relative h-full rounded-2xl group cursor-pointer overflow-hidden transition-all duration-300 ${isHovering ? 'transform -translate-y-1 scale-[1.02]' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/90 to-gray-100/70 dark:from-gray-800/90 dark:to-gray-900/70 rounded-2xl"></div>
        
        {/* Cursor following glow effect */}
        <div 
          className="absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none"
          style={{
            opacity: isHovering ? 0.7 : 0,
            background: isHovering 
              ? `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.8) 0%, transparent 60%)` 
              : 'none',
          }}
        />
        
        <div className="relative h-full rounded-2xl bg-transparent flex items-center justify-center min-h-[240px] shadow-[0_10px_20px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_20px_-15px_rgba(0,0,0,0.3)]">
          <div className="text-center p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 ease-out shadow-[0_5px_15px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_5px_15px_-5px_rgba(0,0,0,0.3)]">
              <PlusCircle className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <p className="font-medium text-gray-700 dark:text-gray-300 text-lg">Create New Deck</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Start a new collection</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-72" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="relative">
              <Card className="overflow-hidden border border-gray-200/30 dark:border-gray-700/30 rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl shadow-[0_10px_20px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_20px_-15px_rgba(0,0,0,0.3)]">
                <CardContent className="p-6">
                  <Skeleton className="h-7 w-3/4 mb-6" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-gray-200/30 dark:border-gray-700/30 p-4 flex justify-between">
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-full" />
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
          Collections
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsGenerateOpen(true)}
            className="rounded-full border-gray-200/50 hover:border-gray-300/70 hover:bg-white/70 dark:border-gray-700/50 dark:hover:border-gray-600/70 dark:hover:bg-gray-800/70 transition-all duration-200 shadow-[0_2px_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_-5px_rgba(0,0,0,0.2)] backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
            AI Generate
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="rounded-full border-gray-200/50 hover:border-gray-300/70 hover:bg-white/70 dark:border-gray-700/50 dark:hover:border-gray-600/70 dark:hover:bg-gray-800/70 transition-all duration-200 shadow-[0_2px_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_-5px_rgba(0,0,0,0.2)] backdrop-blur-sm"
          >
            <FileUp className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
            Import
          </Button>
          <Button 
            onClick={() => setIsCreateDeckOpen(true)}
            size="sm"
            className="rounded-full bg-gray-900/90 hover:bg-black text-white dark:bg-white/90 dark:text-black dark:hover:bg-white transition-all duration-200 shadow-[0_2px_10px_-5px_rgba(0,0,0,0.2)] dark:shadow-[0_2px_10px_-5px_rgba(255,255,255,0.2)]"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            New Deck
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedTag || "all"} onValueChange={handleTagChange}>
            <SelectTrigger className="w-[200px] rounded-full border-gray-200/50 bg-white/70 dark:bg-gray-800/70 dark:border-gray-700/50 shadow-[0_2px_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_-5px_rgba(0,0,0,0.2)] backdrop-blur-sm">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200/50 dark:border-gray-700/50 shadow-lg backdrop-blur-md bg-white/80 dark:bg-gray-800/80">
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
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDecks.map((deck, index) => (
          <DeckCard key={deck.id} deck={deck} index={index} />
        ))}

        <CreateNewDeckCard 
          onClick={() => setIsCreateDeckOpen(true)} 
          index={filteredDecks.length} 
        />
      </div>

      <CreateDeckDialog open={isCreateDeckOpen} onOpenChange={setIsCreateDeckOpen} />
      <ImportMarkdownDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <GenerateFlashcardsDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </div>
  )
}
