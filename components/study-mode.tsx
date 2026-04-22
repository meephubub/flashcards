"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, RotateCw, Check, X, Calendar, Maximize2, Minimize2 } from "lucide-react"
import { Link } from "next-view-transitions"
import { Progress } from "@/components/ui/progress"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfidenceRatingComponent } from "@/components/confidence-rating"
import type { ConfidenceRating } from "@/lib/spaced-repetition"
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText, getRatingDescription } from "@/lib/spaced-repetition"
import { haptics } from "@/lib/haptics"
import { useToast } from "@/hooks/use-toast"
import { MarkdownCardContent } from "@/components/markdown-card-content"

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
  initialSide?: "front" | "back" | "mixed"
}

export function StudyMode({ deckId, onProgressInfo, initialSide = "front" }: StudyModeProps) {
  const { getDeck, loading, getDueCards, updateCardProgress } = useDecks()
  const { settings } = useSettings()
  const router = useRouter()
  const { toast } = useToast()

  const [focusMode, setFocusMode] = useState(false)

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
  const [cardsToReview, setCardsToReview] = useState<number[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const [pendingCardIndex, setPendingCardIndex] = useState<number | null>(null)
  const FLIP_ANIMATION_DURATION = 300 // ms, should match CSS duration

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

  const [reviewIndices, setReviewIndices] = useState<number[]>([])
  const [reviewCurrent, setReviewCurrent] = useState(0)

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

  // Initialize cards based on spaced repetition setting
  useEffect(() => {
    const initializeCards = async () => {
      if (deck) {
        let cardsToConsider: any[];
        if (isSpacedRepetitionEnabled) {
          // Get only due cards when spaced repetition is enabled AND deck is not excluded
          cardsToConsider = await getDueCards(deckId);
        } else {
          // Get all cards when spaced repetition is disabled globally OR for this deck
          // Ensure deck.cards exists and is an array before trying to shuffle/slice
          cardsToConsider = deck.cards || [];
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
        setStats(prev => ({
          ...prev,
          totalCards: sessionCards.length, // Use sessionCards.length here
          cardsStudied: 0,
          knownCards: 0,
          unknownCards: 0,
          startTime: new Date(),
          endTime: null as Date | null,
          averageTimePerCard: 0,
          lastCardTime: new Date()
        }));
      }
    };

    initializeCards();
  }, [deck, deckId, isSpacedRepetitionEnabled, normalizedStudy.cardsPerSession, getDueCards])

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
    setCardsToReview([])
    setReviewMode(false)
    setReviewIndices([])
    setReviewCurrent(0)
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
  }

  const finishSession = () => {
    setIsFlipped(false)
    setReviewMode(false)
    setStudyComplete(true)
    // ensure endTime is captured
    setStats(prev => ({
      ...prev,
      endTime: prev.endTime ?? new Date(),
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
      return
    }
    if (isFlipped) {
      // We're on the back of the card; flip first, then navigate/finish after animation
      setIsFlipped(false)
      // Decide next action:
      // - If there's a next card in the initial pass, go there
      // - Else if there are cards to review, enter review mode (use >= length sentinel already handled)
      // - Else finish session (use -1 sentinel to finish after animation)
      const nextPending =
        currentCardIndex < cards.length - 1
          ? currentCardIndex + 1
          : (!reviewMode && cardsToReview.length > 0)
            ? cards.length // triggers review mode in pending effect
            : -1 // sentinel to finish after animation
      setPendingCardIndex(nextPending)
    } else {
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((prev) => prev + 1)
      } else if (!reviewMode && cardsToReview.length > 0) {
        setReviewMode(true)
        const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b)
        setReviewIndices(sortedReviewIndices)
        setReviewCurrent(0)
        setStudyComplete(false)
        toast({
          title: "Review Mode",
          description: `Reviewing ${cardsToReview.length} cards that need attention`,
        })
      } else {
        finishSession()
      }
    }
  }

  const handleCardKnown = () => {
    updateStats(true);
    if (reviewMode) {
      // Remove this card from reviewIndices
      const idx = reviewIndices[reviewCurrent]
      const newReviewIndices = reviewIndices.filter((_, i) => i !== reviewCurrent)
      setReviewIndices(newReviewIndices)
      if (newReviewIndices.length === 0) {
        finishSession()
        return
      }
      // If we removed the last card, go to the new last card
      if (reviewCurrent >= newReviewIndices.length) {
        setReviewCurrent(Math.max(0, newReviewIndices.length - 1))
      }
      setIsFlipped(false)
      return
    }
    moveToNextCard();
  }

  const handleCardNeedsReview = () => {
    if (reviewMode) {
      // In review mode, re-insert the card randomly within the next few cards
      updateStats(false);
      const currentCard = cards[reviewIndices[reviewCurrent]];

      // Remove from review indices
      const newReviewIndices = reviewIndices.filter((_, i) => i !== reviewCurrent);

      if (newReviewIndices.length === 0) {
        // If this was the last card, just add it back
        setReviewIndices([reviewIndices[reviewCurrent]]);
      } else {
        // Re-insert at random position within the remaining cards (within next 3 cards or at end)
        const insertPos = Math.min(Math.floor(Math.random() * 3) + 1, newReviewIndices.length);
        newReviewIndices.splice(insertPos, 0, reviewIndices[reviewCurrent]);
        setReviewIndices(newReviewIndices);
      }
      return;
    }

    // Normal mode: re-insert the card randomly within the next few cards
    updateStats(false);
    const currentCard = cards[currentCardIndex];

    // Create new array without the current card
    const remainingCards = cards.slice(currentCardIndex + 1);
    const beforeCards = cards.slice(0, currentCardIndex + 1);

    // Re-insert at random position within the next few cards (within next 2-4 cards)
    // This ensures the wrong card comes up again soon but not immediately
    const insertOffset = Math.floor(Math.random() * 3) + 2; // 2-4 cards ahead
    const insertPos = Math.min(insertOffset, remainingCards.length);

    // Insert the card at the calculated position
    const newRemainingCards = [...remainingCards];
    newRemainingCards.splice(insertPos, 0, currentCard);

    // Reconstruct the full cards array
    const newCards = [...beforeCards, ...newRemainingCards];
    setCards(newCards);

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

  useEffect(() => {
    if (pendingCardIndex !== null) {
      const timer = setTimeout(() => {
        // Finish after animation if sentinel -1 was set
        if (pendingCardIndex === -1) {
          finishSession()
        } else if (!reviewMode && cardsToReview.length > 0 && pendingCardIndex >= cards.length) {
          // Enter review mode after animation
          setReviewMode(true)
          const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b)
          setReviewIndices(sortedReviewIndices)
          setReviewCurrent(0)
          setIsFlipped(false)
          toast({
            title: "Review Mode",
            description: `Reviewing ${cardsToReview.length} cards that need attention`,
          })
        } else {
          setCurrentCardIndex(pendingCardIndex)
        }
        setPendingCardIndex(null)
      }, FLIP_ANIMATION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [pendingCardIndex, reviewMode, cardsToReview, cards.length, toast])

  // Focus mode effect to hide/show header and sidebar
  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement
    const sidebar = document.querySelector('[data-sidebar="sidebar"]') as HTMLElement

    if (focusMode) {
      // Hide header and sidebar on mobile
      if (window.innerWidth < 768) {
        if (header) header.style.display = 'none'
        if (sidebar) sidebar.style.display = 'none'
      }
      // Prevent scrolling
      document.body.style.overflow = 'hidden'
    } else {
      // Show header and sidebar
      if (header) header.style.display = ''
      if (sidebar) sidebar.style.display = ''
      // Restore scrolling
      document.body.style.overflow = ''
    }

    return () => {
      // Cleanup on unmount
      if (header) header.style.display = ''
      if (sidebar) sidebar.style.display = ''
      document.body.style.overflow = ''
    }
  }, [focusMode])

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

      // If rating is low (0-2), re-insert card for immediate review
      if (!isCorrect && !reviewMode) {
        const currentCard = cards[currentCardIndex];
        const remainingCards = cards.slice(currentCardIndex + 1);
        const beforeCards = cards.slice(0, currentCardIndex + 1);

        // Re-insert at random position within next 2-4 cards
        const insertOffset = Math.floor(Math.random() * 3) + 2;
        const insertPos = Math.min(insertOffset, remainingCards.length);

        const newRemainingCards = [...remainingCards];
        newRemainingCards.splice(insertPos, 0, currentCard);
        setCards([...beforeCards, ...newRemainingCards]);
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
    }
  }

  const currentCard = reviewMode
    ? cards[reviewIndices[reviewCurrent]]
    : cards[currentCardIndex]
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
    <div className="w-full mx-auto space-y-4 text-black">
      {reviewMode && (
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
          <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium">Review mode</span>
        </div>
      )}

      {normalizedStudy.showProgressBar && (
        <div className="mb-1">
          <div className="w-full h-0.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!studyComplete && (
        <>
          <div
            className={`card-flip ${isFlipped ? "flipped" : ""} transition-all duration-300 mb-4`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="card-flip-inner relative h-[550px] md:h-[650px] lg:h-[700px] w-full">
              <Card
                className="card-front absolute w-full h-full flex items-center justify-center p-6 md:p-12 cursor-pointer bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl transition-colors duration-200"
                onClick={handleFlip}
              >
                <div className="text-center text-2xl space-y-6 max-w-[88%] w-full">
                  {currentCard.front_img_url && (
                    <div className="relative w-full flex justify-center items-center bg-neutral-100 rounded-md p-3">
                      <img
                        src={currentCard.front_img_url}
                        alt="Front side image"
                        className="max-h-[40vh] md:max-h-[400px] w-auto object-contain rounded-md"
                      />
                      {/* Diagram Occlusion Boxes (Front) */}
                      {currentCard.occlusion_data && (
                        <div className="absolute inset-0 m-3 overflow-hidden rounded-md pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {currentCard.occlusion_data.map((rect: any) => (
                              <rect
                                key={rect.id}
                                x={rect.x}
                                y={rect.y}
                                width={rect.w}
                                height={rect.h}
                                className="fill-blue-500/80 backdrop-blur-md"
                              />
                            ))}
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  {currentCard.audio_url && !isFlipped && (
                    <audio controls className="mx-auto h-8 opacity-70">
                      <source src={currentCard.audio_url} />
                    </audio>
                  )}
                  <div className="w-full flex justify-center">
                    <MarkdownCardContent 
                      content={parseCloze(currentCard.front, isFlipped)} 
                      className="font-semibold text-2xl md:text-3xl leading-snug" 
                    />
                  </div>
                  <div className="hidden sm:block text-[10px] text-neutral-300 absolute bottom-5 left-0 right-0 text-center">
                    Press <kbd className="px-1 py-0.5 border border-neutral-200 rounded text-[10px] bg-neutral-50 text-neutral-400">Space</kbd> to flip
                  </div>
                </div>
              </Card>
              <Card
                className="card-back absolute w-full h-full flex flex-col items-center justify-center p-6 md:p-10 bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl transition-colors duration-200 overflow-y-auto cursor-pointer"
                onClick={handleFlip}
              >
                <div className="text-center space-y-4 w-full max-w-[88%] flex-shrink-0">
                  {currentCard.front_img_url && (
                    <div className="relative w-full flex justify-center items-center bg-neutral-100 rounded-md p-3">
                      <img
                        src={currentCard.front_img_url}
                        alt="Front side image"
                        className="max-h-[200px] w-auto object-contain rounded-md opacity-50"
                      />
                      {/* Diagram Occlusion Boxes (Back - Revealed) */}
                      {currentCard.occlusion_data && (
                        <div className="absolute inset-0 m-3 overflow-hidden rounded-md pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {currentCard.occlusion_data.map((rect: any) => (
                              <rect
                                key={rect.id}
                                x={rect.x}
                                y={rect.y}
                                width={rect.w}
                                height={rect.h}
                                className="fill-blue-500/20 stroke-blue-500 stroke-2"
                              />
                            ))}
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  {currentCard.back_img_url && (
                    <div className="relative w-full flex justify-center items-center bg-neutral-100 rounded-md p-3">
                      <img
                        src={currentCard.back_img_url}
                        alt="Back side image"
                        className="max-h-[300px] w-auto object-contain rounded-md"
                      />
                    </div>
                  )}
                  {currentCard.video_url && isFlipped && (
                    <div className="w-full rounded-xl overflow-hidden bg-black aspect-video">
                      <iframe 
                        src={currentCard.video_url} 
                        className="w-full h-full border-0"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  )}
                  <div className="w-full flex justify-center">
                    <MarkdownCardContent content={currentCard.back} className="font-semibold text-xl md:text-2xl leading-snug" />
                  </div>

                  {/* Show confidence rating buttons directly on the back of the card when using spaced repetition */}
                  {isFlipped && (
                    <div className="mt-6 animate-fadeIn">
                      {isSpacedRepetitionEnabled ? (
                        <>
                          <div className="text-xs text-neutral-400 mb-3">Rate your recall (0–5)</div>
                          <div className="flex justify-center gap-2 flex-wrap">
                            {[0, 1, 2, 3, 4, 5].map((rating) => {
                              let extra = "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                              if (rating === 0) extra = "border-neutral-200 text-neutral-400 hover:border-neutral-400"
                              if (rating === 1) extra = "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                              if (rating === 2) extra = "border-neutral-300 text-neutral-600 hover:border-neutral-400"
                              if (rating === 3) extra = "border-neutral-300 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                              if (rating === 4) extra = "border-neutral-400 bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                              if (rating === 5) extra = "border-black bg-black text-white hover:bg-neutral-800"

                              return (
                                <Button
                                  key={rating}
                                  variant="outline"
                                  className={`h-9 w-9 text-sm font-medium ${extra} transition-colors duration-150 flex-shrink-0`}
                                  disableHaptics
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRating(rating as ConfidenceRating)
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
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
                          <div className="mt-2 text-[11px] text-neutral-400 min-h-[16px]">
                            {hoveredRating !== null && (
                              <div className="animate-fadeIn">{getRatingDescription(hoveredRating)}</div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 py-3 sticky bottom-0 z-10 bg-white/80 backdrop-blur-sm">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentCardIndex === 0}
              className="text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors duration-150 h-9 text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Prev
            </Button>

            <div className="flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={resetStudySession}
                      className="text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors duration-150 h-9 w-9"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
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
                      variant="ghost"
                      size="icon"
                      onClick={() => setFocusMode(!focusMode)}
                      className="text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors duration-150 h-9 w-9"
                    >
                      {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="w-px h-5 bg-neutral-200 mx-1" />

              {isFlipped && !isSpacedRepetitionEnabled && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCardKnown}
                          className="border-neutral-200 text-black hover:bg-black hover:text-white hover:border-black transition-colors duration-150 h-9 w-9"
                        >
                          <Check className="h-3.5 w-3.5" />
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
                          variant="outline"
                          size="icon"
                          onClick={handleCardNeedsReview}
                          className="border-neutral-200 text-neutral-500 hover:bg-black hover:text-white hover:border-black transition-colors duration-150 h-9 w-9"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mark for review (Press 2)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="w-px h-5 bg-neutral-200 mx-1" />
                </>
              )}

              <Button
                variant="ghost"
                onClick={finishSession}
                className="text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors duration-150 h-9 text-sm"
              >
                End
              </Button>
            </div>

            <Button
              variant={isFlipped ? "default" : "outline"}
              onClick={isFlipped ? (isSpacedRepetitionEnabled ? undefined : handleCardKnown) : handleFlip}
              disabled={(isLastCard && isFlipped && studyComplete) || (isFlipped && isSpacedRepetitionEnabled)}
              className={isFlipped ?
                "bg-black text-white hover:bg-neutral-800 transition-colors duration-150 h-9 text-sm" :
                "border-neutral-200 text-black hover:bg-black hover:text-white hover:border-black transition-colors duration-150 h-9 text-sm"}
            >
              {isFlipped ? (
                <>
                  {isLastCard ? "Finish" : "Next"}
                  {!isLastCard && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
                </>
              ) : (
                <>
                  Flip
                  <kbd className="ml-2 px-1 py-0.5 border border-neutral-200 rounded text-[10px] bg-neutral-50 text-neutral-400 hidden sm:inline">Space</kbd>
                </>
              )}
            </Button>
          </div>
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
              : cardsToReview.length > 0
                ? `${cardsToReview.length} card${cardsToReview.length === 1 ? '' : 's'} marked for further review.`
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
            {!reviewMode && cardsToReview.length > 0 && (
              <Button
                variant="default"
                onClick={() => {
                  setReviewMode(true)
                  const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b)
                  setReviewIndices(sortedReviewIndices)
                  setReviewCurrent(0)
                  setIsFlipped(false)
                  setStudyComplete(false)
                }}
                className="bg-black text-white hover:bg-neutral-800 transition-colors duration-150 h-9 text-sm"
              >
                Review {cardsToReview.length} card{cardsToReview.length === 1 ? '' : 's'}
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
