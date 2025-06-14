"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LanguageCard } from "@/components/language-card";
import { getSentenceEmbedding, cosineSimilarity, spellcheckAnswer } from "@/app/actions/xenova-similarity";
import { useDecks } from "@/context/deck-context";
import { useSettings } from '@/context/settings-context';
import { ArrowLeft, ArrowRight, RotateCw, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { SessionSummary } from './session-summary';
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

export interface StudyCard extends Flashcard {
  incorrectAttempts: number;
  consecutiveCorrectAttempts: number;
}

// Helper function to shuffle an array (Fisher-Yates with crypto)
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  // Use crypto.getRandomValues for better randomization
  const randomValues = new Uint32Array(newArray.length);
  crypto.getRandomValues(randomValues);
  
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
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
  const [longestSessionStreak, setLongestSessionStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  // Initialize with 1 since we're showing the first card
  const [questionsAnsweredThisSession, setQuestionsAnsweredThisSession] = useState(1);

  const currentCard = cards.find(card => card.id === currentCardId);

  // Memoize resetCardState
  const resetCardState = useCallback(() => {
    setUserAnswer(null);
    setSimilarityScore(null);
    setIsAnswerChecked(false);
    setIsSubmitting(false);
  }, []);

  // Track recently seen cards to avoid repetition
  const recentlySeenCards = useRef<(string | number)[]>([]);
  
  const selectAndSetNextCard = useCallback((currentCardsList: StudyCard[], previousCardId: string | number | null, answeredCount?: number) => {
    if (currentCardsList.length === 0) {
      setSessionComplete(true);
      return;
    }
    
    // Update recently seen cards list
    if (previousCardId) {
      // Add the previous card to recently seen
      recentlySeenCards.current = [
        previousCardId,
        ...recentlySeenCards.current.filter((id: string | number) => id !== previousCardId)
      ].slice(0, Math.min(5, Math.floor(currentCardsList.length / 2))); // Keep track of last N cards, where N depends on deck size
    }
    
    // First, filter out the previous card and reduce probability of recently seen cards
    const eligibleCards = currentCardsList.filter(card => {
      // Always filter out the immediately previous card if we have more than one card
      if (currentCardsList.length > 1 && card.id === previousCardId) {
        return false;
      }
      return true;
    });

    // Constants for scoring
    const INCORRECT_ATTEMPT_WEIGHT = 3; // Higher value = more weight for incorrect attempts
    const RECENCY_PENALTY_DIVISOR_FACTOR = 2;   // Higher value = stronger penalty for recent cards (score is divided by this factor related term)
    const NEW_CARD_BONUS_MULTIPLIER = 1.2;         // Multiplicative bonus for cards not in recency list
    const CONSECUTIVE_CORRECT_TO_REDUCE_PRIORITY = 2; // After this many correct in a row, incorrectAttempts weight is ignored

    let weightedPool: StudyCard[] = [];

    // Handle cases where no cards are eligible or the list is very small
    if (eligibleCards.length === 0) {
      if (currentCardsList.length === 1 && previousCardId && currentCardsList[0].id === previousCardId) {
         // Only one card in the deck, and it was just seen.
         setCurrentCardId(currentCardsList[0].id);
      } else if (currentCardsList.length > 0) {
        // Fallback if eligibleCards is empty but currentCardsList is not.
        const fallbackCard = currentCardsList.find(c => c.id !== previousCardId) || currentCardsList[0];
        if (fallbackCard) {
            setCurrentCardId(fallbackCard.id);
        } else { 
            setSessionComplete(true);
        }
      } 
      else { // currentCardsList is empty
        setSessionComplete(true);
      }
      return;
    }
    
    eligibleCards.forEach(card => {
      let desirabilityScore = 10.0; // Base score, using float for precision before flooring

      // Increase score for incorrect attempts, unless it's been answered correctly multiple times consecutively
      if ((card.consecutiveCorrectAttempts || 0) < CONSECUTIVE_CORRECT_TO_REDUCE_PRIORITY) {
        desirabilityScore += (card.incorrectAttempts || 0) * INCORRECT_ATTEMPT_WEIGHT;
      }

      // Apply recency penalty or new card bonus
      const recencyIndex = recentlySeenCards.current.indexOf(card.id);
      if (recencyIndex !== -1) {
        // Penalize recently seen cards. Most recent (index 0) gets highest penalty factor.
        const penaltyFactorBase = (recentlySeenCards.current.length - recencyIndex);
        desirabilityScore /= Math.max(1, penaltyFactorBase * RECENCY_PENALTY_DIVISOR_FACTOR);
      } else {
        // Bonus for cards not in the recency list (considered "new" or not seen in a while)
        desirabilityScore *= NEW_CARD_BONUS_MULTIPLIER;
      }
      
      // Ensure final weight is at least 1, so every eligible card has a chance
      const finalWeight = Math.max(1, Math.floor(desirabilityScore)); 
      
      for (let i = 0; i < finalWeight; i++) {
        weightedPool.push(card);
      }
    });

    // Note: The original 'selectionPool' is now 'weightedPool'.
    // The subsequent fallback logic and random selection will use 'weightedPool'.

    // Fallback if our filtering made the pool empty
    if (weightedPool.length === 0) {
      if (currentCardsList.length > 0) {
        const fallbackRandomIndex = Math.floor(Math.random() * currentCardsList.length);
        setCurrentCardId(currentCardsList[fallbackRandomIndex].id);
      } else {
        setSessionComplete(true);
      }
      return;
    }

    // Select a random card from our weighted pool
    const randomIndex = Math.floor(Math.random() * weightedPool.length);
    const nextCard = weightedPool[randomIndex];

    // Ensure we don't get the same card twice in a row if possible
    if (weightedPool.length > 1 && nextCard.id === previousCardId) {
      // If we got the same card, try one more time with a different random index
      const newRandomIndex = (randomIndex + 1) % weightedPool.length;
      setCurrentCardId(weightedPool[newRandomIndex].id);
    } else {
      setCurrentCardId(nextCard.id);
    }
    
    console.log(`Selected next card: ${nextCard.id}, incorrect attempts: ${nextCard.incorrectAttempts || 0}, recently seen: ${recentlySeenCards.current.includes(nextCard.id)}`);

    // We no longer update the progress bar here, as it's now handled in handleAnswerSubmit
    // This prevents the progress bar from being updated twice and potentially resetting
  }, [setSessionComplete, setCurrentCardId]);

  // This function is now only used for manual navigation (e.g., skip button)
  // It's no longer called automatically after answering a question
  const handleNextCard = useCallback(() => {
    resetCardState();
    
    const totalQuestionsTarget = settings.studySettings.cardsPerSession || cards.length;

    console.log(`Manual next card, questionsAnsweredThisSession: ${questionsAnsweredThisSession}, target: ${totalQuestionsTarget}`);

    if (questionsAnsweredThisSession >= totalQuestionsTarget && totalQuestionsTarget > 0) {
      console.log('Session complete, all questions answered');
      setSessionComplete(true);
    } else if (cards.length > 0) {
      // Select the next card without incrementing questionsAnsweredThisSession
      selectAndSetNextCard(cards, currentCard?.id ?? null, questionsAnsweredThisSession);
    } else {
      setSessionComplete(true); // No cards to select from
    }
  }, [resetCardState, questionsAnsweredThisSession, settings.studySettings.cardsPerSession, cards, currentCard, selectAndSetNextCard, setSessionComplete]);

  useEffect(() => {
    if (deck) {
      const allCardsFromDeck = deck.cards as Flashcard[];
      const sessionSize = settings.studySettings.cardsPerSession || allCardsFromDeck.length;
      
      // Shuffle the cards first to ensure a random initial order
      let shuffledCards = shuffleArray([...allCardsFromDeck]);
      
      // Take cards up to the session size
      let initialSessionCardsRaw = shuffledCards.slice(0, sessionSize);

      const initialStudyCards: StudyCard[] = initialSessionCardsRaw.map(card => ({
        ...card,
        incorrectAttempts: 0,
        consecutiveCorrectAttempts: 0,
      }));
      setCards(initialStudyCards);
      
      // Reset the recently seen cards list
      recentlySeenCards.current = [];
      
      // Initialize to 1 since we're showing the first card
      setQuestionsAnsweredThisSession(1);
      setCorrectAnswers(0);
      setCurrentStreak(0);
      setLongestSessionStreak(0);
      resetCardState();

      if (initialStudyCards.length > 0) {
        // First, set the progress bar
        setStudyProgress(1 / (sessionSize || initialStudyCards.length) * 100);
        // Then select the first card
        selectAndSetNextCard(initialStudyCards, null);
        setSessionComplete(false);
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

    // Spellcheck the answer before grading
    const spellcheckedAnswer = spellcheckAnswer(submittedAnswer, currentCard.back);

    try {
      const [answerEmbedding, correctAnswerEmbedding] = await Promise.all([
        getSentenceEmbedding(spellcheckedAnswer.toLowerCase()),
        getSentenceEmbedding(currentCard.back.toLowerCase()),
      ]);
      const score = cosineSimilarity(answerEmbedding, correctAnswerEmbedding);
      setSimilarityScore(score);

      const isCorrect = score >= SIMILARITY_THRESHOLD;
      setIsAnswerChecked(true);

      setCards(prevCards =>
        prevCards.map(card =>
          card.id === currentCard.id
            ? { 
                ...card, 
                incorrectAttempts: isCorrect ? card.incorrectAttempts : (card.incorrectAttempts || 0) + 1,
                consecutiveCorrectAttempts: isCorrect ? (card.consecutiveCorrectAttempts || 0) + 1 : 0
              }
            : card
        )
      );

      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
        const newCalculatedStreak = currentStreak + 1;
        setCurrentStreak(newCalculatedStreak);
        if (newCalculatedStreak > longestSessionStreak) {
          setLongestSessionStreak(newCalculatedStreak);
        }
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
      
      // We're now incrementing the counter to the NEXT card number
      const nextQuestionNumber = questionsAnsweredThisSession + 1;
      
      // Update progress bar based on the new count
      const totalQuestionsTarget = settings.studySettings.cardsPerSession || cards.length;
      
      // Check if we've completed all questions
      if (nextQuestionNumber > totalQuestionsTarget && totalQuestionsTarget > 0) {
        console.log('Session complete, all questions answered');
        setSessionComplete(true);
        return; // Don't proceed to next card if session is complete
      }
      
      // Calculate the new progress value
      const newProgressValue = (nextQuestionNumber / totalQuestionsTarget) * 100;
      console.log(`Setting progress to ${newProgressValue}%`);
      
      // Update the question counter and progress bar
      setQuestionsAnsweredThisSession(nextQuestionNumber);
      setStudyProgress(newProgressValue);
      
      console.log(`Answered question ${questionsAnsweredThisSession}, moving to question ${nextQuestionNumber}`);
      
      // Reset the card state and select the next card
      setIsAnswerChecked(true);
      setIsSubmitting(false);
      
      // Store the nextQuestionNumber in a ref or variable that won't be affected by React's state batching
      const questionToUse = nextQuestionNumber;
      
      // Select the next card directly instead of using handleNextCard
      // This avoids the double card switch issue
      setTimeout(() => {
        resetCardState();
        if (cards.length > 0) {
          // Use the stored question number to ensure we're using the correct value
          selectAndSetNextCard(cards, currentCard?.id ?? null, questionToUse);
        }
      }, 500); // Brief delay to allow toast to be seen
      
    } catch (error) {
      console.error("Error calculating similarity:", error);
      setSimilarityScore(0); // Treat error as incorrect
      toast({
        title: "Error",
        description: "Could not calculate similarity. Please try again.",
        variant: "destructive"
      });
      setIsAnswerChecked(true);
      setIsSubmitting(false);
    }
  }, [currentCard, toast, questionsAnsweredThisSession, cards.length, settings.studySettings.cardsPerSession, SIMILARITY_THRESHOLD, currentStreak, resetCardState, selectAndSetNextCard, cards]);

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
    setLongestSessionStreak(0);
    setSessionComplete(false);
    // Initialize to 1 since we're showing the first card
    setQuestionsAnsweredThisSession(1);

    if (deck) {
      const allCardsFromDeck = deck.cards as Flashcard[];
      const sessionSize = settings.studySettings.cardsPerSession || allCardsFromDeck.length;
      let initialSessionCardsRaw = allCardsFromDeck.slice(0, sessionSize);

      const reinitializedStudyCards: StudyCard[] = initialSessionCardsRaw.map(card => ({
        ...card,
        incorrectAttempts: 0, // Reset attempts for a new session
        consecutiveCorrectAttempts: 0,
      }));
      setCards(reinitializedStudyCards);

      if (reinitializedStudyCards.length > 0) {
        selectAndSetNextCard(reinitializedStudyCards, null, 1); // Pass 1 as the answeredCount
        // Set initial progress
        setStudyProgress(1 / (sessionSize || reinitializedStudyCards.length) * 100);
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
    // Determine the number of cards the user actually went through
    // questionsAnsweredThisSession is incremented before checking for session completion
    const attemptedCardsCount = Math.min(questionsAnsweredThisSession -1 , settings.studySettings.cardsPerSession || cards.length);

    return (
      <SessionSummary 
        totalCardsAnswered={attemptedCardsCount > 0 ? attemptedCardsCount : cards.length} // Fallback to cards.length if attempted is 0
        correctAnswers={correctAnswers}
        longestSessionStreak={longestSessionStreak}
        allCardsInSession={cards} // Pass all cards that were part of this session's pool
        onRestart={restartSession}
      />
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
          Card {questionsAnsweredThisSession} of {settings.studySettings.cardsPerSession || cards.length}
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
      {showConfetti && width && height && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden',
    }}
    aria-hidden="true"
  >
    <Confetti
      width={window.innerWidth || width}
      height={window.innerHeight || height}
      style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}
      numberOfPieces={200}
      recycle={false}
    />
  </div>
)}
    </div>
  );
}
