"use server"

import { revalidatePath } from "next/cache"
import type { QuestionType } from "./generate-questions"
import { GradingResult } from "@/lib/exam-cache"

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

    // Normalize answers for comparison
    const normalizedUserAnswer = userAnswer.toLowerCase().trim()
    const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim()

    // Handle different question types
    let isCorrect = false
    let score = 0
    let feedback = ""
    let explanation = ""
    let suggestions = ""
    let relatedConcepts: string[] = []

    switch (questionType) {
      case "multiple-choice":
      case "true-false":
        isCorrect = normalizedUserAnswer === normalizedCorrectAnswer
        score = isCorrect ? 100 : 0
        feedback = isCorrect ? "Correct!" : "Incorrect. The correct answer is: " + correctAnswer
        break

      case "fill-in-blank":
        // Allow for partial matches and common variations
        const userWords = normalizedUserAnswer.split(/\s+/)
        const correctWords = normalizedCorrectAnswer.split(/\s+/)
        const matchingWords = userWords.filter(word => correctWords.includes(word))
        const accuracy = matchingWords.length / correctWords.length
        isCorrect = accuracy >= 0.8
        score = Math.round(accuracy * 100)
        feedback = isCorrect
          ? "Correct!"
          : `Partially correct. You got ${matchingWords.length} out of ${correctWords.length} words right.`
        break

      case "short-answer":
        // Use semantic similarity for short answers
        const similarity = calculateSemanticSimilarity(normalizedUserAnswer, normalizedCorrectAnswer)
        isCorrect = similarity >= 0.8
        score = Math.round(similarity * 100)
        feedback = isCorrect
          ? "Correct!"
          : "Your answer is close but not quite right. Consider reviewing the material."
        break

      case "matching":
        try {
          const userPairs = JSON.parse(userAnswer)
          const correctPairs = JSON.parse(correctAnswer)
          const correctMatches = userPairs.filter((pair: any) =>
            correctPairs.some(
              (correct: any) =>
                pair.left.toLowerCase() === correct.left.toLowerCase() &&
                pair.right.toLowerCase() === correct.right.toLowerCase()
            )
          )
          const accuracy = correctMatches.length / correctPairs.length
          isCorrect = accuracy >= 0.8
          score = Math.round(accuracy * 100)
          feedback = isCorrect
            ? "Correct!"
            : `You matched ${correctMatches.length} out of ${correctPairs.length} pairs correctly.`
        } catch (error) {
          return {
            isCorrect: false,
            score: 0,
            feedback: "Invalid answer format.",
            explanation: "The answer could not be parsed as matching pairs.",
            suggestions: "Please ensure your answer is in the correct format.",
          }
        }
        break

      case "sequence":
        try {
          const userSequence = JSON.parse(userAnswer)
          const correctSequence = JSON.parse(correctAnswer)
          const correctPositions = userSequence.filter((item: string, index: number) =>
            item.toLowerCase() === correctSequence[index].toLowerCase()
          )
          const accuracy = correctPositions.length / correctSequence.length
          isCorrect = accuracy >= 0.8
          score = Math.round(accuracy * 100)
          feedback = isCorrect
            ? "Correct!"
            : `You got ${correctPositions.length} out of ${correctSequence.length} items in the correct order.`
        } catch (error) {
          return {
            isCorrect: false,
            score: 0,
            feedback: "Invalid answer format.",
            explanation: "The answer could not be parsed as a sequence.",
            suggestions: "Please ensure your answer is in the correct format.",
          }
        }
        break

      default:
        isCorrect = normalizedUserAnswer === normalizedCorrectAnswer
        score = isCorrect ? 100 : 0
        feedback = isCorrect ? "Correct!" : "Incorrect. The correct answer is: " + correctAnswer
    }

    // Apply adaptive scoring if enabled
    if (options?.adaptiveScoring && options.previousAnswers) {
      const recentPerformance = options.previousAnswers
        .slice(-3)
        .reduce((acc, curr) => acc + curr.score, 0) / 3

      if (recentPerformance > 80) {
        // Make scoring stricter for high performers
        score = Math.round(score * 0.9)
        isCorrect = score >= 80
      } else if (recentPerformance < 50) {
        // Make scoring more lenient for struggling students
        score = Math.round(score * 1.1)
        isCorrect = score >= 60
      }
    }

    // Apply time pressure adjustments
    if (options?.timePressure === "high") {
      score = Math.round(score * 1.1) // Bonus for quick answers
    } else if (options?.timePressure === "low") {
      score = Math.round(score * 0.9) // Slightly reduced score for unlimited time
    }

    // Generate detailed feedback
    if (!isCorrect) {
      explanation = `The correct answer was: ${correctAnswer}`
      suggestions = "Consider reviewing the material and trying again."
      relatedConcepts = extractRelatedConcepts(question, correctAnswer)
    }

    return {
      isCorrect,
      score: Math.min(100, score), // Ensure score doesn't exceed 100
      feedback,
      explanation,
      suggestions,
      relatedConcepts,
    }
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
