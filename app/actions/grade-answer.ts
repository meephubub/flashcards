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

    // Only grade freeform types with Xenova similarity (no Groq)
    if (questionType === "short-answer" || questionType === "fill-in-blank") {
      try {
        const { getSentenceEmbedding, cosineSimilarity } = await import("./xenova-similarity")
        const userEmbedding = await getSentenceEmbedding(userAnswer)
        const correctEmbedding = await getSentenceEmbedding(correctAnswer)
        const similarity = cosineSimilarity(userEmbedding, correctEmbedding)
        const isCorrect = similarity > 0.75

        return {
          isCorrect,
          score: isCorrect ? 100 : Math.round(similarity * 100),
          feedback: isCorrect
            ? `Correct! (Semantic similarity: ${similarity.toFixed(2)})`
            : `Not quite right. (Semantic similarity: ${similarity.toFixed(2)})\nExpected: ${correctAnswer}`,
          explanation: isCorrect
            ? undefined
            : `Your answer was not semantically similar enough to the expected answer. Try to match the meaning more closely.`,
          suggestions: isCorrect ? undefined : "Try rephrasing your answer to better match the expected meaning.",
        }
      } catch (simErr) {
        console.error("Xenova similarity error (server):", simErr)
        return {
          isCorrect: false,
          score: 0,
          feedback: "An error occurred while grading with the similarity model.",
          explanation: "Please try again or contact support if the problem persists.",
        }
      }
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
