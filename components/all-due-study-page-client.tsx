"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useXp } from "@/hooks/use-xp";
import { StudyMode } from "@/components/study-mode";
import { AppSidebar } from "@/components/notes/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { isOnline, loadDecksMeta } from "@/lib/offline";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTimeTracking } from "@/hooks/use-time-tracking";
import { Link } from "next-view-transitions";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardInfoDialog } from "@/components/card-info-dialog";
import { DecksActionSearchBar } from "@/components/action-search-bar/decks/action-search-bar";

export function AllDueStudyPageClient() {
  const { session, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  
  // Get study mode from query params
  const rawMode = searchParams.get("mode") || "due";
  const validModes = ["due", "ahead", "new", "review"] as const;
  const mode = validModes.includes(rawMode as any) ? rawMode : "due";
  const days = parseInt(searchParams.get("days") || "7", 10);
  const noSchedule = searchParams.get("noSchedule") === "true";
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    reviewMode: boolean;
    reviewCurrent: number;
    reviewTotal: number;
    remaining: number;
    correct: number;
    wrong: number;
  } | null>(null);
  const [initialSide, setInitialSide] = useState<"front" | "back" | "mixed">("front");
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useTimeTracking({
    activityType: 'study',
    subjectId: 'all-due',
    isEnabled: !!user
  });

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/");
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-black">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-black/10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-2 px-3 text-sm text-neutral-600 w-full">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link href="/">Decks</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <div className="flex items-center gap-1">
                      <BreadcrumbPage>All Due Cards</BreadcrumbPage>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-neutral-400 hover:text-black transition-colors rounded-full"
                        onClick={() => setIsInfoOpen(true)}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-3 pr-1">
                {progressInfo && (
                  <div className="flex items-center gap-3 text-xs text-neutral-500 tabular-nums">
                    <span>{progressInfo.remaining} left</span>
                    <span className="h-3 w-px bg-black/10" />
                    <span className="text-neutral-800">{progressInfo.correct} ✓</span>
                    <span className="h-3 w-px bg-black/10" />
                    <span className="text-neutral-400">{progressInfo.wrong} ✗</span>
                  </div>
                )}
                <Select value={initialSide} onValueChange={(v) => setInitialSide(v as any)}>
                  <SelectTrigger className="h-8 w-[150px] rounded-md border-black/10 text-xs">
                    <SelectValue placeholder="Card side" />
                  </SelectTrigger>
                  <SelectContent className="text-sm">
                    <SelectItem value="front">Front first</SelectItem>
                    <SelectItem value="back">Back first</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto flex flex-col">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10 flex-1 flex flex-col justify-center">
              <AllDueStudyMode 
                onProgressInfo={setProgressInfo} 
                onCardChange={setCurrentCard}
                initialSide={initialSide}
                mode={mode as "due" | "ahead" | "new" | "review"}
                days={days}
                noSchedule={noSchedule}
              />
            </div>
          </div>
          <CardInfoDialog 
            card={currentCard} 
            open={isInfoOpen} 
            onOpenChange={setIsInfoOpen} 
          />
        </SidebarInset>
      </SidebarProvider>
      <DecksActionSearchBar />
    </div>
  );
}

// New AllDueStudyMode component using the modern StudyMode UI patterns
import { useDecks } from "@/context/deck-context";
import { useSettings } from "@/context/settings-context";
import { useToast } from "@/hooks/use-toast";
import type { ConfidenceRating } from "@/lib/spaced-repetition";
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText } from "@/lib/spaced-repetition";
import { haptics } from "@/lib/haptics";
import { MarkdownCardContent } from "@/components/markdown-card-content";
import { motion, AnimatePresence } from "framer-motion";

interface DueCardWithDeck {
  deckId: number;
  deckName: string;
  card: any;
}

interface AllDueStudyModeProps {
  onProgressInfo?: (info: {
    current: number;
    total: number;
    reviewMode: boolean;
    reviewCurrent: number;
    reviewTotal: number;
    remaining: number;
    correct: number;
    wrong: number;
  }) => void;
  onCardChange?: (card: any) => void;
  initialSide?: "front" | "back" | "mixed";
  mode?: "due" | "ahead" | "new" | "review";
  days?: number;
  noSchedule?: boolean;
}

function AllDueStudyMode({ 
  onProgressInfo, 
  onCardChange, 
  initialSide = "front",
  mode = "due",
  days = 7,
  noSchedule = false
}: AllDueStudyModeProps) {
  const { decks, loading, getDueCards, updateCardProgress } = useDecks();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { totalXp, addXp } = useXp();

  const [cards, setCards] = useState<DueCardWithDeck[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [initialSides, setInitialSides] = useState<boolean[]>([]);
  const [progress, setProgress] = useState(0);
  const [studyComplete, setStudyComplete] = useState(false);
  const [cardsToReview, setCardsToReview] = useState<number[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const FLIP_ANIMATION_DURATION = 300;

  const [stats, setStats] = useState({
    totalCards: 0,
    cardsStudied: 0,
    knownCards: 0,
    unknownCards: 0,
    startTime: new Date(),
    endTime: null as Date | null,
    averageTimePerCard: 0,
    lastCardTime: new Date()
  });

  // XP System state
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [targetStreak, setTargetStreak] = useState(() => Math.floor(Math.random() * 5) + 1);
  const [xpBonus, setXpBonus] = useState(0);
  const [showXpPopup, setShowXpPopup] = useState(false);

  const [reviewIndices, setReviewIndices] = useState<number[]>([]);
  const [reviewCurrent, setReviewCurrent] = useState(0);
  const isNavigatingRef = useRef(false);

  const rawStudy: any = settings?.studySettings ?? {};
  const normalizedStudy = {
    cardsPerSession: typeof rawStudy.cardsPerSession === "number" ? rawStudy.cardsPerSession : 50,
    showProgressBar: typeof rawStudy.showProgressBar === "boolean" ? rawStudy.showProgressBar : true,
    enableSpacedRepetition: typeof rawStudy.enableSpacedRepetition === "boolean" ? rawStudy.enableSpacedRepetition : true,
    fsrsParams: rawStudy.fsrsParams,
  };
  const isSpacedRepetitionEnabled = normalizedStudy.enableSpacedRepetition;

  // Helper to filter cards based on mode
  const filterCardsByMode = (allCards: any[], mode: string, days: number): any[] => {
    const now = new Date();
    
    switch (mode) {
      case "due":
        // Cards with due_date <= now
        return allCards.filter(c => {
          if (!c.progress?.due_date) return false;
          return new Date(c.progress.due_date) <= now;
        });
      
      case "ahead":
        // Cards due within X days
        return allCards.filter(c => {
          if (!c.progress?.due_date) return c.progress?.repetitions > 0;
          const dueDate = new Date(c.progress.due_date);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilDue <= days && daysUntilDue >= 0;
        });
      
      case "new":
        // Cards with no progress or repetitions = 0
        return allCards.filter(c => !c.progress || c.progress.repetitions === 0);
      
      case "review":
        // Cards with progress and repetitions > 0
        return allCards.filter(c => c.progress && c.progress.repetitions > 0);
      
      default:
        return allCards;
    }
  };

  // XP Calculation helper
  const calculateXp = (streak: number, cardProgress: any): number => {
    // Base XP: 10 points per correct answer
    let xp = 10;
    
    // Streak multiplier: +20% per consecutive correct (max 100% bonus at streak 5)
    const streakMultiplier = 1 + Math.min(streak * 0.2, 1);
    xp = Math.round(xp * streakMultiplier);
    
    // FSRS difficulty bonus: harder cards = more XP
    if (cardProgress) {
      const { ease_factor, repetitions } = cardProgress;
      // Lower ease factor = harder card = more XP
      if (ease_factor && ease_factor < 2.0) {
        xp += 5; // Bonus for hard cards
      }
      // More repetitions = mastered card = slightly less XP
      if (repetitions && repetitions > 5) {
        xp -= 3; // Slightly less for easy cards
      }
    }
    
    return Math.max(xp, 5); // Minimum 5 XP
  };

  // Initialize cards from all decks
  useEffect(() => {
    const initializeCards = async () => {
      if (!decks || decks.length === 0) {
        setCards([]);
        return;
      }

      // Gather cards from all decks based on mode
      const cardsByDeck: DueCardWithDeck[][] = [];
      for (const deck of decks) {
        let cardsToUse: any[] = [];
        
        if (mode === "due") {
          // Use existing getDueCards for due mode
          cardsToUse = await getDueCards(deck.id);
        } else {
          // For other modes, get all cards and filter
          cardsToUse = filterCardsByMode(deck.cards || [], mode, days);
        }
        
        if (cardsToUse.length > 0) {
          cardsByDeck.push(cardsToUse.map(c => ({ deckId: deck.id, deckName: deck.name, card: c })));
        }
      }

      // Interleave cards from different decks (round-robin) for topic mixing
      const results: DueCardWithDeck[] = [];
      let deckIndex = 0;
      while (cardsByDeck.some(deckCards => deckCards.length > 0)) {
        // Find next deck with remaining cards
        let attempts = 0;
        while (attempts < cardsByDeck.length) {
          const currentDeck = cardsByDeck[deckIndex % cardsByDeck.length];
          if (currentDeck && currentDeck.length > 0) {
            results.push(currentDeck.shift()!);
            break;
          }
          deckIndex++;
          attempts++;
        }
        deckIndex++;
      }

      // Limit to cards per session
      const sessionCards = results.slice(0, normalizedStudy.cardsPerSession);
      setCards(sessionCards);
      
      const sides = computeInitialSides(sessionCards.length, initialSide);
      setInitialSides(sides);
      setIsFlipped(sides[0] ?? false);
      
      setStats(prev => ({
        ...prev,
        totalCards: sessionCards.length,
        cardsStudied: 0,
        knownCards: 0,
        unknownCards: 0,
        startTime: new Date(),
        endTime: null,
        averageTimePerCard: 0,
        lastCardTime: new Date()
      }));
    };

    initializeCards();
  }, [decks, getDueCards, initialSide, normalizedStudy.cardsPerSession]);

  useEffect(() => {
    if (cards.length === 0) return;
    const sides = computeInitialSides(cards.length, initialSide);
    setInitialSides(sides);
    const displayIndex = reviewMode ? reviewIndices[reviewCurrent] : currentCardIndex;
    setIsFlipped(sides[displayIndex] ?? false);
  }, [initialSide]);

  useEffect(() => {
    if (cards.length === 0) return;
    // Don't sync isFlipped during navigation - let the pendingCardIndex effect handle it
    if (isNavigatingRef.current) return;
    const displayIndex = reviewMode ? reviewIndices[reviewCurrent] : currentCardIndex;
    setIsFlipped(initialSides[displayIndex] ?? false);
  }, [currentCardIndex, reviewMode, reviewCurrent]);

  useEffect(() => {
    if (cards.length > 0) {
      setProgress((currentCardIndex / cards.length) * 100);
    }
  }, [currentCardIndex, cards.length]);

  // Notify parent about progress
  useEffect(() => {
    if (typeof onProgressInfo === 'function') {
      const remaining = reviewMode
        ? Math.max(0, reviewIndices.length - reviewCurrent)
        : Math.max(0, cards.length - currentCardIndex);
      const info = {
        current: currentCardIndex + 1,
        total: cards.length,
        reviewMode,
        reviewCurrent: reviewCurrent + 1,
        reviewTotal: reviewIndices.length,
        remaining,
        correct: stats.knownCards,
        wrong: stats.unknownCards,
      };
      onProgressInfo(info);
    }
  }, [currentCardIndex, cards.length, reviewMode, reviewCurrent, reviewIndices.length, stats.knownCards, stats.unknownCards, onProgressInfo]);

  const currentEntry = reviewMode
    ? cards[reviewIndices[reviewCurrent]]
    : cards[currentCardIndex];
  const currentCard = currentEntry?.card;

  useEffect(() => {
    if (typeof onCardChange === 'function' && currentCard) {
      onCardChange(currentCard);
    }
  }, [currentCard, onCardChange]);

  const computeInitialSides = (len: number, mode: "front" | "back" | "mixed"): boolean[] => {
    if (len <= 0) return [];
    if (mode === "front") return Array(len).fill(false);
    if (mode === "back") return Array(len).fill(true);
    const arr: boolean[] = [];
    for (let i = 0; i < len; i++) {
      arr.push(Math.random() < 0.5);
    }
    return arr;
  };

  const handleFlip = () => {
    haptics.cardFlip();
    setIsFlipped((prev) => !prev);
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
    }
  };

  const finishSession = () => {
    setIsFlipped(false);
    setReviewMode(false);
    setStudyComplete(true);
    setIsProcessing(false);
    setStats(prev => ({
      ...prev,
      endTime: prev.endTime ?? new Date(),
    }));
  };

  const moveToNextCard = () => {
    if (reviewMode) {
      if (reviewIndices.length === 0) {
        finishSession();
        return;
      }
      if (reviewCurrent < reviewIndices.length - 1) {
        setReviewCurrent((prev) => prev + 1);
      } else {
        setReviewCurrent(0);
      }
      setIsProcessing(false);
      return;
    }
    if (isFlipped) {
      isNavigatingRef.current = true;
      setIsFlipped(false);
      const nextPending =
        currentCardIndex < cards.length - 1
          ? currentCardIndex + 1
          : (!reviewMode && cardsToReview.length > 0)
            ? cards.length
            : -1;
      setPendingCardIndex(nextPending);
    } else {
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((prev) => prev + 1);
        setIsProcessing(false);
      } else if (!reviewMode && cardsToReview.length > 0) {
        setReviewMode(true);
        const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b);
        setReviewIndices(sortedReviewIndices);
        setReviewCurrent(0);
        setStudyComplete(false);
        setIsProcessing(false);
        toast({
          title: "Review Mode",
          description: `Reviewing ${cardsToReview.length} cards that need attention`,
        });
      } else {
        finishSession();
      }
    }
  };

  const handleCardKnown = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    updateStats(true, currentCard?.progress);
    if (reviewMode) {
      const idx = reviewIndices[reviewCurrent];
      const newReviewIndices = reviewIndices.filter((_, i) => i !== reviewCurrent);
      setReviewIndices(newReviewIndices);
      if (newReviewIndices.length === 0) {
        finishSession();
        return;
      }
      if (reviewCurrent >= newReviewIndices.length) {
        setReviewCurrent(Math.max(0, newReviewIndices.length - 1));
      }
      setIsFlipped(false);
      setIsProcessing(false);
      return;
    }
    moveToNextCard();
  };

  const handleCardNeedsReview = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    if (reviewMode) {
      updateStats(false, currentCard?.progress);
      const newReviewIndices = reviewIndices.filter((_, i) => i !== reviewCurrent);
      if (newReviewIndices.length === 0) {
        setReviewIndices([reviewIndices[reviewCurrent]]);
      } else {
        const insertPos = Math.min(Math.floor(Math.random() * 3) + 1, newReviewIndices.length);
        newReviewIndices.splice(insertPos, 0, reviewIndices[reviewCurrent]);
        setReviewIndices(newReviewIndices);
      }
      setIsProcessing(false);
      return;
    }

    updateStats(false, currentCard?.progress);
    const currentEntry = cards[currentCardIndex];
    const remainingCards = cards.slice(currentCardIndex + 1);
    const beforeCards = cards.slice(0, currentCardIndex + 1);
    const insertOffset = Math.floor(Math.random() * 3) + 2;
    const insertPos = Math.min(insertOffset, remainingCards.length);
    const newRemainingCards = [...remainingCards];
    newRemainingCards.splice(insertPos, 0, currentEntry);
    setCards([...beforeCards, ...newRemainingCards]);
    moveToNextCard();
  };

  const updateStats = (isKnown: boolean, cardProgress?: any) => {
    const now = new Date();
    const timeSpent = now.getTime() - stats.lastCardTime.getTime();

    // Update streak and check for XP trigger
    if (isKnown) {
      const newStreak = consecutiveCorrect + 1;
      setConsecutiveCorrect(newStreak);
      
      // Check if streak reached target
      if (newStreak >= targetStreak) {
        const xp = calculateXp(newStreak, cardProgress);
        setXpBonus(xp);
        addXp(xp); // Persist XP to database
        setShowXpPopup(true);
        
        // Reset for next round
        setConsecutiveCorrect(0);
        setTargetStreak(Math.floor(Math.random() * 5) + 1);
        
        // Hide popup after animation
        setTimeout(() => setShowXpPopup(false), 2000);
      }
    } else {
      // Reset streak on wrong answer
      setConsecutiveCorrect(0);
      setTargetStreak(Math.floor(Math.random() * 5) + 1);
    }

    setStats(prev => {
      const cardsStudied = prev.cardsStudied + 1;
      const knownCards = isKnown ? prev.knownCards + 1 : prev.knownCards;
      const unknownCards = !isKnown ? prev.unknownCards + 1 : prev.unknownCards;
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
    if (isProcessing || !currentEntry) return;
    setIsProcessing(true);
    
    // If noSchedule is true, skip updating card progress (study ahead without affecting scheduling)
    if (noSchedule) {
      haptics.rating(rating);
      const isCorrect = rating >= 3;
      updateStats(isCorrect, currentCard?.progress);
      
      if (!isCorrect && !reviewMode) {
        const currentEntry = cards[currentCardIndex];
        const remainingCards = cards.slice(currentCardIndex + 1);
        const beforeCards = cards.slice(0, currentCardIndex + 1);
        const insertOffset = Math.floor(Math.random() * 3) + 2;
        const insertPos = Math.min(insertOffset, remainingCards.length);
        const newRemainingCards = [...remainingCards];
        newRemainingCards.splice(insertPos, 0, currentEntry);
        setCards([...beforeCards, ...newRemainingCards]);
      }
      
      moveToNextCard();
      return;
    }
    
    try {
      haptics.rating(rating);
      const currentProgress = currentCard.progress || DEFAULT_CARD_PROGRESS;
      const newProgress = calculateNextReview(currentProgress, rating, normalizedStudy.fsrsParams);
      const success = await updateCardProgress(currentEntry.deckId, currentCard.id, newProgress);
      if (!success) {
        throw new Error("Failed to update card progress");
      }

      const updatedCards = [...cards];
      updatedCards[currentCardIndex] = {
        ...currentEntry,
        card: {
          ...currentCard,
          progress: newProgress,
        }
      };
      setCards(updatedCards);

      toast({
        title: "Card scheduled",
        description: `Next review: ${getNextReviewText(newProgress)}`,
      });

      const isCorrect = rating >= 3;
      updateStats(isCorrect, currentCard?.progress);

      if (!isCorrect && !reviewMode) {
        const currentEntry = cards[currentCardIndex];
        const remainingCards = cards.slice(currentCardIndex + 1);
        const beforeCards = cards.slice(0, currentCardIndex + 1);
        const insertOffset = Math.floor(Math.random() * 3) + 2;
        const insertPos = Math.min(insertOffset, remainingCards.length);
        const newRemainingCards = [...remainingCards];
        newRemainingCards.splice(insertPos, 0, currentEntry);
        setCards([...beforeCards, ...newRemainingCards]);
      }

      moveToNextCard();
    } catch (error) {
      console.error("Error updating card progress:", error);
      toast({
        title: "Error",
        description: "Failed to update card progress",
        variant: "destructive",
      });
      const isCorrect = rating >= 3;
      updateStats(isCorrect, currentCard?.progress);
      moveToNextCard();
    }
  };

  const resetStudySession = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyComplete(false);
    setCardsToReview([]);
    setReviewMode(false);
    setReviewIndices([]);
    setReviewCurrent(0);
    setStats({
      totalCards: cards.length,
      cardsStudied: 0,
      knownCards: 0,
      unknownCards: 0,
      startTime: new Date(),
      endTime: null,
      averageTimePerCard: 0,
      lastCardTime: new Date()
    });
    // Re-initialize cards with interleaving and mode filtering
    const initializeCards = async () => {
      if (!decks || decks.length === 0) return;

      // Gather cards from all decks based on mode
      const cardsByDeck: DueCardWithDeck[][] = [];
      for (const deck of decks) {
        let cardsToUse: any[] = [];
        
        if (mode === "due") {
          // Use existing getDueCards for due mode
          cardsToUse = await getDueCards(deck.id);
        } else {
          // For other modes, get all cards and filter
          cardsToUse = filterCardsByMode(deck.cards || [], mode, days);
        }
        
        if (cardsToUse.length > 0) {
          cardsByDeck.push(cardsToUse.map(c => ({ deckId: deck.id, deckName: deck.name, card: c })));
        }
      }

      // Interleave cards from different decks (round-robin) for topic mixing
      const results: DueCardWithDeck[] = [];
      let deckIndex = 0;
      while (cardsByDeck.some(deckCards => deckCards.length > 0)) {
        let attempts = 0;
        while (attempts < cardsByDeck.length) {
          const currentDeck = cardsByDeck[deckIndex % cardsByDeck.length];
          if (currentDeck && currentDeck.length > 0) {
            results.push(currentDeck.shift()!);
            break;
          }
          deckIndex++;
          attempts++;
        }
        deckIndex++;
      }

      const sessionCards = results.slice(0, normalizedStudy.cardsPerSession);
      setCards(sessionCards);
      const sides = computeInitialSides(sessionCards.length, initialSide);
      setInitialSides(sides);
      setIsFlipped(sides[0] ?? false);
    };
    initializeCards();
  };

  useEffect(() => {
    if (pendingCardIndex !== null) {
      const timer = setTimeout(() => {
        if (pendingCardIndex === -1) {
          finishSession();
        } else if (!reviewMode && cardsToReview.length > 0 && pendingCardIndex >= cards.length) {
          setReviewMode(true);
          const sortedReviewIndices = [...cardsToReview].sort((a, b) => a - b);
          setReviewIndices(sortedReviewIndices);
          setReviewCurrent(0);
          setIsFlipped(false);
          toast({
            title: "Review Mode",
            description: `Reviewing ${cardsToReview.length} cards that need attention`,
          });
        } else {
          setCurrentCardIndex(pendingCardIndex);
        }
        setPendingCardIndex(null);
        isNavigatingRef.current = false;
        setIsProcessing(false);
      }, FLIP_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [pendingCardIndex, reviewMode, cardsToReview, cards.length, toast]);

  // Touch gestures
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = Math.abs(touchStart.y - touchEnd.y);
    if (Math.abs(deltaX) > minSwipeDistance && deltaY < 100) {
      if (deltaX > 0) {
        if (!isFlipped) {
          handleFlip();
        }
      } else {
        if (currentCardIndex > 0) {
          handlePrevious();
        }
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;
      switch (e.key) {
        case " ":
        case "Enter":
          if (!isFlipped) {
            handleFlip();
          } else if (isSpacedRepetitionEnabled) {
            handleRating(5);
          } else {
            handleCardKnown();
          }
          break;
        case "1":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(1);
          }
          break;
        case "2":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(2);
          }
          break;
        case "3":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(3);
          }
          break;
        case "4":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(4);
          }
          break;
        case "5":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(5);
          }
          break;
        case "0":
          if (isFlipped && isSpacedRepetitionEnabled) {
            handleRating(0);
          }
          break;
        case "ArrowLeft":
        case "Left":
          if (currentCardIndex > 0) {
            handlePrevious();
          }
          break;
        case "r":
        case "R":
          resetStudySession();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, currentCardIndex, isSpacedRepetitionEnabled, reviewMode, cards.length, isProcessing]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-neutral-600">Loading decks and due cards...</p>
      </div>
    );
  }

  if (!currentCard || cards.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No cards due</h2>
        <p className="text-gray-500 mb-6">You have no cards due for review across your decks.</p>
        <Button asChild variant="outline" className="border-neutral-200 text-black hover:bg-black hover:text-white">
          <Link href="/">Back to decks</Link>
        </Button>
      </div>
    );
  }

  // Helper for Cloze deletion
  const parseCloze = (text: string, isFlipped: boolean) => {
    const clozeRegex = /\{\{c(\d+)::(.*?)\}\}/g;
    if (isFlipped) {
      return text.replace(clozeRegex, "$2");
    }
    return text.replace(clozeRegex, " [...] ");
  };

  return (
    <div className="w-full mx-auto text-neutral-900 relative min-h-[80vh] flex flex-col">
      {/* XP Bonus Popup */}
      <AnimatePresence>
        {showXpPopup && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-black text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <span className="text-sm font-medium">+{xpBonus} XP</span>
              <span className="text-xs text-neutral-400">({consecutiveCorrect === 0 ? targetStreak : consecutiveCorrect}/{targetStreak} streak)</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reviewMode && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="inline-block w-1 h-1 rounded-full bg-neutral-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-400">review</span>
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
          {/* Streak progress indicator */}
          {consecutiveCorrect > 0 && (
            <div className="absolute -bottom-5 right-4 flex items-center gap-1.5 text-xs text-neutral-400">
              <span className="text-[10px] uppercase tracking-wider">Streak</span>
              <div className="flex gap-0.5">
                {Array.from({ length: targetStreak }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i < consecutiveCorrect ? "bg-black" : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
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
              {/* Deck badge */}
              <div className="mb-4 px-3 py-1 rounded-full bg-neutral-100 text-xs text-neutral-600">
                {currentEntry.deckName}
              </div>

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
              </div>

              {/* Answer Section */}
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

            {/* Rating Buttons */}
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
        </>
      )}

      {studyComplete && (
        <div className="text-center py-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-neutral-200 mb-4">
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg tracking-tight">All Due Cards Reviewed</h3>
          <p className="text-sm text-neutral-400 mt-1 max-w-sm mx-auto">
            {reviewMode
              ? "You've completed reviewing all marked cards."
              : cardsToReview.length > 0
                ? `${cardsToReview.length} card${cardsToReview.length === 1 ? '' : 's'} marked for further review.`
                : "You've finished reviewing all cards that were due across your decks."}
          </p>

          {/* Stats */}
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
              <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Study Again
            </Button>
            <Button
              variant="ghost"
              asChild
              className="text-neutral-500 hover:text-black transition-colors duration-150 h-9 text-sm"
            >
              <Link href="/">Back to Decks</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
