"use server"

import { revalidatePath } from "next/cache"
import type { QuestionType } from "./generate-questions"

export interface GradingResult {
  isCorrect: boolean
  score: number // 0-100
  feedback: string
  explanation: string
}

export async function gradeAnswer(
  questionType: QuestionType,
  question: string,
  correctAnswer: string,
  userAnswer: string,
): Promise<GradingResult> {
  try {
    // For matching and sequence questions, we need to parse the JSON
    if (questionType === "matching" || questionType === "sequence") {
      return gradeStructuredAnswer(questionType, correctAnswer, userAnswer)
    }

    // Try to use the API for grading
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content:
                "You are an educational AI that grades student answers with a fun, encouraging tone. Provide accurate, fair assessments with helpful feedback. Return JSON only.",
            },
            {
              role: "user",
              content: `Grade this ${questionType} question answer:
              
Question: ${question}
Correct answer: ${correctAnswer}
Student answer: ${userAnswer}

Evaluate if the student's answer is correct, considering minor variations, typos, or alternative phrasings that still demonstrate understanding.
Assign a score from 0-100.
Provide brief, constructive feedback in a fun, encouraging tone. Use emojis and casual language to make it engaging.
Provide a short explanation of the correct answer.

Return your assessment as a JSON object with these properties:
{
  "isCorrect": boolean,
  "score": number,
  "feedback": string,
  "explanation": string
}`,
            },
          ],
          temperature: 0.5,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        }),
      })

      if (!response.ok) {
        throw new Error("API request failed")
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error("No content returned from Groq")
      }

      // Parse the JSON response
      const result = JSON.parse(content) as GradingResult

      revalidatePath("/deck/[id]/exam")
      return result
    } catch (error) {
      console.error("Error using API for grading, falling back to simple grading:", error)
      return fallbackGrading(questionType, correctAnswer, userAnswer)
    }
  } catch (error) {
    console.error("Error grading answer:", error)
    return fallbackGrading(questionType, correctAnswer, userAnswer)
  }
}

// Helper function to grade structured answers (matching, sequence)
function gradeStructuredAnswer(
  questionType: "matching" | "sequence",
  correctAnswer: string,
  userAnswer: string,
): GradingResult {
  try {
    const correctData = JSON.parse(correctAnswer)
    const userData = JSON.parse(userAnswer)

    if (questionType === "matching") {
      // For matching questions, compare each pair
      const correctPairs = correctData
      const userPairs = userData

      let correctCount = 0
      for (let i = 0; i < correctPairs.length; i++) {
        if (
          i < userPairs.length &&
          correctPairs[i].left === userPairs[i].left &&
          correctPairs[i].right === userPairs[i].right
        ) {
          correctCount++
        }
      }

      const score = Math.round((correctCount / correctPairs.length) * 100)
      const isCorrect = score >= 80

      return {
        isCorrect,
        score,
        feedback: isCorrect
          ? "Great job matching these terms! 🎉"
          : "Nice try! Some matches weren't quite right. Let's review them together.",
        explanation: "Matching these terms correctly helps understand how they relate to each other.",
      }
    } else if (questionType === "sequence") {
      // For sequence questions, compare the order
      const correctSequence = correctData
      const userSequence = userData

      let correctCount = 0
      for (let i = 0; i < correctSequence.length; i++) {
        if (i < userSequence.length && correctSequence[i] === userSequence[i]) {
          correctCount++
        }
      }

      const score = Math.round((correctCount / correctSequence.length) * 100)
      const isCorrect = score >= 80

      return {
        isCorrect,
        score,
        feedback: isCorrect
          ? "You got the sequence right! 🌟 Great understanding of the order."
          : "The sequence isn't quite right. Check the order again!",
        explanation: "Understanding the correct sequence is important for this concept.",
      }
    }

    // Fallback
    return {
      isCorrect: false,
      score: 0,
      feedback: "Unable to grade this answer format.",
      explanation: "There was an issue comparing your answer with the correct one.",
    }
  } catch (error) {
    console.error("Error grading structured answer:", error)
    return {
      isCorrect: false,
      score: 0,
      feedback: "Error grading your answer. Please check your format.",
      explanation: "There was an issue with the answer format.",
    }
  }
}

// Fallback grading function that doesn't rely on API
function fallbackGrading(questionType: QuestionType, correctAnswer: string, userAnswer: string): GradingResult {
  // Simple string comparison for basic grading
  let isCorrect = false
  let score = 0
  let feedback = ""
  let explanation = ""

  // Normalize answers for comparison
  const normalizedCorrect = correctAnswer.trim().toLowerCase()
  const normalizedUser = userAnswer.trim().toLowerCase()

  switch (questionType) {
    case "multiple-choice":
    case "true-false":
      // Exact match required for multiple choice and true/false
      isCorrect = normalizedCorrect === normalizedUser
      score = isCorrect ? 100 : 0
      feedback = isCorrect ? "Correct! Great job! 🎉" : "Not quite right. The correct answer was different. 🤔"
      explanation = `The correct answer is: ${correctAnswer}`
      break

    case "fill-in-blank":
      // Check if user answer contains the correct answer or vice versa
      isCorrect = normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedUser)
      score = isCorrect ? 100 : 0
      feedback = isCorrect
        ? "You got it! Nice work filling in the blank! 🎉"
        : "Not quite right. Try again with a different word. 🤔"
      explanation = `The correct answer is: ${correctAnswer}`
      break

    case "short-answer":
      // For short answer, check if there's significant overlap
      const correctWords = new Set(normalizedCorrect.split(/\s+/).filter((w) => w.length > 3))
      const userWords = new Set(normalizedUser.split(/\s+/).filter((w) => w.length > 3))

      // Count matching significant words
      let matchCount = 0
      for (const word of userWords) {
        if (correctWords.has(word)) {
          matchCount++
        }
      }

      // Calculate score based on overlap
      const overlapScore = correctWords.size > 0 ? Math.min(100, Math.round((matchCount / correctWords.size) * 100)) : 0

      isCorrect = overlapScore >= 70
      score = overlapScore
      feedback = isCorrect
        ? "Great answer! You've captured the key points. 🌟"
        : "Your answer has some good elements, but could be more complete. 📚"
      explanation = `A complete answer would include: ${correctAnswer}`
      break

    default:
      // Default fallback
      isCorrect = normalizedCorrect === normalizedUser
      score = isCorrect ? 100 : 0
      feedback = isCorrect ? "Correct! Well done! 🎉" : "Not quite right. Let's review the answer. 🤔"
      explanation = `The correct answer is: ${correctAnswer}`
  }

  return {
    isCorrect,
    score,
    feedback,
    explanation,
  }
}
