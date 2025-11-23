"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Clock } from "lucide-react"
import { useDecks } from "@/context/deck-context"
import { formatDate } from "@/lib/date-utils"

interface SpacedRepetitionStatsProps {
  deckId: number
}

export function SpacedRepetitionStats({ deckId }: SpacedRepetitionStatsProps) {
  const { getDeck } = useDecks()
  const deck = getDeck(deckId)

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

  return (
    <Card className="bg-secondary border-secondary-foreground/20">
      <CardContent className="p-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Spaced Repetition Stats
        </h3>

        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cards in system:</span>
            <span className="font-medium">
              {cardsWithProgress} / {totalCards} ({percentInSystem}%)
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Due for review:</span>
            <span className="font-medium">{dueCards} cards</span>
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last studied:
            </span>
            <span className="font-medium">{formatDate(deck.last_studied, 'relative')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
