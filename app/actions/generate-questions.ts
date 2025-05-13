"use server"

import { revalidatePath } from "next/cache"
import type { Card } from "@/lib/data"
import type { ExamDifficulty } from "@/lib/exam-cache"
import { makeGroqRequest } from "@/lib/groq"
import { ExamQuestion } from "@/lib/exam-cache"

export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "fill-in-blank"
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

  // Helper function to generate options for multiple choice
  const generateOptions = (correctAnswer: string, card: Card) => {
    const options = [correctAnswer]
    const otherCards = cards.filter(c => c !== card)
    
    while (options.length < 4) {
      const randomCard = otherCards[Math.floor(Math.random() * otherCards.length)]
      const option = randomCard.back
      if (!options.includes(option)) {
        options.push(option)
      }
    }
    
    return options.sort(() => Math.random() - 0.5)
  }

  // Helper function to generate matching pairs
  const generateMatchingPairs = (card: Card) => {
    const pairs = [{ left: card.front, right: card.back }]
    const otherCards = cards.filter(c => c !== card)
    
    while (pairs.length < 4) {
      const randomCard = otherCards[Math.floor(Math.random() * otherCards.length)]
      const pair = { left: randomCard.front, right: randomCard.back }
      if (!pairs.some(p => p.left === pair.left || p.right === pair.right)) {
        pairs.push(pair)
      }
    }
    
    return pairs.sort(() => Math.random() - 0.5)
  }

  // Helper function to generate sequence
  const generateSequence = (card: Card) => {
    const sequence = [card.back]
    const otherCards = cards.filter(c => c !== card)
    
    while (sequence.length < 4) {
      const randomCard = otherCards[Math.floor(Math.random() * otherCards.length)]
      if (!sequence.includes(randomCard.back)) {
        sequence.push(randomCard.back)
      }
    }
    
    return sequence.sort(() => Math.random() - 0.5)
  }

  // Helper function to generate analogy
  const generateAnalogy = (card: Card) => {
    const otherCards = cards.filter(c => c !== card)
    const randomCard = otherCards[Math.floor(Math.random() * otherCards.length)]
    return `${card.front} is to ${card.back} as ${randomCard.front} is to ${randomCard.back}`
  }

  // Generate questions based on type distribution
  const generateQuestion = (type: QuestionType, card: Card): ExamQuestion => {
    const question: ExamQuestion = {
      id: questions.length + 1,
      type,
      question: "",
      correctAnswer: card.back,
      difficulty: options?.difficulty || "medium"
    }

    switch (type) {
      case "multiple-choice":
        question.question = `What is the correct answer for: ${card.front}?`
        question.options = generateOptions(card.back, card)
        break

      case "true-false":
        const isTrue = Math.random() > 0.5
        question.question = `${card.front} is ${card.back}. True or False?`
        question.correctAnswer = isTrue ? "True" : "False"
        break

      case "fill-in-blank":
        const words = card.back.split(/\s+/)
        const blankIndex = Math.floor(Math.random() * words.length)
        const blankedWords = [...words]
        blankedWords[blankIndex] = "_____"
        question.question = `${card.front}: ${blankedWords.join(" ")}`
        question.correctAnswer = words[blankIndex]
        break

      case "short-answer":
        question.question = `Explain the relationship between: ${card.front}`
        break

      case "matching":
        question.question = "Match the following terms with their correct definitions:"
        question.matchingPairs = generateMatchingPairs(card)
        question.correctAnswer = JSON.stringify(question.matchingPairs)
        break

      case "sequence":
        question.question = "Arrange the following items in the correct order:"
        question.sequence = generateSequence(card)
        question.correctAnswer = JSON.stringify(question.sequence)
        break

      case "analogy":
        question.question = generateAnalogy(card)
        break
    }

    return question
  }

  // Determine question types based on difficulty and previous questions
  const getQuestionTypes = (): QuestionType[] => {
    if (options?.type) {
      return [options.type]
    }

    const types: QuestionType[] = ["multiple-choice", "true-false", "fill-in-blank"]
    
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

  // Generate the requested number of questions
  for (let i = 0; i < count; i++) {
    const card = getRandomCard()
    if (!card) break

    const availableTypes = getQuestionTypes()
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)]
    
    const question = generateQuestion(type, card)
    questions.push(question)
  }

  revalidatePath("/deck/[id]/exam", "page")
  return questions
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
    case "fill-in-blank":
      return fallbackFillInBlankQuestion(card, difficulty)
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
    const prompt = `Generate an engaging and challenging exam question based on the following flashcard:

Front: ${card.front}
Back: ${card.back}
Type: ${type}
Difficulty: ${difficulty}

The question should:
1. Test deep understanding rather than just memorization
2. Be clear and unambiguous
3. Include relevant context
4. Challenge critical thinking
5. Be appropriate for the specified difficulty level
6. Include detailed explanations and hints

For ${type} questions specifically:
${type === "critical-thinking" ? "- Present a scenario that requires analysis and evaluation" : ""}
${type === "application" ? "- Ask how the concept would be applied in a real-world situation" : ""}
${type === "scenario" ? "- Create a realistic scenario that tests understanding" : ""}
${type === "compare-contrast" ? "- Ask to compare and contrast related concepts" : ""}
${type === "cause-effect" ? "- Focus on understanding relationships and consequences" : ""}

Return the response as a JSON object with the following structure:
{
  "question": "The question text",
  "options": ["Option 1", "Option 2", ...] (for multiple choice),
  "correctAnswer": "The correct answer",
  "explanation": "Detailed explanation of the answer",
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "relatedConcepts": ["Concept 1", "Concept 2", ...]
}`

    const response = await makeGroqRequest(prompt, true)
    const parsedContent = JSON.parse(response)

    return {
      id: card.id,
      type,
      question: parsedContent.question,
      options: parsedContent.options,
      correctAnswer: parsedContent.correctAnswer,
      explanation: parsedContent.explanation,
      hints: parsedContent.hints,
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
