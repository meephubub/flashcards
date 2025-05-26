"use server"

import { revalidatePath } from "next/cache"
import type { Card } from "@/lib/data"
import type { ExamDifficulty } from "@/lib/exam-cache"
import { makeGroqRequest } from "@/lib/groq"
import { ExamQuestion } from "@/lib/exam-cache"

export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-answer"
  | "matching"
  | "sequence"
  | "analogy"
  | "critical-thinking"
  | "application"
  | "scenario"
  | "compare-contrast"
  | "cause-effect"

export interface GenerateOptions {
  type?: QuestionType
  difficulty?: ExamDifficulty
  previousQuestions?: ExamQuestion[]
}

export async function generateQuestionsFromCards(
  cards: Card[],
  count: number,
  options?: GenerateOptions
): Promise<ExamQuestion[]> {
  if (cards.length < 3) {
    throw new Error("Need at least 3 cards to generate questions")
  }

  const questions: ExamQuestion[] = []
  const usedCards = new Set<number>()

  // Helper function to get a random unused card
  const getRandomCard = () => {
    const availableCards = cards.filter((_, index) => !usedCards.has(index))
    if (availableCards.length === 0) return null
    const randomIndex = Math.floor(Math.random() * availableCards.length)
    const card = availableCards[randomIndex]
    usedCards.add(cards.indexOf(card))
    return card
  }

  // Determine question types based on difficulty and previous questions
  const getQuestionTypes = (): QuestionType[] => {
    if (options?.type) {
      return [options.type]
    }

    const types: QuestionType[] = ["multiple-choice", "true-false", "short-answer"]
    
    if (options?.difficulty === "medium" || options?.difficulty === "hard") {
      types.push("short-answer", "matching")
    }
    
    if (options?.difficulty === "hard") {
      types.push("sequence", "analogy")
    }

    // Avoid repeating the same question type too often
    if (options?.previousQuestions) {
      const recentTypes = options.previousQuestions.slice(-3).map(q => q.type)
      return types.filter(type => !recentTypes.includes(type))
    }

    return types
  }

  // Generate the requested number of questions using Groq
  for (let i = 0; i < count; i++) {
    const card = getRandomCard()
    if (!card) break

    const availableTypes = getQuestionTypes()
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)]
    try {
      // Use Groq to generate a high-quality question
      // createQuestionFromCard is async and will fallback if Groq fails
      // @ts-ignore: createQuestionFromCard may not be exported, import it if needed
      // eslint-disable-next-line no-undef
      const question = await (typeof createQuestionFromCard !== 'undefined' ? createQuestionFromCard : (await import('./generate-questions')).createQuestionFromCard)(
        card,
        type,
        cards,
        options?.difficulty || 'medium',
      )
      questions.push(question)
    } catch (err) {
      // If Groq fails for any reason, fallback to local logic
      // Fallback logic uses the same type and card
      if (typeof fallbackQuestionGeneration !== 'undefined') {
        // @ts-ignore
        const fallback = fallbackQuestionGeneration(card, type, cards, options?.difficulty || 'medium')
        questions.push(fallback)
      }
    }
  }

  revalidatePath("/deck/[id]/exam", "page")
  return questions
}


function getQuestionTypesByDifficulty(difficulty: ExamDifficulty): QuestionType[] {
  // Simplified to avoid API errors
  return ["multiple-choice", "true-false", "short-answer"]
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



function fallbackQuestionGeneration(
  card: Card,
  type: QuestionType,
  allCards: Card[],
  difficulty: ExamDifficulty
): ExamQuestion {
  switch (type) {
    case "multiple-choice":
      return fallbackMultipleChoiceQuestion(card, allCards, difficulty)
    case "true-false":
      return fallbackTrueFalseQuestion(card, difficulty)

    default:
      return {
        id: card.id,
        type: "short-answer",
        question: card.front,
        correctAnswer: card.back,
        originalCard: card,
        difficulty,
        explanation: `The correct answer relates to: ${card.back}`
      }
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
    const prompt = `You are an expert exam question writer. Given the following flashcard, generate a high-quality, natural-sounding exam question of the specified type. Only generate a question if it makes sense for the card content and type. If not, rephrase or skip that type.

Flashcard Front: ${card.front}
Flashcard Back: ${card.back}
Question Type: ${type}
Difficulty: ${difficulty}

Instructions:
- The question should test deep understanding, not just memorization.
- The question should be clear, unambiguous, and contextually appropriate.
- For true/false, only generate a statement that is naturally true or false. Do NOT rephrase open-ended questions or definitions as true/false. If the card's answer is not a factual statement, skip true/false or rephrase as a factual statement (e.g. "Coronary heart disease is caused when the artery supplying blood becomes blocked. True or False?").
- For multiple-choice, analogy, and matching: Include at least 2 red herrings or plausible distractors that are commonly confused with the correct answer, or that sound similar but are incorrect. Make the options challenging for someone who knows the basics but may be tripped up by subtle differences. Avoid using obviously wrong answers. For science/math, use distractors that are related concepts, similar formulas, or common misconceptions.
- For fill-in-the-blank, blank out a key term from the answer only if the answer is a phrase or sentence.
- For short-answer, ask for explanation or reasoning.
- For matching, provide 3-5 pairs, and for each pair, ensure at least one incorrect option is a common misconception or a similar-sounding term.
- For sequence, provide 3-5 steps or items to order.
- For analogy, use the format "A is to B as C is to D" and make the analogy subtle, not obvious.
- For critical-thinking, scenario, compare-contrast, cause-effect, or application, follow the type's intent.
- Always include a detailed explanation.
- Remember just to return json, no other text, no intro etc.

Examples:
- Multiple Choice (good): "What is the main function of the heart? A) Pump blood B) Digest food C) Circulate oxygen D) Store fat" (where C is a plausible but incorrect answer)
- Multiple Choice (science): "Which equation is correct for magnification? A) image size / real size B) real size / image size C) image size x real size D) image size + real size"
- Matching: "Match the enzyme to its function: (a) Amylase - (1) breaks down starch, (b) Protease - (2) breaks down proteins, (c) Lipase - (3) breaks down fats, (d) Sucrase - (4) breaks down sucrose" (include a pair like "breaks down cellulose" as a distractor)
- Analogy: "Mitochondria is to energy as ribosome is to protein synthesis"
- True/False (good): "The heart pumps blood throughout the body. True or False?" (NOT: "How does the heart pump blood? True or False?")
- Fill-in-the-blank: "The main artery in the body is called the _______."

Return the response as a JSON object with the following structure:
{
  "question": "The question text",
  "options": ["Option 1", "Option 2", ...] (for multiple choice),
  "correctAnswer": "The correct answer",
  "explanation": "Detailed explanation of the answer",
  "relatedConcepts": ["Concept 1", "Concept 2", ...]
}`
    const response = await makeGroqRequest(prompt, true)
    console.log(response)
    let parsedContent
    try {
      // Try normal JSON parse
      parsedContent = JSON.parse(response)
    } catch (jsonErr) {
      // Try to extract JSON object from response string
      const jsonStart = response.indexOf('{')
      const jsonEnd = response.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = response.substring(jsonStart, jsonEnd + 1)
        try {
          parsedContent = JSON.parse(jsonString)
        } catch (extractErr) {
          console.error('Groq non-JSON response (after extraction):', response)
          throw new Error('Groq response could not be parsed as JSON')
        }
      } else {
        console.error('Groq non-JSON response:', response)
        throw new Error('Groq response could not be parsed as JSON')
      }
    }

    return {
      id: card.id,
      type,
      question: parsedContent.question,
      options: parsedContent.options,
      correctAnswer: parsedContent.correctAnswer,
      explanation: parsedContent.explanation,

      relatedConcepts: parsedContent.relatedConcepts,
      difficulty,
      originalCard: card
    }
  } catch (error) {
    console.error("Error creating question:", error)
    // Fallback to basic question if AI generation fails
    return fallbackQuestionGeneration(card, type, allCards, difficulty)
  }
}
