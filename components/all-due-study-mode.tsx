"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Card as UICard } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Calendar, ArrowLeft, ArrowRight, Check, X, Maximize2, Minimize2 } from "lucide-react"
import Link from "next/link"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ConfidenceRating } from "@/lib/spaced-repetition"
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText, getRatingDescription } from "@/lib/spaced-repetition"
import { haptics } from "@/lib/haptics"

interface DueCardWithDeck {
  deckId: number
  deckName: string
  card: any
}

export function AllDueStudyMode() {
  const { decks, loading, getDueCards, updateCardProgress } = useDecks()
  const { settings, loading: settingsLoading } = useSettings()
  const { toast } = useToast()

  const [cards, setCards] = useState<DueCardWithDeck[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [progress, setProgress] = useState(0)
  const [studyComplete, setStudyComplete] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const hasInitializedRef = useRef(false)

  const studySettings: any = settings?.studySettings ?? {}
  const isSpacedRepetitionEnabled: boolean =
    typeof studySettings.enableSpacedRepetition === "boolean"
      ? studySettings.enableSpacedRepetition
      : true

  useEffect(() => {
    // Only load cards once on mount, not when decks array changes
    // (decks array changes when last_studied updates after rating a card)
    if (hasInitializedRef.current) return

    const loadDue = async () => {
      if (!decks || decks.length === 0) {
        setCards([])
        return
      }
      const results: DueCardWithDeck[] = []
      for (const deck of decks) {
        const due = await getDueCards(deck.id)
        for (const c of due) {
          results.push({ deckId: deck.id, deckName: deck.name, card: c })
        }
      }
      setCards(results)
      setCurrentIndex(0)
      setIsFlipped(false)
      setStudyComplete(results.length === 0)
      setProgress(results.length > 0 ? (0 / results.length) * 100 : 0)
      hasInitializedRef.current = true
    }
    void loadDue()
  }, [decks, getDueCards])

  useEffect(() => {
    if (cards.length === 0) return
    setProgress(((currentIndex + (studyComplete ? 1 : 0)) / cards.length) * 100)
  }, [currentIndex, cards.length, studyComplete])

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

  const handleFlip = () => {
    if (cards.length === 0 || studyComplete) return
    haptics.cardFlip()
    setIsFlipped((prev) => !prev)
  }

  const handleNext = () => {
    if (cards.length === 0) return
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsFlipped(false)
    } else {
      setStudyComplete(true)
      setIsFlipped(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setIsFlipped(false)
    }
  }

  const handleRating = async (rating: ConfidenceRating) => {
    if (cards.length === 0) return
    haptics.rating(rating)
    const entry = cards[currentIndex]
    const currentCard = entry.card
    const currentProgress = currentCard.progress || DEFAULT_CARD_PROGRESS
    const newProgress = calculateNextReview(currentProgress, rating)

    try {
      const success = await updateCardProgress(entry.deckId, currentCard.id, newProgress)
      if (!success) {
        throw new Error("Failed to update card progress")
      }

      const updated = [...cards]
      updated[currentIndex] = { ...entry, card: { ...currentCard, progress: newProgress } }
      setCards(updated)

      toast({
        title: "Card scheduled",
        description: `Next review: ${getNextReviewText(newProgress)}`,
      })

      handleNext()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update card progress",
        variant: "destructive",
      })
      handleNext()
    }
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
        // Swiped left - flip card (since spaced repetition is always enabled here)
        if (!isFlipped) {
          handleFlip()
        }
      } else {
        // Swiped right - previous card
        if (currentIndex > 0) {
          handlePrevious()
        }
      }
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (studyComplete) return

      switch (e.key) {
        case " ": // Space
        case "Enter":
          e.preventDefault()
          handleFlip()
          break
        case "0":
          if (isFlipped) {
            handleRating(0)
          }
          break
        case "1":
          if (isFlipped) {
            handleRating(1)
          }
          break
        case "2":
          if (isFlipped) {
            handleRating(2)
          }
          break
        case "3":
          if (isFlipped) {
            handleRating(3)
          }
          break
        case "4":
          if (isFlipped) {
            handleRating(4)
          }
          break
        case "5":
          if (isFlipped) {
            handleRating(5)
          }
          break
        case "ArrowLeft":
        case "Left":
          if (currentIndex > 0) {
            handlePrevious()
          }
          break
        case "ArrowRight":
        case "Right":
          // In spaced repetition mode, must rate the card (no skipping)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFlipped, currentIndex, studyComplete])

  const currentEntry = cards[currentIndex]
  const currentCard = currentEntry?.card

  if (loading || settingsLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-neutral-600">Loading decks and due cards...</p>
      </div>
    )
  }

  if (!currentCard || cards.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No cards due</h2>
        <p className="text-gray-500 mb-6">You have no cards due for review across your decks.</p>
        <Button asChild>
          <Link href="/">Back to decks</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-black">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          All due cards
          <span className="text-neutral-400">•</span>
          <span className="font-medium text-neutral-700">{currentEntry.deckName}</span>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" /> SR enabled
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-1.5 bg-neutral-200" />
      </div>

      {!studyComplete && (
        <>
          <div
            className={`card-flip ${isFlipped ? "flipped" : ""} transition-all duration-300`}
            onClick={handleFlip}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="card-flip-inner relative h-[60vh] md:h-[420px] max-h-[520px] w-full transition-transform duration-300 ease-in-out">
              <UICard className="card-front absolute w-full h-full flex items-center justify-center p-4 md:p-10 cursor-pointer bg-white border border-black/10 hover:border-black/30 rounded-xl shadow-sm hover:shadow transition-all duration-300">
                <div className="text-center text-2xl space-y-6 max-w-[88%]">
                  {currentCard.front_img_url && (
                    <div className="relative w-full flex justify-center items-center bg-neutral-100 rounded-md p-3">
                      <img
                        src={currentCard.front_img_url}
                        alt="Front side image"
                        className="max-h-[30vh] md:max-h-[240px] w-auto object-contain rounded-md"
                      />
                    </div>
                  )}
                  <div className="font-semibold text-2xl md:text-3xl leading-snug">{currentCard.front}</div>
                  <div className="hidden sm:block text-[11px] text-neutral-500 mt-4 absolute bottom-4 left-0 right-0 text-center">
                    Press <kbd className="px-1.5 py-0.5 border border-black/20 rounded text-[10px] bg-white">Space</kbd> to flip
                  </div>
                </div>
              </UICard>
              <UICard className="card-back absolute w-full h-full flex items-center justify-center p-4 md:p-10 cursor-pointer bg-white border border-black/10 hover:border-black/30 rounded-xl shadow-sm hover:shadow transition-all duration-300">
                <div className="text-center space-y-6 max-w-[88%]">
                  {currentCard.back_img_url && (
                    <div className="relative w-full flex justify-center items-center bg-neutral-100 rounded-md p-3">
                      <img
                        src={currentCard.back_img_url}
                        alt="Back side image"
                        className="max-h-[30vh] md:max-h-[240px] w-auto object-contain rounded-md"
                      />
                    </div>
                  )}
                  <div className="font-semibold text-xl md:text-2xl leading-snug">{currentCard.back}</div>
                  {isFlipped && (
                    <div className="mt-6 animate-fadeIn">
                      <div className="text-sm text-neutral-600 mb-3">How well did you know this? (Press 0-5)</div>
                      <div className="flex justify-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((rating) => {
                          let extra = ""
                          if (rating === 0) extra = "bg-neutral-100"
                          if (rating === 1) extra = "bg-neutral-200"
                          if (rating === 2) extra = "bg-neutral-300"
                          if (rating === 3) extra = "bg-neutral-400 text-white"
                          if (rating === 4) extra = "bg-neutral-600 text-white"
                          if (rating === 5) extra = "bg-black text-white"

                          return (
                            <Button
                              key={rating}
                              variant="outline"
                              className={`h-11 w-11 font-medium text-lg border border-black/20 ${extra} hover:scale-105 transition-all duration-150`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRating(rating as ConfidenceRating)
                              }}
                              title={getRatingDescription(rating as ConfidenceRating)}
                            >
                              {rating}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </UICard>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 border border-black/10 p-3 rounded-xl bg-white sticky bottom-0 z-10">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="border border-black/20 text-black hover:bg-black hover:text-white transition-all duration-150 h-11"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2 items-center text-xs text-neutral-500">
              <span>
                Card {currentIndex + 1} of {cards.length}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setFocusMode(!focusMode)}
                      className="border border-black/20 text-black hover:bg-black hover:text-white transition-all duration-150 h-11 w-11"
                    >
                      {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Button
              variant={isFlipped ? "default" : "outline"}
              onClick={isFlipped ? undefined : handleFlip}
              disabled={isFlipped && !isSpacedRepetitionEnabled}
              className={
                isFlipped
                  ? "group bg-black text-white hover:bg-neutral-800 hover:shadow transition-all duration-150 h-11 w-full sm:w-auto"
                  : "group border border-black/20 text-black hover:bg-black hover:text-white transition-all duration-150 h-11 w-full sm:w-auto"
              }
            >
              {isFlipped ? (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Flip
                  <kbd className="ml-2 px-1.5 py-0.5 border border-black/20 rounded text-[10px] bg-white text-black hidden sm:inline">Space</kbd>
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {studyComplete && (
        <div className="text-center p-6 bg-white border border-black/10 rounded-xl shadow-sm mt-6 animate-fadeIn">
          <div className="flex items-center justify-center mb-2">
            <div className="bg-black text-white p-2 rounded-full">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-xl ml-2">All Due Cards Reviewed</h3>
          </div>
          <p className="text-neutral-600 mt-1">
            You have finished reviewing all cards that were due across your decks.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild variant="outline" className="border border-black/20 text-black hover:bg-black hover:text-white">
              <Link href="/">Back to decks</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
