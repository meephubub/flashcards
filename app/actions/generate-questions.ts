"use server"

import { revalidatePath } from "next/cache"
import type { Card } from "@/lib/data"
import type { ExamDifficulty } from "@/lib/exam-cache"

export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "fill-in-blank"
  | "short-answer"
  | "matching"
  | "sequence"
  | "image-based"
  | "analogy"

export interface ExamQuestion {
  id: number
  type: QuestionType
  question: string
  options?: string[]
  correctAnswer: string
  originalCard: Card
  explanation?: string
  imageUrl?: string
  matchingPairs?: Array<{ left: string; right: string }>
  sequence?: string[]
  difficulty: ExamDifficulty
}

export async function generateQuestionsFromCards(
  cards: Card[],
  count = 10,
  difficulty: ExamDifficulty = "medium",
): Promise<ExamQuestion[]> {
  try {
    // If we have fewer cards than requested count, use all cards
    const selectedCards = cards.length <= count ? [...cards] : selectRandomCards(cards, count)

    // Transform cards into different question types
    const questions: ExamQuestion[] = []

    // Use simpler question types to avoid API errors
    const questionTypes: QuestionType[] = ["multiple-choice", "true-false", "fill-in-blank", "short-answer"]

    // Generate questions directly without relying too much on the API
    for (let i = 0; i < selectedCards.length; i++) {
      const card = selectedCards[i]

      // Select question type based on index
      const typeIndex = i % questionTypes.length
      const questionType = questionTypes[typeIndex]

      // Create question based on type - use fallback methods that don't rely on API
      try {
        let question: ExamQuestion

        switch (questionType) {
          case "multiple-choice":
            question = fallbackMultipleChoiceQuestion(card, selectedCards, difficulty)
            break
          case "true-false":
            question = fallbackTrueFalseQuestion(card, difficulty)
            break
          case "fill-in-blank":
            question = fallbackFillInBlankQuestion(card, difficulty)
            break
          default:
            question = {
              id: card.id,
              type: "short-answer",
              question: card.front,
              correctAnswer: card.back,
              originalCard: card,
              difficulty,
              explanation: `The correct answer is: ${card.back}`,
            }
        }

        questions.push(question)
      } catch (error) {
        console.error(`Error creating question for card ${card.id}:`, error)
        // Add a simple fallback question
        questions.push({
          id: card.id,
          type: "short-answer",
          question: card.front,
          correctAnswer: card.back,
          originalCard: card,
          difficulty,
          explanation: `The correct answer is: ${card.back}`,
        })
      }
    }

    revalidatePath("/deck/[id]/exam")
    return questions
  } catch (error) {
    console.error("Error generating questions:", error)

    // Return simple questions as fallback
    return cards.slice(0, Math.min(count, cards.length)).map((card) => ({
      id: card.id,
      type: "short-answer" as QuestionType,
      question: card.front,
      correctAnswer: card.back,
      originalCard: card,
      difficulty,
      explanation: `The correct answer is: ${card.back}`,
    }))
  }
}

function getQuestionTypesByDifficulty(difficulty: ExamDifficulty): QuestionType[] {
  // Simplified to avoid API errors
  return ["multiple-choice", "true-false", "fill-in-blank", "short-answer"]
}

function selectRandomCards(cards: Card[], count: number): Card[] {
  const shuffled = [...cards].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// Keep the fallback functions that don't rely on API calls

function fallbackMultipleChoiceQuestion(card: Card, allCards: Card[], difficulty: ExamDifficulty): ExamQuestion {
  // Get random cards different from the current one to use as distractors
  const otherCards = allCards.filter((c) => c.id !== card.id)

  // Adjust number of distractors based on difficulty
  const numDistractors = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 4

  const distractorCards = selectRandomCards(otherCards, Math.min(numDistractors, otherCards.length))

  // Create options including the correct answer
  const options = [card.back, ...distractorCards.map((c) => c.back)].sort(() => 0.5 - Math.random()) // Shuffle options

  return {
    id: card.id,
    type: "multiple-choice",
    question: card.front,
    options,
    correctAnswer: card.back,
    originalCard: card,
    difficulty,
    explanation: `The correct answer is: ${card.back}`,
  }
}

function fallbackTrueFalseQuestion(card: Card, difficulty: ExamDifficulty): ExamQuestion {
  // Randomly decide if the statement should be true or false
  const isTrue = Math.random() > 0.5

  let question: string
  let correctAnswer: string

  if (isTrue) {
    // Create a true statement based on the card
    question = `True or False: ${card.front} - ${card.back}`
    correctAnswer = "True"
  } else {
    // Create a false statement by modifying the answer
    question = `True or False: ${card.front} - This is NOT ${card.back}`
    correctAnswer = "False"
  }

  return {
    id: card.id,
    type: "true-false",
    question,
    options: ["True", "False"],
    correctAnswer,
    originalCard: card,
    difficulty,
    explanation: isTrue
      ? `This statement is true because ${card.back} is the correct answer to ${card.front}.`
      : `This statement is false because ${card.back} is the correct answer to ${card.front}, not "NOT ${card.back}".`,
  }
}

function fallbackFillInBlankQuestion(card: Card, difficulty: ExamDifficulty): ExamQuestion {
  // Extract a key term from the answer to use as the blank
  const answer = card.back
  const words = answer.split(" ")

  // Find a word with at least 4 characters to use as the blank
  let blankWord = ""
  for (const word of words) {
    if (word.length >= 4 && !word.match(/^[.,;:!?()[\]{}'"]+$/)) {
      blankWord = word
      break
    }
  }

  // If no suitable word found, use the first word
  if (!blankWord && words.length > 0) {
    blankWord = words[0]
  }

  // Create the fill-in-blank question
  const question = `${card.front} - ${answer.replace(blankWord, "________")}`

  return {
    id: card.id,
    type: "fill-in-blank",
    question,
    correctAnswer: blankWord,
    originalCard: card,
    difficulty,
    explanation: `The missing word is "${blankWord}" which completes the answer to the question.`,
  }
}

// Remove or simplify the API-dependent functions
async function createQuestionFromCard(
  card: Card,
  type: QuestionType,
  allCards: Card[],
  difficulty: ExamDifficulty,
): Promise<ExamQuestion> {
  try {
    // For multiple choice, we need to generate distractors
    if (type === "multiple-choice") {
      return fallbackMultipleChoiceQuestion(card, allCards, difficulty)
    }

    // For true/false, we need to generate a statement that's either true or false
    if (type === "true-false") {
      return fallbackTrueFalseQuestion(card, difficulty)
    }

    // For fill-in-blank, we need to create a sentence with a blank
    if (type === "fill-in-blank") {
      return fallbackFillInBlankQuestion(card, difficulty)
    }

    // For short answer, we can use the card front directly
    return {
      id: card.id,
      type: "short-answer",
      question: `${card.front} (Provide a concise explanation)`,
      correctAnswer: card.back,
      originalCard: card,
      explanation: `The correct answer relates to: ${card.back}`,
      difficulty,
    }
  } catch (error) {
    console.error("Error creating question:", error)
    // Fallback to a simple question if there's an error
    return {
      id: card.id,
      type: "short-answer",
      question: card.front,
      correctAnswer: card.back,
      originalCard: card,
      difficulty,
    }
  }
}
