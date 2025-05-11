// Types for cached exam data
export interface CachedExamData {
  deckId: number
  questions: any[]
  userAnswers: Record<number, string>
  results: Record<number, any>
  currentQuestionIndex: number
  timeRemaining: number
  streakCount: number
  difficulty: ExamDifficulty
  startedAt: string
  lastUpdated: string
}

export type ExamDifficulty = "easy" | "medium" | "hard"

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
export function getDifficultySettings(difficulty: ExamDifficulty) {
  switch (difficulty) {
    case "easy":
      return {
        timeMultiplier: 1.5, // More time
        questionCount: 5,
        hintAllowed: true,
        passingScore: 60,
      }
    case "medium":
      return {
        timeMultiplier: 1.0, // Standard time
        questionCount: 10,
        hintAllowed: true,
        passingScore: 70,
      }
    case "hard":
      return {
        timeMultiplier: 0.7, // Less time
        questionCount: 15,
        hintAllowed: false, // No hints in hard mode
        passingScore: 80,
      }
    default:
      return {
        timeMultiplier: 1.0,
        questionCount: 10,
        hintAllowed: true,
        passingScore: 70,
      }
  }
}
