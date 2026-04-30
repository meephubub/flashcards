"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Check, X, RotateCw } from "lucide-react"
import { Link, useTransitionRouter } from "next-view-transitions"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { Skeleton } from "@/components/ui/skeleton"
import type { ConfidenceRating } from "@/lib/spaced-repetition"
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText } from "@/lib/spaced-repetition"
import { haptics } from "@/lib/haptics"
import { useToast } from "@/hooks/use-toast"
import { MarkdownCardContent } from "@/components/markdown-card-content"
import { LeechAlert, LeechBadge, LeechCounter } from "@/components/leech-alert"
import { isLeech, resetLeechStatus } from "@/lib/spaced-repetition"

interface StudyModeProps {
  deckId: number
  onProgressInfo?: (info: {
    current: number
    total: number
    reviewMode: boolean
    reviewCurrent: number
    reviewTotal: number
    remaining: number
    correct: number
    wrong: number
  }) => void
  onCardChange?: (card: any) => void
  initialSide?: "front" | "back" | "mixed"
  tag?: string
}

export function StudyMode({ deckId, onProgressInfo, onCardChange, initialSide = "front", tag }: StudyModeProps) {
  const { getDeck, loading, getDueCards, updateCardProgress } = useDecks()
  const { settings } = useSettings()
  const router = useTransitionRouter()
  const { toast } = useToast()

  const deck = getDeck(deckId)
  const rawStudy: any = settings?.studySettings ?? {}
  const normalizedStudy = {
    cardsPerSession:
      typeof rawStudy.cardsPerSession === "number" ? rawStudy.cardsPerSession : 20,
    showProgressBar:
      typeof rawStudy.showProgressBar === "boolean" ? rawStudy.showProgressBar : true,
    enableSpacedRepetition:
      typeof rawStudy.enableSpacedRepetition === "boolean"
        ? rawStudy.enableSpacedRepetition
        : true,
    fsrsParams: rawStudy.fsrsParams,
  }
  // Check both global setting AND deck-specific exclusion
  const isSpacedRepetitionEnabled = normalizedStudy.enableSpacedRepetition && !(deck?.exclude_from_srs)

  const [cards, setCards] = useState<any[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [initialSides, setInitialSides] = useState<boolean[]>([])
  const [progress, setProgress] = useState(0)
  const [studyComplete, setStudyComplete] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

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

  // Leech alert state
  const [leechAlertDismissed, setLeechAlertDismissed] = useState(false)

  const [reviewIndices, setReviewIndices] = useState<number[]>([])
  const [reviewCurrent, setReviewCurrent] = useState(0)

  // Reset leech alert dismissal when card changes
  useEffect(() => {
    setLeechAlertDismissed(false)
  }, [currentCardIndex, reviewCurrent, reviewMode])

  // Function to shuffle an array (Fisher-Yates algorithm)
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const computeInitialSides = (len: number, mode: "front" | "back" | "mixed"): boolean[] => {
    if (len <= 0) return []
    if (mode === "front") return Array(len).fill(false)
    if (mode === "back") return Array(len).fill(true)
    const arr: boolean[] = []
    for (let i = 0; i < len; i++) {
      arr.push(Math.random() < 0.5)
    }
    return arr
  }

  // Track if session has been initialized to prevent reset on navigation
  const [sessionInitialized, setSessionInitialized] = useState(false)
  // Track wrong cards to review at the end
  const [wrongCardIndices, setWrongCardIndices] = useState<number[]>([])

  // Initialize cards based on spaced repetition setting
  useEffect(() => {
    const initializeCards = async () => {
      // Prevent re-initialization if session already started
      if (sessionInitialized) return
      
      if (deck) {
        setSessionInitialized(true)
        let cardsToConsider: any[];
        if (isSpacedRepetitionEnabled) {
          // Get only due cards when spaced repetition is enabled AND deck is not excluded
          cardsToConsider = await getDueCards(deckId);
        } else {
          // Get all cards when spaced repetition is disabled globally OR for this deck
          // Ensure deck.cards exists and is an array before trying to shuffle/slice
          cardsToConsider = deck.cards || [];
        }

        // Apply tag filtering if specified
        if (tag) {
          cardsToConsider = cardsToConsider.filter(c => 
            c.tag && c.tag.split(',').map((t: string) => t.trim()).includes(tag)
          );
        }

        // Shuffle all available cards first
        const allShuffledCards = shuffleArray(cardsToConsider);
        // Then take the configured number of cards for the session
        const sessionCards = allShuffledCards.slice(0, normalizedStudy.cardsPerSession);
        setCards(sessionCards);
        const sides = computeInitialSides(sessionCards.length, initialSide)
        setInitialSides(sides)
        setIsFlipped(sides[0] ?? false)

        // Initialize statistics
        setStats({
          totalCards: sessionCards.length,
          cardsStudied: 0,
          knownCards: 0,
          unknownCards: 0,
          startTime: new Date(),
          endTime: null,
          averageTimePerCard: 0,
          lastCardTime: new Date()
        });
        // Reset wrong cards tracking
        setWrongCardIndices([])
      }
    };

    initializeCards();
  }, [deck, deckId, isSpacedRepetitionEnabled, normalizedStudy.cardsPerSession, getDueCards, tag, sessionInitialized])

  useEffect(() => {
    if (cards.length === 0) return
    const sides = computeInitialSides(cards.length, initialSide)
    setInitialSides(sides)
    const displayIndex = reviewMode ? reviewIndices[reviewCurrent] : currentCardIndex
    setIsFlipped(sides[displayIndex] ?? false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSide])

  useEffect(() => {
    if (cards.length === 0) return
    const displayIndex = reviewMode ? reviewIndices[reviewCurrent] : currentCardIndex
    setIsFlipped(initialSides[displayIndex] ?? false)
  }, [currentCardIndex, reviewMode, reviewCurrent])

  useEffect(() => {
    if (cards.length > 0) {
      setProgress((currentCardIndex / cards.length) * 100)
    }
  }, [currentCardIndex, cards.length])

  // Notify parent about progress info for header display
  useEffect(() => {
    if (typeof onProgressInfo === 'function') {
      const remaining = reviewMode
        ? Math.max(0, reviewIndices.length - reviewCurrent)
        : Math.max(0, cards.length - currentCardIndex)
      const info = {
        current: currentCardIndex + 1,
        total: cards.length,
        reviewMode,
        reviewCurrent: reviewCurrent + 1,
        reviewTotal: reviewIndices.length,
        remaining,
        correct: stats.knownCards,
        wrong: stats.unknownCards,
      }
      onProgressInfo(info)
    }
  }, [currentCardIndex, cards.length, reviewMode, reviewCurrent, reviewIndices.length, stats.knownCards, stats.unknownCards, onProgressInfo])

  const currentCard = reviewMode
    ? cards[reviewIndices[reviewCurrent]]
    : cards[currentCardIndex]

  // Notify parent about current card
  useEffect(() => {
    if (typeof onCardChange === 'function' && currentCard) {
      onCardChange(currentCard)
    }
  }, [currentCard, onCardChange])

  // Define all handler functions first before using them in useEffect
  const handleFlip = () => {
    haptics.cardFlip()
    setIsFlipped((prev) => !prev)
  }

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1)
    }
  }

  const resetStudySession = () => {
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setStudyComplete(false)
    setReviewMode(false)
    setReviewIndices([])
    setReviewCurrent(0)
    setWrongCardIndices([])
    setSessionInitialized(false) // Allow re-initialization
    setStats({
      totalCards: cards.length,
      cardsStudied: 0,
      knownCards: 0,
      unknownCards: 0,
      startTime: new Date(),
      endTime: null,
      averageTimePerCard: 0,
      lastCardTime: new Date()
    })
    setLeechAlertDismissed(false)
  }

  // Leech handling functions
  const handleResetLeech = async () => {
    if (!currentCard) return
    const resetProgress = resetLeechStatus(currentCard.progress || DEFAULT_CARD_PROGRESS)
    const success = await updateCardProgress(deckId, currentCard.id, resetProgress)
    if (success) {
      // Update local state
      const updatedCards = [...cards]
      const idx = reviewMode ? reviewIndices[reviewCurrent] : currentCardIndex
      updatedCards[idx] = {
        ...currentCard,
        progress: resetProgress,
      }
      setCards(updatedCards)
      toast({
        title: "Leech reset",
        description: "Card progress reset and leech status cleared.",
      })
    }
  }

  const handleEditLeech = () => {
    if (!currentCard) return
    router.push(`/deck/${deckId}/card/${currentCard.id}/edit`)
  }

  const handleSuspendLeech = async () => {
    if (!currentCard) return
    // Mark card as excluded from SRS
    const { updateCard } = useDecks()
    try {
      await updateCard(deckId, currentCard.id, currentCard.front, currentCard.back, currentCard.tag, currentCard.front_img_url, currentCard.back_img_url, true)
      toast({
        title: "Card suspended",
        description: "Card will no longer appear in spaced repetition reviews.",
      })
      // Move to next card
      moveToNextCard()
    } catch {
      toast({
        title: "Error",
        description: "Failed to suspend card",
        variant: "destructive",
      })
    }
  }

  const finishSession = () => {
    setIsFlipped(false)
    setReviewMode(false)
    setStudyComplete(true)
    setIsProcessing(false)
    // Capture endTime in stats
    setStats(prev => ({
      ...prev,
      endTime: new Date(),
    }))
  }

  const moveToNextCard = () => {
    if (reviewMode) {
      // In review mode, move to next review card or end session if done
      if (reviewIndices.length === 0) {
        finishSession()
        return
      }
      if (reviewCurrent < reviewIndices.length - 1) {
        setReviewCurrent((prev) => prev + 1)
      } else {
        setReviewCurrent(0)
      }
      setIsProcessing(false)
      return
    }
    
    // Normal mode navigation
    if (currentCardIndex < cards.length - 1) {
      // Move to next card
      setCurrentCardIndex((prev) => prev + 1)
      setIsFlipped(false)
      setIsProcessing(false)
    } else if (wrongCardIndices.length > 0) {
      // Enter review mode for wrong cards at the end
      setReviewMode(true)
      setReviewIndices([...wrongCardIndices])
      setReviewCurrent(0)
      setStudyComplete(false)
      setIsProcessing(false)
      toast({
        title: "Review Mode",
        description: `Reviewing ${wrongCardIndices.length} cards that need more practice`,
      })
    } else {
      finishSession()
    }
  }

  const handleCardKnown = () => {
    if (isProcessing) return
    setIsProcessing(true)
    updateStats(true);
    if (reviewMode) {
      // Remove this card from reviewIndices
      const currentReviewCardIndex = reviewIndices[reviewCurrent]
      const newReviewIndices = reviewIndices.filter((_, i) => i !== reviewCurrent)
      setReviewIndices(newReviewIndices)
      
      // Also remove from wrongCardIndices if present
      setWrongCardIndices(prev => prev.filter(idx => idx !== currentReviewCardIndex))
      
      if (newReviewIndices.length === 0) {
        finishSession()
        return
      }
      // If we removed the last card, go to the new last card
      if (reviewCurrent >= newReviewIndices.length) {
        setReviewCurrent(Math.max(0, newReviewIndices.length - 1))
      }
      setIsFlipped(false)
      setIsProcessing(false)
      return
    }
    moveToNextCard();
  }

  const handleCardNeedsReview = () => {
    if (isProcessing) return
    setIsProcessing(true)
    updateStats(false);
    
    if (reviewMode) {
      // In review mode, keep the card in review indices for another attempt
      // Just move to next card (it will cycle back around)
      setIsProcessing(false)
      moveToNextCard();
      return;
    }

    // Normal mode: add to wrong cards list for end-of-session review
    setWrongCardIndices(prev => {
      if (!prev.includes(currentCardIndex)) {
        return [...prev, currentCardIndex]
      }
      return prev
    });

    moveToNextCard();
  }

  const handleNext = () => {
    // Default next behavior (for backward compatibility)
    moveToNextCard()
  }

  // Touch gesture state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const deltaX = touchStart.x - touchEnd.x
    const deltaY = Math.abs(touchStart.y - touchEnd.y)

    // Only handle horizontal swipes (prevent accidental vertical swipes)
    if (Math.abs(deltaX) > minSwipeDistance && deltaY < 100) {
      if (deltaX > 0) {
        // Swiped left - next card or mark as known
        if (isFlipped) {
          if (isSpacedRepetitionEnabled) {
            // In spaced repetition mode, left swipe doesn't do anything (must rate)
            return
          } else {
            handleCardKnown()
          }
        } else {
          // If not flipped, flip the card
          handleFlip()
        }
      } else {
        // Swiped right - previous card or flip
        if (isFlipped) {
          // If flipped and not in spaced repetition, go to previous
          if (!isSpacedRepetitionEnabled && currentCardIndex > 0) {
            handlePrevious()
          }
        } else {
          // If not flipped, go to previous card
          handlePrevious()
        }
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return
      switch (e.key) {
        case " ": // Space
        case "Enter":
          if (!isFlipped) {
            handleFlip()
          } else if (isSpacedRepetitionEnabled) {
            handleRating(5)
          } else {
            handleCardKnown()
          }
          break
        case "1":
          if (isFlipped) {
            if (isSpacedRepetitionEnabled) {
              handleRating(1)
            } else {
              handleCardKnown()
            }
          }
          break
        case "2":
          if (isFlipped) {
            if (isSpacedRepetitionEnabled) {
              handleRating(2)
            } else {
              handleCardNeedsReview()
            }
          }
          break
        case "3":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(3)
          }
          break
        case "4":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(4)
          }
          break
        case "5":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(5)
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
        case "e":
        case "E":
          if (e.ctrlKey) {
            e.preventDefault()
            if (currentCard) {
              router.push(`/deck/${deckId}/card/${currentCard.id}/edit`)
            }
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFlipped, currentCardIndex, isSpacedRepetitionEnabled, reviewMode, cards.length, currentCard, deckId])

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
    if (isProcessing) return
    setIsProcessing(true)
    try {
      haptics.rating(rating)
      const currentCard = cards[currentCardIndex]
      const currentProgress = currentCard.progress || DEFAULT_CARD_PROGRESS
      const newProgress = calculateNextReview(currentProgress, rating, normalizedStudy.fsrsParams)
      const success = await updateCardProgress(deckId, currentCard.id, newProgress)
      if (!success) {
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
      const isCorrect = rating >= 3;
      updateStats(isCorrect);

      // If rating is low (0-2), add to wrong cards list for end-of-session review
      if (!isCorrect && !reviewMode) {
        // Add current card index to wrong cards list if not already there
        setWrongCardIndices(prev => {
          if (!prev.includes(currentCardIndex)) {
            return [...prev, currentCardIndex]
          }
          return prev
        })
      }

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
      const isCorrect = rating >= 3;
      updateStats(isCorrect);
      moveToNextCard()
    } finally {
      // isProcessing is mostly handled in moveToNextCard / useEffect
    }
  }

  const isLastCard = currentCardIndex === cards.length - 1

  // Helper for Cloze deletion
  const parseCloze = (text: string, isFlipped: boolean) => {
    const clozeRegex = /\{\{c(\d+)::(.*?)\}\}/g;
    if (isFlipped) {
      return text.replace(clozeRegex, "$2");
    }
    return text.replace(clozeRegex, " [...] ");
  };

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No cards to study</h2>
        <p className="text-gray-500 mb-6">There are no cards available for study in this session.</p>
        <Button
          variant="outline"
          asChild
          className="border border-black/20 text-black hover:bg-black hover:text-white transition-all duration-150"
        >
          <Link href={`/deck/${deckId}`}>Return to Deck</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto text-neutral-900 relative min-h-[80vh] flex flex-col">
      {reviewMode && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="inline-block w-1 h-1 rounded-full bg-neutral-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">review</span>
        </div>
      )}

      {/* Leech Alert */}
      {!studyComplete && isFlipped && currentCard?.progress && !leechAlertDismissed && (
        <div className="max-w-3xl mx-auto px-6 pt-2">
          <LeechAlert
            progress={currentCard.progress}
            onReset={handleResetLeech}
            onEdit={handleEditLeech}
            onSuspend={handleSuspendLeech}
            onDismiss={() => setLeechAlertDismissed(true)}
          />
        </div>
      )}

      {/* Leech Badge - show on front of card too */}
      {!studyComplete && !isFlipped && currentCard?.progress?.isLeech && (
        <div className="flex justify-center pt-2">
          <LeechBadge progress={currentCard.progress} />
        </div>
      )}

      {normalizedStudy.showProgressBar && !reviewMode && (
        <div className="absolute top-0 left-0 right-0">
          <div className="w-full h-px bg-neutral-100">
            <div
              className="h-full bg-neutral-300 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!studyComplete && (
        <>
          <div
            className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-6"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <motion.div
              className="w-full flex-1 flex flex-col items-center justify-center min-h-[50vh]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              key={currentCard?.id}
            >
              {/* Question Section */}
              <div className="w-full flex flex-col items-center justify-center">
                {currentCard.front_img_url && (
                  <div className="relative w-full flex justify-center items-center mb-8">
                    <img
                      src={currentCard.front_img_url}
                      alt="Front side image"
                      className="max-h-[30vh] md:max-h-[350px] w-auto object-contain rounded-xl"
                    />
                    {currentCard.occlusion_data && (
                      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {currentCard.occlusion_data.map((rect: any) => (
                            <rect
                              key={rect.id}
                              x={rect.x}
                              y={rect.y}
                              width={rect.w}
                              height={rect.h}
                              className={isFlipped ? "fill-neutral-500/20 stroke-neutral-500 stroke-2" : "fill-neutral-800/90"}
                            />
                          ))}
                        </svg>
                      </div>
                    )}
                  </div>
                )}
                {currentCard.audio_url && !isFlipped && (
                  <audio controls className="mx-auto h-8 opacity-50 mb-6">
                    <source src={currentCard.audio_url} />
                  </audio>
                )}
                <div className="w-full text-center">
                  <MarkdownCardContent
                    content={parseCloze(currentCard.front, isFlipped)}
                    className="text-2xl md:text-3xl text-neutral-900 leading-relaxed"
                  />
                </div>
                {/* Leech Counter - shows fail count */}
                {(currentCard.progress?.failCount || 0) > 0 && (
                  <div className="mt-2">
                    <LeechCounter progress={currentCard.progress} />
                  </div>
                )}
              </div>

              {/* Answer Section (Animated Reveal) */}
              <AnimatePresence>
                {isFlipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="w-full flex flex-col items-center mt-10"
                  >
                    <div className="h-px w-16 bg-neutral-200 mb-10" />
                    {currentCard.back_img_url && (
                      <div className="relative w-full flex justify-center items-center mb-6">
                        <img
                          src={currentCard.back_img_url}
                          alt="Back side image"
                          className="max-h-[250px] w-auto object-contain rounded-xl"
                        />
                      </div>
                    )}
                    {currentCard.video_url && (
                      <div className="w-full max-w-xl mx-auto rounded-xl overflow-hidden bg-black aspect-video mb-6">
                        <iframe
                          src={currentCard.video_url}
                          className="w-full h-full border-0"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                        />
                      </div>
                    )}
                    <div className="w-full text-center">
                      <MarkdownCardContent content={currentCard.back} className="text-xl md:text-2xl text-neutral-600 leading-relaxed" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Show/Rating Buttons (Pinned to Bottom of Content) */}
            {isSpacedRepetitionEnabled && (
              <div className="w-full pb-8">
                <AnimatePresence mode="wait">
                  {!isFlipped ? (
                    <motion.div
                      key="show-btn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className="w-full flex justify-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5 tabular-nums">space</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                          className="bg-neutral-900 text-white px-8 py-3 rounded-full text-base font-medium hover:bg-neutral-800 transition-all active:scale-[0.98]"
                        >
                          Show
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="rating-btns"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex justify-center items-end gap-3 w-full"
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5 tabular-nums">1</span>
                        <button
                          disabled={isProcessing}
                          className="bg-white border border-neutral-200 text-neutral-600 px-6 py-3 rounded-full text-base font-medium hover:border-neutral-400 hover:text-neutral-900 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                          onClick={(e) => { e.stopPropagation(); handleRating(1); }}
                        >
                          Again
                          <span className="text-neutral-400 text-sm tabular-nums">
                            {getNextReviewText(calculateNextReview(currentCard.progress || DEFAULT_CARD_PROGRESS, 1, normalizedStudy.fsrsParams))}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5 tabular-nums">space</span>
                        <button
                          disabled={isProcessing}
                          className="bg-neutral-900 text-white px-6 py-3 rounded-full text-base font-medium hover:bg-neutral-800 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                          onClick={(e) => { e.stopPropagation(); handleRating(5); }}
                        >
                          Good
                          <span className="text-neutral-400 text-sm tabular-nums">
                            {getNextReviewText(calculateNextReview(currentCard.progress || DEFAULT_CARD_PROGRESS, 5, normalizedStudy.fsrsParams))}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Minimal bottom nav - only show when spaced repetition is disabled */}
          {!isSpacedRepetitionEnabled && (
            <div className="flex justify-between items-center py-4 border-t border-neutral-100">
              <button
                onClick={handlePrevious}
                disabled={currentCardIndex === 0}
                className="text-neutral-400 hover:text-neutral-900 transition-colors text-sm disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-4">
                {isFlipped && (
                  <>
                    <button
                      onClick={handleCardKnown}
                      className="text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCardNeedsReview}
                      className="text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={isFlipped ? handleCardKnown : handleFlip}
                disabled={(isLastCard && isFlipped && studyComplete)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors text-sm disabled:opacity-30"
              >
                {isFlipped ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <span>Flip</span>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {studyComplete && (
        <div className="text-center py-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-neutral-200 mb-4">
            <Check className="h-4 w-4 text-black" />
          </div>
          <h3 className="font-semibold text-lg tracking-tight">Session complete</h3>
          <p className="text-sm text-neutral-400 mt-1 max-w-sm mx-auto">
            {reviewMode
              ? "You've completed reviewing all marked cards."
              : wrongCardIndices.length > 0
                ? `${wrongCardIndices.length} card${wrongCardIndices.length === 1 ? '' : 's'} need more practice.`
                : "All cards reviewed this session."}
          </p>

          {/* Inline stats */}
          <div className="mt-8 flex flex-wrap justify-center gap-8 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tabular-nums">{stats.cardsStudied}<span className="text-neutral-300 font-normal">/{stats.totalCards}</span></span>
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider mt-1">Studied</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tabular-nums">
                {stats.cardsStudied > 0
                  ? `${Math.round((stats.knownCards / stats.cardsStudied) * 100)}%`
                  : '0%'}
              </span>
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider mt-1">Accuracy</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tabular-nums text-black">{stats.knownCards}</span>
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider mt-1">Known</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tabular-nums text-neutral-400">{stats.unknownCards}</span>
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider mt-1">Review</span>
            </div>
          </div>

          {/* Time stats */}
          <div className="mt-6 flex justify-center gap-6 text-xs text-neutral-400">
            {stats.endTime && (
              <span>{Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000)}s total</span>
            )}
            <span>{Math.round(stats.averageTimePerCard / 1000)}s per card</span>
          </div>

          <div className="mt-8 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={resetStudySession}
              className="border-neutral-200 text-black hover:bg-black hover:text-white hover:border-black transition-colors duration-150 h-9 text-sm"
            >
              <RotateCw className="h-3.5 w-3.5 mr-1.5" />
              Study Again
            </Button>
            {!reviewMode && wrongCardIndices.length > 0 && (
              <Button
                variant="default"
                onClick={() => {
                  setReviewMode(true)
                  setReviewIndices([...wrongCardIndices])
                  setReviewCurrent(0)
                  setIsFlipped(false)
                  setStudyComplete(false)
                }}
                className="bg-black text-white hover:bg-neutral-800 transition-colors duration-150 h-9 text-sm"
              >
                Review {wrongCardIndices.length} card{wrongCardIndices.length === 1 ? '' : 's'}
              </Button>
            )}
            <Button
              variant="ghost"
              asChild
              className="text-neutral-500 hover:text-black transition-colors duration-150 h-9 text-sm"
            >
              <Link href={`/deck/${deckId}`}>Back to Deck</Link>
            </Button>
          </div>
        </div>
      )}


    </div>
  )
}
