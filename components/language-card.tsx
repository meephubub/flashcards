"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LanguageCardProps {
  questionText: string;
  onSubmitAnswer: (userAnswer: string) => void;
  isSubmitting?: boolean;
}

export function LanguageCard({ questionText, onSubmitAnswer, isSubmitting }: LanguageCardProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userAnswer.trim()) {
      onSubmitAnswer(userAnswer.trim());
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Translate or Answer:</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-2xl p-6 bg-secondary rounded-md min-h-[80px] flex items-center justify-center">
            {questionText}
          </p>
          <Input
            ref={inputRef}
            id="answer"
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer here..."
            aria-label="Your answer"
            disabled={isSubmitting}
            className="text-lg p-4"
          />
          <Button type="submit" className="w-full" disabled={isSubmitting || !userAnswer.trim()}>
            {isSubmitting ? 'Checking...' : 'Submit Answer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
