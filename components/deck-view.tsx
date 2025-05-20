"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Play, Plus, Edit, Trophy, BookText } from "lucide-react"
import Link from "next/link"
import { CreateCardDialog } from "@/components/create-card-dialog"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { SpacedRepetitionStats } from "@/components/spaced-repetition-stats"
import { getCachedExamData } from "@/lib/exam-cache"

interface DeckViewProps {
  deckId: number
}

export function DeckView({ deckId }: DeckViewProps) {
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false)
  const { getDeck, loading, getDueCards } = useDecks()
  const { settings } = useSettings()
  const router = useRouter()

  const deck = getDeck(deckId)
  const isSpacedRepetitionEnabled = settings.studySettings.enableSpacedRepetition
  const dueCards = isSpacedRepetitionEnabled ? getDueCards(deckId) : []

  const [hasInProgressExam, setHasInProgressExam] = useState(false)

  // Check for in-progress exam
  useEffect(() => {
    if (deckId) {
      const cachedExam = getCachedExamData(deckId)
      setHasInProgressExam(!!cachedExam)
    }
  }, [deckId])

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
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-full mb-4" />
                <Skeleton className="h-20 w-full mt-4" />
              </CardContent>
            </Card>
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
          <p className="text-gray-500">{deck.cards.length} cards</p>
        </div>
      </div>

      {deck.description && <p className="text-gray-600 dark:text-gray-300">{deck.description}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex gap-3">
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
            <Button variant="outline" asChild>
              <Link href={`/deck/${deckId}/language-study`}>
                <BookText className="h-4 w-4 mr-2" />
                Language Study
              </Link>
            </Button>
          </div>
        </div>

        {isSpacedRepetitionEnabled && (
          <div className="md:col-span-1">
            <SpacedRepetitionStats deckId={deckId} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deck.cards.map((card) => (
          <Card key={card.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="font-medium mb-4">{card.front}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 pt-4 border-t">{card.back}</div>
              {isSpacedRepetitionEnabled && card.progress && (
                <div className="mt-2 pt-2 border-t text-xs text-gray-500 flex justify-between">
                  <span>Next review: {new Date(card.progress.dueDate).toLocaleDateString()}</span>
                  <span>Ease: {card.progress.easeFactor.toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateCardDialog open={isCreateCardOpen} onOpenChange={setIsCreateCardOpen} deckId={deckId} />
    </div>
  )
}
