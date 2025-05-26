import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { StudyCard } from './language-study-mode'; // Assuming StudyCard is exported or defined in a shared types file

interface SessionSummaryProps {
  totalCardsAnswered: number;
  correctAnswers: number;
  longestSessionStreak: number;
  allCardsInSession: StudyCard[]; // To determine hardest cards
  onRestart: () => void;
}

export function SessionSummary({ 
  totalCardsAnswered,
  correctAnswers,
  longestSessionStreak,
  allCardsInSession,
  onRestart 
}: SessionSummaryProps) {

  const accuracy = totalCardsAnswered > 0 ? (correctAnswers / totalCardsAnswered) * 100 : 0;

  const getHardestCards = () => {
    if (!allCardsInSession || allCardsInSession.length === 0) return [];
    return [...allCardsInSession]
      .sort((a, b) => (b.incorrectAttempts || 0) - (a.incorrectAttempts || 0))
      .filter(card => (card.incorrectAttempts || 0) > 0) // Only show cards with at least one incorrect attempt
      .slice(0, 3);
  };

  const hardestCards = getHardestCards();

  return (
    <Card className="w-full max-w-md mx-auto my-8">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Session Complete!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold">{accuracy.toFixed(1)}%</p>
          <p className="text-sm text-muted-foreground">Accuracy</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold">{correctAnswers}/{totalCardsAnswered}</p>
            <p className="text-xs text-muted-foreground">Correct / Total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{longestSessionStreak}</p>
            <p className="text-xs text-muted-foreground">Longest Streak</p>
          </div>
        </div>

        {hardestCards.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-center">Review These Cards:</h3>
            <ul className="space-y-1 list-disc list-inside bg-secondary/30 p-3 rounded-md">
              {hardestCards.map(card => (
                <li key={card.id} className="text-sm">
                  {card.front} (Incorrect: {card.incorrectAttempts})
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 pt-6">
        <Button onClick={onRestart} className="w-full sm:w-auto">Restart Session</Button>
        <Link href="/decks" passHref legacyBehavior>
          <Button variant="outline" className="w-full sm:w-auto">Back to Decks</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
