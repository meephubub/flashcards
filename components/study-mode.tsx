"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, RotateCw, Check, X, Sparkles, Calendar } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { AIChat } from "@/components/ai-chat"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfidenceRatingComponent } from "@/components/confidence-rating"
import type { ConfidenceRating } from "@/lib/spaced-repetition"
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText } from "@/lib/spaced-repetition"
import { useToast } from "@/hooks/use-toast"

interface StudyModeProps {
  deckId: number
}

export function StudyMode({ deckId }: StudyModeProps) {
  const { getDeck, loading, getDueCards } = useDecks()
  const { settings } = useSettings()
  const router = useRouter()
  const { toast } = useToast()

  const deck = getDeck(deckId)
  const isSpacedRepetitionEnabled = settings.studySettings.enableSpacedRepetition

  const [cards, setCards] = useState<any[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [studyComplete, setStudyComplete] = useState(false)

  // Initialize cards based on spaced repetition setting
  useEffect(() => {
    if (deck) {
      if (isSpacedRepetitionEnabled) {
        // Get only due cards when spaced repetition is enabled
        const dueCards = getDueCards(deckId)
        setCards(dueCards.slice(0, settings.studySettings.cardsPerSession))
      } else {
        // Get all cards when spaced repetition is disabled
        setCards(deck.cards.slice(0, settings.studySettings.cardsPerSession))
      }
    }
  }, [deck, deckId, isSpacedRepetitionEnabled, settings.studySettings.cardsPerSession, getDueCards])

  useEffect(() => {
    if (cards.length > 0) {
      setProgress((currentCardIndex / cards.length) * 100)
    }
  }, [currentCardIndex, cards.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if rating dialog is shown
      if (showRating) return

      switch (e.key) {
        case " ": // Space
        case "Enter":
          if (!isFlipped) {
            handleFlip()
          } else {
            handleNext()
          }
          break
        case "ArrowRight":
        case "Right":
          if (isFlipped) {
            handleNext()
          }
          break
        case "ArrowLeft":
        case "Left":
          if (currentCardIndex > 0) {
            handlePrevious()
          }
          break
        case "r":
        case "R":
          resetStudySession()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFlipped, currentCardIndex, showRating])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>

        <Skeleton className="h-1 w-full" />

        <Skeleton className="h-[300px] w-full rounded-lg" />

        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10" />
          </div>
          <Skeleton className="h-10 w-24" />
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

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">
          {isSpacedRepetitionEnabled ? "No cards due for review" : "No cards to study"}
        </h2>
        <p className="text-gray-500 mb-6">
          {isSpacedRepetitionEnabled
            ? "All cards in this deck are scheduled for future review."
            : "This deck doesn't have any cards yet. Add some cards to start studying."}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/deck/${deckId}`}>Back to Deck</Link>
          </Button>
          <Button asChild>
            <Link href={`/deck/${deckId}/edit`}>Add Cards</Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleNext = () => {
    if (isSpacedRepetitionEnabled && isFlipped) {
      // Show rating dialog when using spaced repetition
      setShowRating(true)
    } else {
      // Move to next card directly when not using spaced repetition
      moveToNextCard()
    }
  }

  const moveToNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1)
      setIsFlipped(false)
      setShowRating(false)
    } else {
      setStudyComplete(true)
    }
  }

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1)
      setIsFlipped(false)
    }
  }

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  const resetStudySession = () => {
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setShowRating(false)
    setStudyComplete(false)
  }

  const handleRating = async (rating: ConfidenceRating) => {
    try {
      const currentCard = cards[currentCardIndex]
      const currentProgress = currentCard.progress || DEFAULT_CARD_PROGRESS
      const newProgress = calculateNextReview(currentProgress, rating)

      // Update the card progress via API
      const response = await fetch(`/api/decks/${deckId}/cards/${currentCard.id}/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProgress),
      })

      if (!response.ok) {
        throw new Error("Failed to update card progress")
      }

      // Update the local card data
      const updatedCards = [...cards]
      updatedCards[currentCardIndex] = {
        ...currentCard,
        progress: newProgress,
      }
      setCards(updatedCards)

      // Show a toast with the next review date
      toast({
        title: "Card scheduled",
        description: `Next review: ${getNextReviewText(newProgress)}`,
      })

      // Move to the next card
      moveToNextCard()
    } catch (error) {
      console.error("Error updating card progress:", error)
      toast({
        title: "Error",
        description: "Failed to update card progress",
        variant: "destructive",
      })
      // Still move to the next card even if there's an error
      moveToNextCard()
    }
  }

  const currentCard = cards[currentCardIndex]
  const isLastCard = currentCardIndex === cards.length - 1

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No cards to study</h2>
        <p className="text-gray-500 mb-6">There are no cards available for study in this session.</p>
        <Button asChild>
          <Link href={`/deck/${deckId}`}>Return to Deck</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/deck/${deckId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Studying: {deck.name}</h1>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          {isSpacedRepetitionEnabled && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Calendar className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Spaced Repetition Enabled</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          Card {currentCardIndex + 1} of {cards.length}
        </div>
      </div>

      {settings.studySettings.showProgressBar && <Progress value={progress} className="h-1" />}

      {showRating ? (
        <ConfidenceRatingComponent
          onRate={handleRating}
          onCancel={() => {
            setShowRating(false)
            moveToNextCard()
          }}
        />
      ) : (
        <div className={`card-flip ${isFlipped ? "flipped" : ""}`} onClick={handleFlip}>
          <div className="card-flip-inner relative h-[300px] w-full">
            <Card className="card-front absolute w-full h-full flex items-center justify-center p-8 cursor-pointer">
              <div className="text-center text-xl space-y-4">
                {currentCard.img_url && (
                  <img src={currentCard.img_url} alt="Card image" className="max-h-[200px] mx-auto mb-4" />
                )}
                <div>{currentCard.front}</div>
              </div>
            </Card>
            <Card className="card-back absolute w-full h-full flex items-center justify-center p-8 cursor-pointer">
              <div className="text-center space-y-4">
                {currentCard.img_url && (
                  <img src={currentCard.img_url} alt="Card image" className="max-h-[200px] mx-auto mb-4" />
                )}
                <div>{currentCard.back}</div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={handlePrevious} disabled={currentCardIndex === 0 || showRating}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={resetStudySession} disabled={showRating}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setIsAIChatOpen(true)} disabled={showRating}>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ask AI</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isFlipped && !isSpacedRepetitionEnabled && !showRating && (
            <>
              <Button variant="destructive" size="icon" onClick={handleNext}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" onClick={handleNext}>
                <Check className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {!showRating && (
          <Button
            variant={isFlipped ? "default" : "outline"}
            onClick={isFlipped ? handleNext : handleFlip}
            disabled={(isLastCard && isFlipped && studyComplete) || showRating}
          >
            {isFlipped ? (
              <>
                {isLastCard ? "Finish" : "Next"}
                {!isLastCard && <ArrowRight className="h-4 w-4 ml-2" />}
              </>
            ) : (
              "Flip"
            )}
          </Button>
        )}
      </div>

      {studyComplete && (
        <div className="text-center p-4 bg-secondary rounded-lg">
          <h3 className="font-medium">Study Session Complete!</h3>
          <p className="text-muted-foreground mt-1">You've reviewed all cards in this session.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="outline" onClick={resetStudySession}>
              <RotateCw className="h-4 w-4 mr-2" />
              Study Again
            </Button>
            <Button asChild>
              <Link href={`/deck/${deckId}`}>Return to Deck</Link>
            </Button>
          </div>
        </div>
      )}

      {currentCard && (
        <AIChat
          cardFront={currentCard.front}
          cardBack={currentCard.back}
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
        />
      )}
    </div>
  )
}
