"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { makeGroqRequest } from "@/lib/groq";
import { useSettings } from "@/context/settings-context";

// Import kokoro-js in a type-safe way
let KokoroTTS: any;
let TextSplitterStream: any;

// Dynamic import to avoid SSR issues
if (typeof window !== 'undefined') {
  import('kokoro-js').then((module) => {
    KokoroTTS = module.KokoroTTS;
    TextSplitterStream = module.TextSplitterStream;
  });
}

interface LanguageCardProps {
  questionText: string;
  correctAnswer?: string;
  userAnswer?: string | null;
  similarityScore?: number | null;
  isAnswerChecked?: boolean;
  onSubmitAnswer: (userAnswer: string) => void;
  isSubmitting?: boolean;
  onSkip?: () => void;
}

export function LanguageCard({ 
  questionText, 
  correctAnswer, 
  userAnswer, 
  similarityScore, 
  isAnswerChecked, 
  onSubmitAnswer, 
  isSubmitting, 
  onSkip
}: LanguageCardProps) {
  const { settings } = useSettings();
  const [localUserAnswer, setLocalUserAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ttsInstance = useRef<any>(null);
  const isInitializingTTS = useRef<boolean>(false);
  const audioContext = useRef<AudioContext | null>(null);

  // Update local state when props change (for new cards)
  useEffect(() => {
    if (!isAnswerChecked) {
      setLocalUserAnswer('');
    }
  }, [questionText, isAnswerChecked]);

  useEffect(() => {
    inputRef.current?.focus();

    // Initialize AudioContext
    if (typeof window !== 'undefined' && settings.enableTTS && !audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Initialize TTS engine
    if (settings.enableTTS && !ttsInstance.current && !isInitializingTTS.current && KokoroTTS) {
      const initTTS = async () => {
        try {
          isInitializingTTS.current = true;
          console.log('Initializing TTS engine...');
          const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
          ttsInstance.current = await KokoroTTS.from_pretrained(model_id, {
            dtype: "fp32", 
            device: "wasm",
          });
          console.log('TTS engine initialized successfully');
        } catch (error) {
          console.error('Error initializing TTS:', error);
        } finally {
          isInitializingTTS.current = false;
        }
      };
      initTTS();
    }

    return () => {
      // Clean up AudioContext when component unmounts
      if (audioContext.current) {
        audioContext.current.close().catch(err => console.error('Error closing AudioContext:', err));
      }
    };
  }, [settings.enableTTS]); 

  // Always focus input when answer is checked so Enter can skip
  useEffect(() => {
    if (isAnswerChecked) {
      inputRef.current?.focus();
    }
  }, [isAnswerChecked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localUserAnswer.trim() === '?') {
      generateExplanation();
    } else if (localUserAnswer.trim()) {
      onSubmitAnswer(localUserAnswer.trim());
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
    setLocalUserAnswer(value);
    
    // If user types just '?', prepare to show explanation
    if (value === '?') {
      // Don't auto-submit to allow user to decide when to hit enter
    }
  };

  // Add keydown handler for Enter to skip if isAnswerChecked
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAnswerChecked && e.key === "Enter" && onSkip) {
      e.preventDefault();
      onSkip();
    }
  };

  const playAudio = async () => {
    // Check if TTS is enabled in settings
    if (!settings.enableTTS) return;
    
    // Make sure we have KokoroTTS available (it's dynamically imported)
    if (!KokoroTTS) {
      console.log('TTS engine not yet loaded');
      return;
    }
    
    // Try to initialize TTS if needed
    if (!ttsInstance.current && !isInitializingTTS.current) {
      try {
        isInitializingTTS.current = true;
        console.log('Initializing TTS on demand...');
        const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
        ttsInstance.current = await KokoroTTS.from_pretrained(model_id, {
          dtype: "fp32",
          device: "wasm",
        });
        console.log('TTS initialized successfully on demand');
      } catch (error) {
        console.error('Error initializing TTS on demand:', error);
        isInitializingTTS.current = false;
        return;
      } finally {
        isInitializingTTS.current = false;
      }
    }
    
    // If we still don't have TTS, exit
    if (!ttsInstance.current) return;
    
    try {
      setIsPlayingAudio(true);
      console.log('Starting TTS for text:', questionText);
      
      // Create a new AudioContext if needed
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Set up the text splitter and stream
      const splitter = new TextSplitterStream();
      const stream = ttsInstance.current.stream(splitter);
      
      // Play all chunks of audio as they are generated
      (async () => {
        try {
          for await (const chunk of stream) {
            if (chunk.audio) {
              // Play the audio
              // Some browsers require user interaction before playing audio
              try {
                if (chunk.audio && chunk.audio.play) {
                  await chunk.audio.play();
                } else {
                  console.log('Audio chunk without play method:', chunk.audio);
                }
              } catch (audioError) {
                console.error('Error playing audio chunk:', audioError);
              }
            }
          }
        } catch (e) {
          console.error('Error in TTS stream processing:', e);
        } finally {
          setIsPlayingAudio(false);
          console.log('Finished TTS playback');
        }
      })();
      
      // Send the text to the stream
      splitter.push(questionText);
      splitter.close();
      
    } catch (error) {
      console.error('Error in TTS playback:', error);
      setIsPlayingAudio(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Translate or Answer:</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <p className="text-2xl p-6 bg-secondary rounded-md min-h-[80px] flex items-center justify-center">
              {questionText}
            </p>
            {settings.enableTTS && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={playAudio}
                disabled={isPlayingAudio}
                aria-label="Play text-to-speech"
              >
                <Volume2 className={`h-4 w-4 ${isPlayingAudio ? 'text-primary animate-pulse' : ''}`} />
              </Button>
            )}
          </div>
          
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
            value={localUserAnswer}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Type your answer (or ? for an explanation)..."
            aria-label="Your answer"
            disabled={isSubmitting || isGeneratingExplanation}
            readOnly={isAnswerChecked}
            className="text-lg p-4"
          />
          
          {/* Show answer results after submission */}
          {isAnswerChecked && correctAnswer && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Answer Results</h3>
                {similarityScore !== null && (
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    similarityScore >= 0.75 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {Math.round(similarityScore * 100)}% match
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your answer:</label>
                  <p className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 p-2 rounded border">
                    {userAnswer || localUserAnswer}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Correct answer:</label>
                  <p className="text-gray-900 dark:text-gray-100 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                    {correctAnswer}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isGeneratingExplanation || !localUserAnswer.trim() || isAnswerChecked}
          >
            {isSubmitting ? 'Checking...' : localUserAnswer.trim() === '?' ? 'Get Explanation' : 'Submit Answer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
