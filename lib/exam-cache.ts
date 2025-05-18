import type { Card } from "@/lib/data"

// Types for cached exam data
export interface ExamQuestion {
  id: number
  type: string
  question: string
  correctAnswer: string
  options?: string[]
  matchingPairs?: Array<{ left: string; right: string }>
  sequence?: string[]
  imageUrl?: string
  difficulty: ExamDifficulty
  originalCard?: Card
  hint?: string
  hints?: string[]
  explanation?: string
  relatedConcepts?: string[]
}

export interface CachedExamData {
  deckId: number
  questions: ExamQuestion[]
  userAnswers: Record<number, string>
  results: Record<number, GradingResult>
  currentQuestionIndex: number
  timeRemaining: number
  streakCount: number
  difficulty: ExamDifficulty
  startedAt: string
  lastUpdated: string
}

export type ExamDifficulty = "easy" | "medium" | "hard" | "adaptive"

export interface GradingResult {
  isCorrect: boolean
  score: number
  feedback: string
  explanation?: string
  suggestions?: string
  relatedConcepts?: string[]
}

export interface DifficultySettings {
  timeMultiplier: number
  questionCount: number
  hintAllowed: boolean
  passingScore: number
  questionTypes: string[]
  adaptiveScoring: boolean
  timePressure: "low" | "medium" | "high"
  feedbackDetail: "basic" | "detailed"
}

// Get cached exam data for a specific deck
export function getCachedExamData(deckId: number): CachedExamData | null {
  if (typeof window === "undefined") return null

  try {
    const cachedData = localStorage.getItem(`exam_cache_${deckId}`)
    if (!cachedData) return null

    const parsedData = JSON.parse(cachedData) as CachedExamData

    // Check if the cache is too old (24 hours)
    const lastUpdated = new Date(parsedData.lastUpdated)
    const now = new Date()
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)

    if (hoursDiff > 24) {
      // Cache is too old, remove it
      localStorage.removeItem(`exam_cache_${deckId}`)
      return null
    }

    // Validate the cached data
    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      localStorage.removeItem(`exam_cache_${deckId}`)
      return null
    }

    if (!parsedData.userAnswers || typeof parsedData.userAnswers !== 'object') {
      parsedData.userAnswers = {}
    }

    if (!parsedData.results || typeof parsedData.results !== 'object') {
      parsedData.results = {}
    }

    return parsedData
  } catch (error) {
    console.error("Error retrieving cached exam data:", error)
    return null
  }
}

// Save exam data to cache
export function saveExamDataToCache(deckId: number, data: Omit<CachedExamData, "lastUpdated">): void {
  if (typeof window === "undefined") return

  try {
    // Validate the data before saving
    if (!data.questions || !Array.isArray(data.questions)) {
      console.error("Invalid exam data: questions must be an array")
      return
    }

    if (!data.userAnswers || typeof data.userAnswers !== 'object') {
      data.userAnswers = {}
    }

    if (!data.results || typeof data.results !== 'object') {
      data.results = {}
    }

    const dataToSave: CachedExamData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    }

    localStorage.setItem(`exam_cache_${deckId}`, JSON.stringify(dataToSave))
  } catch (error) {
    console.error("Error saving exam data to cache:", error)
  }
}

// Clear cached exam data for a specific deck
export function clearCachedExamData(deckId: number): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(`exam_cache_${deckId}`)
  } catch (error) {
    console.error("Error clearing cached exam data:", error)
  }
}

// Get difficulty settings
export function getDifficultySettings(difficulty: ExamDifficulty, userPerformance?: number) {
  // Adaptive difficulty based on user performance
  if (difficulty === "adaptive" && userPerformance !== undefined) {
    if (userPerformance >= 90) {
      return {
        timeMultiplier: 0.7,
        questionCount: 15,
        hintAllowed: false,
        passingScore: 85,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank", "short-answer", "matching", "sequence", "analogy"],
        adaptiveScoring: true,
        timePressure: "high" as const,
        feedbackDetail: "detailed"
      }
    } else if (userPerformance >= 75) {
      return {
        timeMultiplier: 0.85,
        questionCount: 12,
        hintAllowed: true,
        passingScore: 75,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank", "short-answer"],
        adaptiveScoring: true,
        timePressure: "medium" as const,
        feedbackDetail: "detailed"
      }
    } else {
      return {
        timeMultiplier: 1.2,
        questionCount: 8,
        hintAllowed: true,
        passingScore: 65,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank"],
        adaptiveScoring: true,
        timePressure: "low" as const,
        feedbackDetail: "basic"
      }
    }
  }

  // Fixed difficulty levels
  switch (difficulty) {
    case "easy":
      return {
        timeMultiplier: 1.5,
        questionCount: 8,
        hintAllowed: true,
        passingScore: 60,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank"],
        adaptiveScoring: false,
        timePressure: "low" as const,
        feedbackDetail: "basic"
      }
    case "medium":
      return {
        timeMultiplier: 1.0,
        questionCount: 12,
        hintAllowed: true,
        passingScore: 70,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank", "short-answer"],
        adaptiveScoring: false,
        timePressure: "medium" as const,
        feedbackDetail: "detailed"
      }
    case "hard":
      return {
        timeMultiplier: 0.7,
        questionCount: 15,
        hintAllowed: false,
        passingScore: 80,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank", "short-answer", "sequence", "analogy"],
        adaptiveScoring: false,
        timePressure: "high" as const,
        feedbackDetail: "detailed"
      }
    default:
      return {
        timeMultiplier: 1.0,
        questionCount: 10,
        hintAllowed: true,
        passingScore: 70,
        questionTypes: ["multiple-choice", "true-false", "fill-in-blank", "short-answer"],
        adaptiveScoring: false,
        timePressure: "medium" as const,
        feedbackDetail: "detailed"
      }
  }
}
