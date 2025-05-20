"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LanguageCard } from "@/components/language-card";
import { getSentenceEmbedding, cosineSimilarity } from "@/app/actions/xenova-similarity";
import { useDecks } from "@/context/deck-context";
import { useSettings } from '@/context/settings-context';
import { ArrowLeft, ArrowRight, RotateCw, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Confetti from 'react-confetti';
import { useWindowSize } from '@uidotdev/usehooks'; // A common hook for window size

interface LanguageStudyModeProps {
  deckId: number;
}

import type { StudySettings } from '@/lib/settings';

interface Flashcard {
  id: string | number;
  front: string;
  back: string;
  img_url?: string | null;
  // Add other card properties if necessary
}

// Helper function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function LanguageStudyMode({ deckId }: LanguageStudyModeProps) {
  const { getDeck, loading: decksLoading } = useDecks();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { width, height } = useWindowSize(); // For confetti
  const SIMILARITY_THRESHOLD = settings.studySettings.languageSimilarityThreshold ?? 0.75;
  const deck = getDeck(deckId);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [studyProgress, setStudyProgress] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Memoize resetCardState
  const resetCardState = useCallback(() => {
    setUserAnswer(null);
    setSimilarityScore(null);
    setIsAnswerChecked(false);
    setIsSubmitting(false);
  }, []);

  // Memoize handleNextCard
  const handleNextCard = useCallback(() => {
    resetCardState();
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prevIndex => prevIndex + 1);
    } else {
      setSessionComplete(true);
    }
  }, [currentCardIndex, cards, resetCardState]);

  useEffect(() => {
    if (deck) {
      const allCards = deck.cards as Flashcard[];
      let cardsForSession = allCards.slice(0, settings.studySettings.cardsPerSession || allCards.length);
      cardsForSession = shuffleArray(cardsForSession); // Shuffle the selected cards
      setCards(cardsForSession);
      if (cardsForSession.length > 0) {
        setStudyProgress(0);
        setSessionComplete(false);
      }
    }
  }, [deck, settings.studySettings.cardsPerSession]);

  const currentCard = cards[currentCardIndex];

  const handleAnswerSubmit = useCallback(async (submittedAnswer: string) => {
    if (!currentCard) return;
    setIsSubmitting(true);
    setUserAnswer(submittedAnswer);

    try {
      const [answerEmbedding, correctAnswerEmbedding] = await Promise.all([
        getSentenceEmbedding(submittedAnswer.toLowerCase()),
        getSentenceEmbedding(currentCard.back.toLowerCase()),
      ]);
      const score = cosineSimilarity(answerEmbedding, correctAnswerEmbedding);
      setSimilarityScore(score);
      const isCorrect = score >= SIMILARITY_THRESHOLD;
      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
        const newStreak = currentStreak + 1;
        setCurrentStreak(newStreak);
        if (newStreak > 0 && (newStreak % 3 === 0 || newStreak % 5 === 0)) { // Confetti on streaks of 3 or 5
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000); // Confetti for 4 seconds
        }
      } else {
        setCurrentStreak(0); // Reset streak on incorrect answer
      }
      toast({
        title: isCorrect ? "Correct!" : "Incorrect",
        description: `Similarity: ${(score * 100).toFixed(1)}%. Your answer: "${submittedAnswer}". Correct: "${currentCard.back}"`,        
        variant: isCorrect ? "default" : "destructive",
        duration: isCorrect ? 3000 : 5000, // Shorter for correct, longer for incorrect
        className: "whitespace-pre-line"
      });
    } catch (error) {
      console.error("Error calculating similarity:", error);
      setSimilarityScore(0); // Treat error as incorrect
      toast({
        title: "Error",
        description: "Could not calculate similarity. Please try again.",
        variant: "destructive"
      });
    }
    setIsAnswerChecked(true);
    setIsSubmitting(false);
    // Automatically move to the next card after a brief delay to allow toast to be seen
    setTimeout(() => {
      handleNextCard();
    }, 500); // Adjust delay as needed, or remove if toast visibility isn't an issue
  }, [currentCard, toast, handleNextCard]);

  useEffect(() => {
    if (cards.length > 0) {
      setStudyProgress(((currentCardIndex + (isAnswerChecked ? 1: 0)) / cards.length) * 100);
    }
  }, [currentCardIndex, cards.length, isAnswerChecked]);

  // useEffect for session completion confetti - MUST BE AT TOP LEVEL
  useEffect(() => {
    if (sessionComplete && cards.length > 0) {
      const finalScore = correctAnswers / cards.length;
      if (finalScore >= 0.8) { // Confetti for scores 80%+
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000); // Confetti for 5 seconds
      }
    }
  }, [sessionComplete, correctAnswers, cards.length]);

  const restartSession = () => {
    setCurrentCardIndex(0);
    resetCardState();
    setCorrectAnswers(0);
    setCurrentStreak(0); // Reset streak on restart
    setSessionComplete(false);
    if (deck) {
        const allCards = deck.cards as Flashcard[];
        let cardsForSession = allCards.slice(0, settings.studySettings.cardsPerSession || allCards.length);
        cardsForSession = shuffleArray(cardsForSession); // Re-shuffle the cards
        setCards(cardsForSession);
    }
  };

  if (decksLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full" />
        <div className="flex justify-between mt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  if (!deck) {
    return <div className="text-center py-10">Deck not found.</div>;
  }

  if (cards.length === 0 && !decksLoading) {
    return (
      <div className="text-center py-10">
        <p>This deck has no cards to study in this mode.</p>
        <Button asChild className="mt-4">
          <Link href={`/deck/${deckId}`}>Return to Deck</Link>
        </Button>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <Card className="w-full max-w-lg mx-auto my-8">
        <CardHeader>
          <CardTitle>Session Complete!</CardTitle>
          <CardDescription>
            You answered {correctAnswers} out of {cards.length} questions correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Your score: {((correctAnswers / cards.length) * 100).toFixed(0)}%</p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={restartSession}>
            <RotateCw className="h-4 w-4 mr-2" />
            Study Again
          </Button>
          <Button asChild>
            <Link href={`/deck/${deckId}`}>Return to Deck</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!currentCard) {
    return <div className="text-center py-10">Loading card...</div>; 
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Link href={`/deck/${deckId}`} className="text-sm hover:underline">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {deck.name}
          </Button>
        </Link>
        <div className="text-sm text-muted-foreground">
          Current Streak: {currentStreak} 🔥
        </div>
        <div className="text-sm text-muted-foreground">
          Card {currentCardIndex + 1} of {cards.length}
        </div>
      </div>

      <Progress value={studyProgress} className="w-full" />

      {currentCard && (
        <LanguageCard
          key={currentCard.id} // Add key here to reset input on card change
          questionText={currentCard.front}
          onSubmitAnswer={handleAnswerSubmit}
          isSubmitting={isSubmitting}
        />
      )}
       <div className="flex justify-center mt-4">
         <Button variant="outline" size="sm" onClick={restartSession}>
            <RotateCw className="h-4 w-4 mr-2" />
            Restart Session
          </Button>
       </div>
      {showConfetti && width && height && <Confetti width={width} height={height} recycle={false} numberOfPieces={200} />}
    </div>
  );
}
