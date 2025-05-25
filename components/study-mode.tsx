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
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText, getRatingDescription } from "@/lib/spaced-repetition"
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
  const [studyComplete, setStudyComplete] = useState(false)
  const [cardsToReview, setCardsToReview] = useState<number[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  
  // Statistics tracking
  const [stats, setStats] = useState({
    totalCards: 0,
    cardsStudied: 0,
    knownCards: 0,
    unknownCards: 0,
    startTime: new Date(),
    endTime: null as Date | null,
    averageTimePerCard: 0,
    lastCardTime: new Date()
  })
  
  // For rating button hover effect
  const [hoveredRating, setHoveredRating] = useState<ConfidenceRating | null>(null)

  // Initialize cards based on spaced repetition setting
  useEffect(() => {
    if (deck) {
      let selectedCards;
      if (isSpacedRepetitionEnabled) {
        // Get only due cards when spaced repetition is enabled
        const dueCards = getDueCards(deckId)
        selectedCards = dueCards.slice(0, settings.studySettings.cardsPerSession);
      } else {
        // Get all cards when spaced repetition is disabled
        selectedCards = deck.cards.slice(0, settings.studySettings.cardsPerSession);
      }
      
      setCards(selectedCards);
      
      // Initialize statistics
      setStats(prev => ({
        ...prev,
        totalCards: selectedCards.length,
        cardsStudied: 0,
        knownCards: 0,
        unknownCards: 0,
        startTime: new Date(),
        endTime: null,
        averageTimePerCard: 0,
        lastCardTime: new Date()
      }));
    }
  }, [deck, deckId, isSpacedRepetitionEnabled, settings.studySettings.cardsPerSession, getDueCards])

  useEffect(() => {
    if (cards.length > 0) {
      setProgress((currentCardIndex / cards.length) * 100)
    }
  }, [currentCardIndex, cards.length])

  // Define all handler functions first before using them in useEffect
  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1)
      setIsFlipped(false)
    }
  }

  const resetStudySession = () => {
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setStudyComplete(false)
    setCardsToReview([])
    setReviewMode(false)
  }

  const moveToNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      // Still have cards to go through in the main deck
      setCurrentCardIndex((prev) => prev + 1)
      setIsFlipped(false)
    } else if (!reviewMode && cardsToReview.length > 0) {
      // Finished main deck, but have cards to review
      setReviewMode(true)
      // Sort the review cards to match their original order
      const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b)
      // Start with the first card that needs review
      setCurrentCardIndex(sortedReviewIndices[0])
      setIsFlipped(false)
      // Update toast to indicate review mode
      toast({
        title: "Review Mode",
        description: `Reviewing ${cardsToReview.length} cards that need attention`,
      })
    } else {
      // Completely done - either no cards to review or finished review mode
      setStudyComplete(true)
    }
  }

  const handleCardKnown = () => {
    // Card is known, move to next card without adding to review list
    updateStats(true);
    moveToNextCard();
  }

  const handleCardNeedsReview = () => {
    // Card needs review, add to review list
    if (!cardsToReview.includes(currentCardIndex)) {
      setCardsToReview(prev => [...prev, currentCardIndex])
    }
    updateStats(false);
    moveToNextCard();
  }

  const handleNext = () => {
    // Default next behavior (for backward compatibility)
    moveToNextCard()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ": // Space
        case "Enter":
          // Always flip the card with space/enter
          handleFlip()
          break
        case "1":
          // If card is flipped, mark as known/correct
          if (isFlipped) {
            if (isSpacedRepetitionEnabled) {
              // In spaced repetition mode, 1 = rating 5 (perfect)
              handleRating(5)
            } else {
              // In regular mode, 1 = card known (don't need to review again)
              handleCardKnown()
            }
          }
          break
        case "2":
          // If card is flipped, mark as unknown/incorrect
          if (isFlipped) {
            if (isSpacedRepetitionEnabled) {
              // In spaced repetition mode, 2 = rating 1 (incorrect)
              handleRating(1)
            } else {
              // In regular mode, 2 = card needs review
              handleCardNeedsReview()
            }
          }
          break
        case "3":
        case "4":
        case "5":
          if (isFlipped && isSpacedRepetitionEnabled) {
            const rating = parseInt(e.key) as ConfidenceRating
            handleRating(rating)
          }
          break
        case "0":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(0)
          }
          break
        case "ArrowRight":
        case "Right":
          if (isFlipped) {
            if (isSpacedRepetitionEnabled) {
              // Do nothing in spaced repetition mode - must rate the card
            } else {
              // In regular mode, right arrow = card known
              handleCardKnown()
            }
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
  }, [isFlipped, currentCardIndex, isSpacedRepetitionEnabled, reviewMode, cards.length])

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

  // These functions are now defined earlier in the component

  // These functions are now defined earlier in the component

  // Update statistics based on user response
  const updateStats = (isKnown: boolean) => {
    const now = new Date();
    const timeSpent = now.getTime() - stats.lastCardTime.getTime();
    
    setStats(prev => {
      const cardsStudied = prev.cardsStudied + 1;
      const knownCards = isKnown ? prev.knownCards + 1 : prev.knownCards;
      const unknownCards = !isKnown ? prev.unknownCards + 1 : prev.unknownCards;
      
      // Calculate new average time per card
      const totalTime = prev.cardsStudied === 0 
        ? timeSpent 
        : (prev.averageTimePerCard * prev.cardsStudied) + timeSpent;
      const averageTimePerCard = totalTime / cardsStudied;
      
      return {
        ...prev,
        cardsStudied,
        knownCards,
        unknownCards,
        averageTimePerCard,
        lastCardTime: now,
        endTime: cardsStudied === prev.totalCards ? now : prev.endTime
      };
    });
  };
  
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

      // Update statistics based on rating
      updateStats(rating >= 3);
      
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
      updateStats(rating >= 3);
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
      <div className="flex items-center justify-between mb-4 bg-muted/20 p-3 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="hover:bg-background hover:shadow-sm transition-all duration-200">
            <Link href={`/deck/${deckId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">
            {reviewMode ? "Review Mode: " : "Studying: "}
            {deck.name}
          </h1>
          {reviewMode && (
            <div className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/90 text-xs px-2 py-1 rounded-md animate-pulse">
              Reviewing cards that need attention
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isSpacedRepetitionEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary">SR Mode</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Spaced Repetition Enabled</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="bg-background px-2 py-0.5 rounded-md shadow-sm">
              {!reviewMode ? (
                <>Card {currentCardIndex + 1} of {cards.length}</>
              ) : (
                <>Review card {cardsToReview.indexOf(currentCardIndex) + 1} of {cardsToReview.length}</>
              )}
            </div>
          </div>
          
          {/* Mini stats display */}
          <div className="text-xs flex items-center gap-2 bg-background px-2 py-1 rounded-md shadow-sm">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center">
                  <span className="text-primary font-medium">{stats.knownCards}</span>
                  <Check className="h-3 w-3 text-primary ml-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cards you knew</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground">/</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center">
                  <span className="text-primary/70 font-medium">{stats.unknownCards}</span>
                  <X className="h-3 w-3 text-primary/70 ml-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cards you didn't know</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {settings.studySettings.showProgressBar && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      <div 
        className={`card-flip ${isFlipped ? "flipped" : ""} transition-all duration-300 hover:shadow-lg`} 
        onClick={handleFlip}
      >
        <div className="card-flip-inner relative h-[350px] w-full transition-transform duration-500 ease-in-out">
          <Card className="card-front absolute w-full h-full flex items-center justify-center p-8 cursor-pointer bg-gradient-to-br from-background to-background/80 border-2 hover:border-primary/30 transition-all duration-300">
            <div className="text-center text-xl space-y-6 max-w-[90%]">
              {currentCard.img_url && (
                <div className="relative w-full flex justify-center items-center bg-white/10 rounded-lg p-3 shadow-inner">
                  <img 
                    src={currentCard.img_url} 
                    alt="Card image" 
                    className="max-h-[220px] w-auto object-contain rounded-md shadow-md transform transition-transform duration-300 hover:scale-[1.02]" 
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
              )}
              <div className="font-medium text-2xl">{currentCard.front}</div>
              <div className="text-xs text-muted-foreground mt-4 absolute bottom-3 left-0 right-0 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd> to flip
              </div>
            </div>
          </Card>
          <Card className="card-back absolute w-full h-full flex items-center justify-center p-8 cursor-pointer bg-gradient-to-br from-background to-background/80 border-2 hover:border-primary/30 transition-all duration-300">
            <div className="text-center space-y-5 max-w-[90%]">
              {currentCard.img_url && (
                <div className="relative w-full flex justify-center items-center bg-white/10 rounded-lg p-3 shadow-inner">
                  <img 
                    src={currentCard.img_url} 
                    alt="Card image" 
                    className="max-h-[220px] w-auto object-contain rounded-md shadow-md" 
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
              )}
              <div className="font-medium text-xl">{currentCard.back}</div>
              
              {/* Show confidence rating buttons directly on the back of the card when using spaced repetition */}
              {isFlipped && (
                <div className="mt-6 animate-fadeIn">
                  {isSpacedRepetitionEnabled ? (
                    <>
                      <div className="text-sm text-muted-foreground mb-3">How well did you know this? (Press 0-5)</div>
                      <div className="flex justify-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((rating) => {
                          // Use different button variants based on rating
                          let variant = "outline"
                          let bgColor = ""
                          
                          if (rating < 2) {
                            variant = "destructive"
                            bgColor = "bg-primary/10"
                          } else if (rating < 3) {
                            variant = "destructive"
                            bgColor = "bg-primary/20"
                          } else if (rating < 4) {
                            variant = "default"
                            bgColor = "bg-primary/30"
                          } else if (rating < 5) {
                            variant = "default"
                            bgColor = "bg-primary/40"
                          } else {
                            variant = "default"
                            bgColor = "bg-primary/50"
                          }

                          return (
                            <Button
                              key={rating}
                              variant={variant as any}
                              className={`h-11 w-11 font-medium text-lg ${bgColor} hover:scale-110 transition-all duration-200`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRating(rating as ConfidenceRating)
                              }}
                              title={getRatingDescription(rating as ConfidenceRating)}
                              onMouseEnter={() => setHoveredRating(rating as ConfidenceRating)}
                              onMouseLeave={() => setHoveredRating(null)}
                            >
                              {rating}
                            </Button>
                          )
                        })}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {hoveredRating !== null && (
                          <div className="animate-fadeIn">{getRatingDescription(hoveredRating)}</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="text-sm text-muted-foreground mb-3">Did you know this card?</div>
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="default"
                          className="px-5 py-6 bg-primary/20 hover:bg-primary/30 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCardKnown()
                          }}
                        >
                          <Check className="h-5 w-5 mr-2" />
                          Yes (Press 1)
                        </Button>
                        <Button
                          variant="destructive"
                          className="px-5 py-6 bg-primary/10 hover:bg-primary/20 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCardNeedsReview()
                          }}
                        >
                          <X className="h-5 w-5 mr-2" />
                          No (Press 2)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 bg-muted/30 p-3 rounded-lg shadow-sm">
        <Button 
          variant="outline" 
          onClick={handlePrevious} 
          disabled={currentCardIndex === 0}
          className="hover:bg-background hover:shadow-sm transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={resetStudySession}
                  className="hover:bg-background hover:shadow-sm transition-all duration-200"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset Session</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={isAIChatOpen ? "default" : "outline"} 
                  size="icon" 
                  onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                  className={isAIChatOpen ? "" : "hover:bg-background hover:shadow-sm transition-all duration-200"}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ask AI about this card</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isFlipped && !isSpacedRepetitionEnabled && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="icon" 
                      onClick={handleCardKnown}
                      className="bg-primary/80 hover:bg-primary hover:scale-105 transition-all duration-200"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as known (Press 1)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={handleCardNeedsReview}
                      className="bg-primary/20 hover:bg-primary/30 hover:scale-105 transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark for review (Press 2)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>

        <Button
          variant={isFlipped ? "default" : "outline"}
          onClick={isFlipped ? (isSpacedRepetitionEnabled ? undefined : handleCardKnown) : handleFlip}
          disabled={(isLastCard && isFlipped && studyComplete) || (isFlipped && isSpacedRepetitionEnabled)}
          className={isFlipped ? 
            "bg-primary hover:bg-primary/90 hover:shadow-md transition-all duration-200" : 
            "hover:bg-background hover:shadow-sm transition-all duration-200"}
        >
            {isFlipped ? (
              <>
                {isLastCard ? "Finish" : "Next"}
                {!isLastCard && <ArrowRight className="h-4 w-4 ml-2" />}
              </>
            ) : (
              <>
                Flip
                <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd>
              </>
            )}
          </Button>
      </div>

      {studyComplete && (
        <div className="text-center p-6 bg-secondary rounded-lg shadow-md mt-6 animate-fadeIn">
          <div className="flex items-center justify-center mb-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-xl ml-2">Study Session Complete!</h3>
          </div>
          <p className="text-muted-foreground mt-1">
            {reviewMode 
              ? "You've completed reviewing all marked cards." 
              : cardsToReview.length > 0 
                ? `You've completed the initial review. ${cardsToReview.length} cards marked for further review.`
                : "You've reviewed all cards in this session."}
          </p>
          
          {/* Study Statistics */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm bg-background/50 p-4 rounded-lg shadow-inner">
            <div className="stats-card bg-background p-3 rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Cards Studied</span>
                <span className="font-bold text-2xl mt-1">{stats.cardsStudied}</span>
                <span className="text-xs text-muted-foreground">of {stats.totalCards}</span>
              </div>
            </div>
            
            <div className="stats-card bg-background p-3 rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Success Rate</span>
                <span className="font-bold text-2xl mt-1">
                  {stats.cardsStudied > 0 
                    ? `${Math.round((stats.knownCards / stats.cardsStudied) * 100)}%` 
                    : '0%'}
                </span>
              </div>
            </div>
            
            <div className="stats-card bg-background p-3 rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Known Cards</span>
                <div className="flex items-center mt-1">
                  <span className="font-bold text-2xl text-primary">{stats.knownCards}</span>
                  <Check className="h-4 w-4 text-primary ml-1" />
                </div>
              </div>
            </div>
            
            <div className="stats-card bg-background p-3 rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Need Review</span>
                <div className="flex items-center mt-1">
                  <span className="font-bold text-2xl text-primary/70">{stats.unknownCards}</span>
                  <X className="h-4 w-4 text-primary/70 ml-1" />
                </div>
              </div>
            </div>
            
            {stats.endTime && (
              <div className="stats-card bg-background p-3 rounded-md shadow-sm col-span-2">
                <div className="flex items-center justify-center">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Total Time</span>
                    <div className="font-bold text-xl mt-1">
                      {Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000)} seconds
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="stats-card bg-background p-3 rounded-md shadow-sm col-span-2">
              <div className="flex items-center justify-center">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Avg. Time per Card</span>
                  <div className="font-bold text-xl mt-1">
                    {Math.round(stats.averageTimePerCard / 1000)} seconds
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center gap-3">
            <Button 
              variant="outline" 
              onClick={resetStudySession}
              className="hover:bg-background hover:shadow-sm transition-all duration-200"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Study Again
            </Button>
            {!reviewMode && cardsToReview.length > 0 && (
              <Button 
                variant="default"
                onClick={() => {
                  setReviewMode(true)
                  // Sort the review cards to match their original order
                  const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b)
                  // Start with the first card that needs review
                  setCurrentCardIndex(sortedReviewIndices[0])
                  setIsFlipped(false)
                  setStudyComplete(false)
                }}
                className="bg-primary/70 hover:bg-primary/80 transition-all duration-200"
              >
                Review Marked Cards ({cardsToReview.length})
              </Button>
            )}
            <Button 
              asChild
              className="hover:shadow-sm transition-all duration-200"
            >
              <Link href={`/deck/${deckId}`}>Return to Deck</Link>
            </Button>
          </div>
        </div>
      )}

      {currentCard && (
        <div className="mt-6">
          <AIChat
            cardFront={currentCard.front}
            cardBack={currentCard.back}
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
