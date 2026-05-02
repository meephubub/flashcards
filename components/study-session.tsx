"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/settings-context";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConfidenceRating } from "@/lib/spaced-repetition";
import { calculateNextReview, DEFAULT_CARD_PROGRESS, getNextReviewText } from "@/lib/spaced-repetition";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { MarkdownCardContent } from "@/components/markdown-card-content";
import { Card } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";

interface StudySessionProps {
  cards: Card[];
  sessionInfo: {
    type: "tags" | "decks";
    identifiers: string[] | number[];
    title: string;
  };
}

export function StudySession({ cards, sessionInfo }: StudySessionProps) {
  const { settings } = useSettings();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyStats, setStudyStats] = useState({
    correct: 0,
    wrong: 0,
    remaining: cards.length,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [completedCards, setCompletedCards] = useState<number[]>([]);

  const rawStudy: any = settings?.studySettings ?? {};
  const normalizedStudy = {
    cardsPerSession:
      typeof rawStudy.cardsPerSession === "number" ? rawStudy.cardsPerSession : 20,
    showProgressBar:
      typeof rawStudy.showProgressBar === "boolean" ? rawStudy.showProgressBar : true,
    enableSpacedRepetition:
      typeof rawStudy.enableSpacedRepetition === "boolean"
        ? rawStudy.enableSpacedRepetition
        : true,
  };

  const currentCard = cards[currentCardIndex];

  useEffect(() => {
    setStudyStats(prev => ({
      ...prev,
      remaining: cards.length - completedCards.length,
    }));
  }, [cards.length, completedCards.length]);

  const updateCardProgress = async (cardId: number, rating: ConfidenceRating) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: existingProgress } = await supabase
        .from("card_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("card_id", cardId)
        .single();

      const nextReview = calculateNextReview(
        existingProgress || DEFAULT_CARD_PROGRESS,
        rating
      );

      if (existingProgress) {
        await supabase
          .from("card_progress")
          .update({
            ease_factor: nextReview.ease_factor,
            interval: nextReview.interval,
            repetitions: nextReview.repetitions,
            due_date: nextReview.due_date,
            last_reviewed: new Date().toISOString(),
            fsrs_state: nextReview.fsrs_state,
          })
          .eq("id", existingProgress.id);
      } else {
        await supabase
          .from("card_progress")
          .insert({
            user_id: user.id,
            card_id: cardId,
            ease_factor: nextReview.ease_factor,
            interval: nextReview.interval,
            repetitions: nextReview.repetitions,
            due_date: nextReview.due_date,
            last_reviewed: new Date().toISOString(),
            fsrs_state: nextReview.fsrs_state,
          });
      }
    } catch (error) {
      console.error("Error updating card progress:", error);
      toast({
        title: "Error",
        description: "Failed to update card progress",
        variant: "destructive",
      });
    }
  };

  const handleRating = async (rating: ConfidenceRating) => {
    if (!currentCard) return;

    setIsLoading(true);

    if (rating >= 3) {
      setStudyStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      haptics.correct();
    } else {
      setStudyStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      haptics.incorrect();
    }

    if (normalizedStudy.enableSpacedRepetition) {
      await updateCardProgress(currentCard.id, rating);
    }

    // Find the next card that hasn't been completed yet (excluding current card)
    let nextCardIndex = currentCardIndex + 1;
    while (nextCardIndex < cards.length && completedCards.includes(cards[nextCardIndex].id)) {
      nextCardIndex++;
    }

    // Add current card to completed cards after finding next card
    setCompletedCards(prev => [...prev, currentCard.id]);

    if (nextCardIndex < cards.length) {
      // Move to the next uncompleted card
      setCurrentCardIndex(nextCardIndex);
      setShowAnswer(false);
    } else {
      // Check if there are any uncompleted cards before the current index
      let hasUncompletedCards = false;
      for (let i = 0; i < cards.length; i++) {
        if (!completedCards.includes(cards[i].id) && i !== currentCardIndex) {
          hasUncompletedCards = true;
          setCurrentCardIndex(i);
          setShowAnswer(false);
          break;
        }
      }

      // If no uncompleted cards found, session is complete
      if (!hasUncompletedCards) {
        router.push("/");
        toast({
          title: "Study Complete!",
          description: `You studied ${cards.length} cards. Correct: ${studyStats.correct + (rating >= 3 ? 1 : 0)}, Wrong: ${studyStats.wrong + (rating < 3 ? 1 : 0)}`,
        });
      }
    }

    setIsLoading(false);
  };

  const handleSkip = () => {
    // Find the next card that hasn't been completed yet
    let nextCardIndex = currentCardIndex + 1;
    while (nextCardIndex < cards.length && completedCards.includes(cards[nextCardIndex].id)) {
      nextCardIndex++;
    }

    if (nextCardIndex < cards.length) {
      // Move to the next uncompleted card
      setCurrentCardIndex(nextCardIndex);
      setShowAnswer(false);
    } else {
      // Check if there are any uncompleted cards before the current index
      for (let i = 0; i < cards.length; i++) {
        if (!completedCards.includes(cards[i].id)) {
          setCurrentCardIndex(i);
          setShowAnswer(false);
          break;
        }
      }
    }
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setStudyStats({
      correct: 0,
      wrong: 0,
      remaining: cards.length,
    });
    setCompletedCards([]);
  };

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold text-foreground mb-4">
            Study Complete!
          </h1>
          <p className="text-muted-foreground mb-6">
            You've completed all {cards.length} cards.
          </p>
          <div className="space-y-2 mb-6">
            <p className="text-sm text-green-600">Correct: {studyStats.correct}</p>
            <p className="text-sm text-red-600">Wrong: {studyStats.wrong}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleRestart} variant="outline">
              <RotateCw className="w-4 h-4 mr-2" />
              Restart
            </Button>
            <Button onClick={() => router.push("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Decks
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {sessionInfo.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Card {currentCardIndex + 1} of {cards.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">Correct: {studyStats.correct}</span>
              <span className="text-red-600">Wrong: {studyStats.wrong}</span>
              <span className="text-muted-foreground">Remaining: {studyStats.remaining}</span>
            </div>
          </div>
          {normalizedStudy.showProgressBar && (
            <div className="mt-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentCardIndex + 1) / cards.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border rounded-xl p-8 shadow-lg"
        >
          {/* Front of card */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Front</h2>
            <div className="text-foreground">
              <MarkdownCardContent content={currentCard.front} />
            </div>
            {currentCard.front_img_url && (
              <div className="mt-4 rounded-lg overflow-hidden border border-border">
                <img
                  src={currentCard.front_img_url}
                  alt="Card front"
                  className="max-w-full h-auto"
                />
              </div>
            )}
          </div>

          {/* Back of card */}
          <AnimatePresence>
            {showAnswer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-border pt-8"
              >
                <h2 className="text-lg font-semibold text-foreground mb-4">Back</h2>
                <div className="text-foreground">
                  <MarkdownCardContent content={currentCard.back} />
                </div>
                {currentCard.tag && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {currentCard.tag.split(/[,\/]/).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground border border-border"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-4">
            {!showAnswer ? (
              <Button
                onClick={() => setShowAnswer(true)}
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                Show Answer
              </Button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <Button
                  onClick={() => handleRating(1)}
                  variant="destructive"
                  disabled={isLoading}
                  className="flex flex-col gap-1 h-auto py-3"
                >
                  <X className="w-5 h-5" />
                  <span className="text-xs">Again</span>
                </Button>
                <Button
                  onClick={() => handleRating(2)}
                  variant="outline"
                  disabled={isLoading}
                  className="flex flex-col gap-1 h-auto py-3"
                >
                  <span className="text-xs">Hard</span>
                </Button>
                <Button
                  onClick={() => handleRating(3)}
                  variant="outline"
                  disabled={isLoading}
                  className="flex flex-col gap-1 h-auto py-3"
                >
                  <span className="text-xs">Good</span>
                </Button>
                <Button
                  onClick={() => handleRating(4)}
                  disabled={isLoading}
                  className="flex flex-col gap-1 h-auto py-3"
                >
                  <Check className="w-5 h-5" />
                  <span className="text-xs">Easy</span>
                </Button>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={handleSkip}
                variant="ghost"
                size="sm"
                disabled={isLoading}
              >
                Skip
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
