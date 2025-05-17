"use server"

import { revalidatePath } from "next/cache"
import type { QuestionType } from "./generate-questions"
import { GradingResult } from "@/lib/exam-cache"
import { gradeAnswerWithGroq } from "@/lib/groq"

interface GradingOptions {
  adaptiveScoring?: boolean
  timePressure?: "low" | "medium" | "high"
  previousAnswers?: GradingResult[]
  questionType?: string
}

export async function gradeAnswer(
  questionType: string,
  question: string,
  correctAnswer: string,
  userAnswer: string,
  options?: GradingOptions
): Promise<GradingResult> {
  try {
    // Basic answer validation
    if (!userAnswer.trim()) {
      return {
        isCorrect: false,
        score: 0,
        feedback: "Please provide an answer.",
        explanation: "No answer was provided.",
        suggestions: "Try to provide a complete answer next time.",
      }
    }

    // Only grade freeform types with Groq
    if (questionType === "short-answer" || questionType === "fill-in-blank") {
      const result = await gradeAnswerWithGroq(
        questionType,
        question,
        correctAnswer,
        userAnswer,
        {
          adaptiveScoring: options?.adaptiveScoring,
          timePressure: options?.timePressure,
          previousAnswers: options?.previousAnswers
        }
      )

      // Apply time pressure adjustments if needed
      if (options?.timePressure === "high") {
        result.score = Math.round(result.score * 1.1) // Bonus for quick answers
      } else if (options?.timePressure === "low") {
        result.score = Math.round(result.score * 0.9) // Slightly reduced score for unlimited time
      }

      // Ensure score doesn't exceed 100
      result.score = Math.min(100, result.score)
      return result
    }

    // For all other types, do simple grading (case-insensitive, trimmed)
    const isCorrect = userAnswer.trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? "Correct!" : "Incorrect.",
      explanation: isCorrect
        ? undefined
        : `The correct answer was: ${correctAnswer}`,
    };
  } catch (error) {
    console.error("Error grading answer:", error)
    return {
      isCorrect: false,
      score: 0,
      feedback: "An error occurred while grading your answer.",
      explanation: "Please try again or contact support if the problem persists.",
    }
  }
}

// Helper function to calculate semantic similarity between two strings
function calculateSemanticSimilarity(str1: string, str2: string): number {
  // Simple implementation using word overlap
  const words1 = new Set(str1.split(/\s+/))
  const words2 = new Set(str2.split(/\s+/))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  return intersection.size / union.size
}

// Helper function to extract related concepts from the question and answer
function extractRelatedConcepts(question: string, answer: string): string[] {
  // Simple implementation - split into words and remove common words
  const commonWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"])
  const words = [...question.split(/\s+/), ...answer.split(/\s+/)]
  return [...new Set(words.filter(word => !commonWords.has(word.toLowerCase())))]
}
