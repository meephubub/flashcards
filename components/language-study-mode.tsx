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

interface StudyCard extends Flashcard {
  incorrectAttempts: number;
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

  const [cards, setCards] = useState<StudyCard[]>([]); // Holds all unique cards for the session with their state
  const [currentCardId, setCurrentCardId] = useState<string | number | null>(null);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [studyProgress, setStudyProgress] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [questionsAnsweredThisSession, setQuestionsAnsweredThisSession] = useState(0);

  const currentCard = cards.find(card => card.id === currentCardId);

  // Memoize resetCardState
  const resetCardState = useCallback(() => {
    setUserAnswer(null);
    setSimilarityScore(null);
    setIsAnswerChecked(false);
    setIsSubmitting(false);
  }, []);

  const selectAndSetNextCard = useCallback((currentCardsList: StudyCard[], previousCardId: string | number | null) => {
    if (currentCardsList.length === 0) {
      setSessionComplete(true);
      return;
    }

    const eligibleCards = currentCardsList.filter(card => {
      if (currentCardsList.length > 1 && card.id === previousCardId) {
        return false;
      }
      return true;
    });

    const selectionPool: StudyCard[] = [];
    const cardsToUseForPool = eligibleCards.length > 0 ? eligibleCards : currentCardsList;

    cardsToUseForPool.forEach(card => {
      const weight = (card.incorrectAttempts || 0) + 1;
      for (let i = 0; i < weight; i++) {
        selectionPool.push(card);
      }
    });

    if (selectionPool.length === 0) {
      if (currentCardsList.length > 0) { // Fallback if filtering made pool empty
         const fallbackRandomIndex = Math.floor(Math.random() * currentCardsList.length);
         setCurrentCardId(currentCardsList[fallbackRandomIndex].id);
      } else {
        setSessionComplete(true);
      }
      return;
    }

    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const nextCard = selectionPool[randomIndex];
    setCurrentCardId(nextCard.id);

    const totalQuestionsTarget = settings.studySettings.cardsPerSession || currentCardsList.length;
    if (totalQuestionsTarget > 0) {
        // questionsAnsweredThisSession is 0-indexed count of ALREADY answered questions.
        // So for the NEXT card, progress is (questionsAnsweredThisSession + 1)
        setStudyProgress(((questionsAnsweredThisSession + 1) / totalQuestionsTarget) * 100);
    } else {
        setStudyProgress(0);
    }
  }, [setSessionComplete, setCurrentCardId, settings.studySettings.cardsPerSession, questionsAnsweredThisSession, setStudyProgress]);

  // Memoize handleNextCard
  const handleNextCard = useCallback(() => {
    resetCardState();
    const nextQuestionNumber = questionsAnsweredThisSession + 1;
    setQuestionsAnsweredThisSession(nextQuestionNumber);

    const totalQuestionsTarget = settings.studySettings.cardsPerSession || cards.length;

    if (nextQuestionNumber >= totalQuestionsTarget && totalQuestionsTarget > 0) {
      setSessionComplete(true);
    } else if (cards.length > 0) {
      selectAndSetNextCard(cards, currentCard?.id ?? null);
    } else {
      setSessionComplete(true); // No cards to select from
    }
  }, [resetCardState, questionsAnsweredThisSession, settings.studySettings.cardsPerSession, cards, currentCard, selectAndSetNextCard, setSessionComplete]);

  useEffect(() => {
    if (deck) {
      const allCardsFromDeck = deck.cards as Flashcard[];
      const sessionSize = settings.studySettings.cardsPerSession || allCardsFromDeck.length;
      // Take a slice, no need to shuffle here as selectAndSetNextCard handles weighted random picking
      let initialSessionCardsRaw = allCardsFromDeck.slice(0, sessionSize);

      const initialStudyCards: StudyCard[] = initialSessionCardsRaw.map(card => ({
        ...card,
        incorrectAttempts: 0,
      }));
      setCards(initialStudyCards);
      
      setQuestionsAnsweredThisSession(0);
      setCorrectAnswers(0);
      setCurrentStreak(0);
      resetCardState();

      if (initialStudyCards.length > 0) {
        selectAndSetNextCard(initialStudyCards, null);
        setSessionComplete(false);
        // Progress is set by selectAndSetNextCard
      } else {
        setSessionComplete(true);
        setStudyProgress(0);
      }
    }
  }, [deck, settings.studySettings.cardsPerSession, selectAndSetNextCard, resetCardState]);



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
      setIsAnswerChecked(true);

      setCards(prevCards =>
        prevCards.map(card =>
          card.id === currentCard.id
            ? { ...card, incorrectAttempts: isCorrect ? card.incorrectAttempts : (card.incorrectAttempts || 0) + 1 }
            : card
        )
      );

      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
        const newCalculatedStreak = currentStreak + 1;
        setCurrentStreak(newCalculatedStreak);
        if (newCalculatedStreak > 0 && (newCalculatedStreak % 3 === 0 || newCalculatedStreak % 5 === 0)) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }
        toast({
          title: "Correct!",
          description: `Similarity: ${(score * 100).toFixed(1)}%`,
          variant: "default", // Changed from "success"
        });
      } else {
        setCurrentStreak(0); // Reset streak on incorrect answer
        toast({
          title: "Try again!",
          description: `Similarity: ${(score * 100).toFixed(1)}%. Correct answer: ${currentCard.back}`,
          variant: "destructive",
        });
      }
      // Study progress is updated by selectAndSetNextCard or when a card is first loaded
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
    resetCardState();
    setCorrectAnswers(0);
    setCurrentStreak(0);
    setSessionComplete(false);
    setQuestionsAnsweredThisSession(0);

    if (deck) {
      const allCardsFromDeck = deck.cards as Flashcard[];
      const sessionSize = settings.studySettings.cardsPerSession || allCardsFromDeck.length;
      let initialSessionCardsRaw = allCardsFromDeck.slice(0, sessionSize);

      const reinitializedStudyCards: StudyCard[] = initialSessionCardsRaw.map(card => ({
        ...card,
        incorrectAttempts: 0, // Reset attempts for a new session
      }));
      setCards(reinitializedStudyCards);

      if (reinitializedStudyCards.length > 0) {
        selectAndSetNextCard(reinitializedStudyCards, null); // Select first card for new session
      } else {
        setSessionComplete(true); // No cards to study
        setStudyProgress(0);
      }
    } else {
      setSessionComplete(true); // Should not happen if deck was loaded
      setStudyProgress(0);
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
          Card {questionsAnsweredThisSession + 1} of {settings.studySettings.cardsPerSession || cards.length}
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
