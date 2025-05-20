"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { makeGroqRequest } from "@/lib/groq";

interface LanguageCardProps {
  questionText: string;
  onSubmitAnswer: (userAnswer: string) => void;
  isSubmitting?: boolean;
}

export function LanguageCard({ questionText, onSubmitAnswer, isSubmitting }: LanguageCardProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userAnswer.trim() === '?') {
      generateExplanation();
    } else if (userAnswer.trim()) {
      onSubmitAnswer(userAnswer.trim());
    }
  };

  const generateExplanation = async () => {
    setIsGeneratingExplanation(true);
    setShowExplanation(true);
    
    try {
      const promptContent = `Please provide a concise explanation of the following concept or phrase: "${questionText}"
      
      Keep your explanation clear, educational, and focused on helping someone understand this concept. Include relevant context, examples if applicable, and highlight key points.
      `;
      
      const response = await makeGroqRequest(promptContent, false, 
        "You are an educational AI assistant. Your purpose is to provide clear, accurate, and helpful explanations about language learning concepts, phrases, words, and their meanings. Present information in a structured, educational format.");
      
      setExplanation(response);
    } catch (error) {
      console.error('Error generating explanation:', error);
      setExplanation('Sorry, I could not generate an explanation at this time. Please try again later.');
    } finally {
      setIsGeneratingExplanation(false);
    }
  };

  // Handle input change to detect '?' for immediate explanation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserAnswer(value);
    
    // If user types just '?', prepare to show explanation
    if (value === '?') {
      // Don't auto-submit to allow user to decide when to hit enter
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
          
          {showExplanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mb-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-medium mb-2 text-blue-700 dark:text-blue-300 flex items-center">
                {isGeneratingExplanation ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating explanation...
                  </>
                ) : (
                  'AI Explanation'
                )}
              </h3>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {isGeneratingExplanation ? (
                  <div className="flex justify-center">
                    <div className="h-4 w-4 animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full" />
                  </div>
                ) : (
                  explanation
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs text-blue-600 dark:text-blue-400"
                onClick={() => setShowExplanation(false)}
                disabled={isGeneratingExplanation}
              >
                Hide explanation
              </Button>
            </div>
          )}
          
          <Input
            ref={inputRef}
            id="answer"
            type="text"
            value={userAnswer}
            onChange={handleInputChange}
            placeholder="Type your answer (or ? for an explanation)..."
            aria-label="Your answer"
            disabled={isSubmitting || isGeneratingExplanation}
            className="text-lg p-4"
          />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isGeneratingExplanation || !userAnswer.trim()}
          >
            {isSubmitting ? 'Checking...' : userAnswer.trim() === '?' ? 'Get Explanation' : 'Submit Answer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
