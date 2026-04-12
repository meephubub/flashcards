// FSRS-based Exam Scheduler
// Generates daily study sessions optimized for exam date retrievability

import { fsrs, createEmptyCard, type Card as FsrsCard, type Grade, generatorParameters } from "ts-fsrs"
import type { FSRSParams } from "@/components/fsrs-controls"

export interface CardWithProgress {
  id: number
  front: string
  back: string
  deck_id: number
  exclude_from_srs?: boolean
  progress?: {
    ease_factor: number
    interval: number
    repetitions: number
    due_date: string
    last_reviewed: string
    fsrs_state: FsrsCard | null
  } | null
}

export interface ExamSession {
  date: string // ISO date string YYYY-MM-DD
  newTarget: number
  reviewTarget: number
  focus: 'learning' | 'maintenance' | 'retrievability'
  estimatedMinutes: number
}

export interface ExamPlanConfig {
  examDate: string // ISO date YYYY-MM-DD
  strategy: 'start_today' | 'with_breaks' | 'start_later'
  dailyReviewCap: number
  dailyNewCap: number
  estimatedMinutesPerDay: number
  retrievabilityWindowDays: number
}

export interface CardRetrievability {
  cardId: number
  stability: number
  retrievability: number // P(recall) at exam date
  state: number // 0=New, 1=Learning, 2=Review, 3=Relearning
  dueDate: string
  lastReviewed: string
  daysToExam: number
}

/**
 * Calculate retrievability at a target date using FSRS formula
 * R = 0.9^(elapsed_days / stability)
 */
export function calculateRetrievability(
  stability: number,
  lastReviewed: string,
  targetDate: string
): number {
  if (stability <= 0) return 0

  const lastReview = new Date(lastReviewed)
  const target = new Date(targetDate)
  const elapsedMs = target.getTime() - lastReview.getTime()
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)

  if (elapsedDays <= 0) return 1

  // FSRS retrievability formula: R = 0.9^(elapsed/stability)
  return Math.pow(0.9, elapsedDays / stability)
}

/**
 * Calculate retrievability for all cards at exam date
 */
export function calculateDeckRetrievability(
  cards: CardWithProgress[],
  examDate: string,
  today: string = new Date().toISOString().split('T')[0]
): CardRetrievability[] {
  const results: CardRetrievability[] = []

  for (const card of cards) {
    if (card.exclude_from_srs) continue

    const state = card.progress?.fsrs_state ?? null
    const stability = state?.stability ?? 0
    const fsrsState = state?.state ?? 0

    // For new cards, treat stability as very low
    const effectiveStability = stability > 0 ? stability : 0.1

    const lastReviewed = card.progress?.last_reviewed ?? today
    const retrievability = calculateRetrievability(effectiveStability, lastReviewed, examDate)
    const dueDate = card.progress?.due_date ?? today

    const todayDate = new Date(today)
    const exam = new Date(examDate)
    const daysToExam = Math.ceil((exam.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

    results.push({
      cardId: card.id,
      stability: effectiveStability,
      retrievability,
      state: fsrsState,
      dueDate,
      lastReviewed,
      daysToExam: Math.max(0, daysToExam)
    })
  }

  return results
}

/**
 * Get deck readiness metrics
 */
export function getDeckReadiness(
  cards: CardWithProgress[],
  examDate: string,
  targetRetention: number = 0.9
): {
  totalCards: number
  readyCards: number
  atRiskCards: number
  averageRetrievability: number
  newCards: number
  learningCards: number
  reviewCards: number
  relearningCards: number
} {
  const retrievability = calculateDeckRetrievability(cards, examDate)

  let ready = 0
  let atRisk = 0
  let totalR = 0
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0
  let relearningCount = 0

  for (const card of retrievability) {
    totalR += card.retrievability

    if (card.retrievability >= targetRetention) {
      ready++
    } else {
      atRisk++
    }

    switch (card.state) {
      case 0: newCount++; break
      case 1: learningCount++; break
      case 2: reviewCount++; break
      case 3: relearningCount++; break
    }
  }

  return {
    totalCards: retrievability.length,
    readyCards: ready,
    atRiskCards: atRisk,
    averageRetrievability: retrievability.length > 0 ? totalR / retrievability.length : 0,
    newCards: newCount,
    learningCards: learningCount,
    reviewCards: reviewCount,
    relearningCards: relearningCount
  }
}

/**
 * Generate exam study schedule using FSRS
 */
export function generateExamSchedule(
  cards: CardWithProgress[],
  config: ExamPlanConfig,
  fsrsParams: FSRSParams
): ExamSession[] {
  const {
    examDate,
    strategy,
    dailyReviewCap,
    dailyNewCap,
    estimatedMinutesPerDay,
    retrievabilityWindowDays
  } = config

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exam = new Date(examDate)
  exam.setHours(0, 0, 0, 0)

  const totalDays = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (totalDays <= 0) {
    return []
  }

  // Calculate retrievability for all cards
  const cardData = calculateDeckRetrievability(cards, examDate)

  // Separate cards by category
  const newCards = cardData.filter(c => c.state === 0)
  const learningCards = cardData.filter(c => c.state === 1 || c.state === 3)
  const reviewCards = cardData.filter(c => c.state === 2)

  // Sort by risk (lowest retrievability first for prioritization)
  const atRiskCards = [...learningCards, ...reviewCards].sort((a, b) => a.retrievability - b.retrievability)

  // Determine phase boundaries
  const retrievabilityStart = Math.max(0, totalDays - retrievabilityWindowDays)
  const learningEnd = Math.floor(totalDays * 0.6) // Learning phase is first 60%

  const sessions: ExamSession[] = []

  for (let day = 0; day < totalDays; day++) {
    const currentDate = new Date(today)
    currentDate.setDate(currentDate.getDate() + day)
    const dateStr = currentDate.toISOString().split('T')[0]

    // Determine phase
    let focus: 'learning' | 'maintenance' | 'retrievability'
    if (day < learningEnd) {
      focus = 'learning'
    } else if (day < retrievabilityStart) {
      focus = 'maintenance'
    } else {
      focus = 'retrievability'
    }

    // Calculate daily targets based on strategy
    let newTarget = 0
    let reviewTarget = 0

    // Check if this is a "break day" (for with_breaks strategy)
    const isBreakDay = strategy === 'with_breaks' && (currentDate.getDay() === 0 || currentDate.getDay() === 6)
    const isStartLater = strategy === 'start_later' && day < Math.floor(totalDays * 0.4)

    if (!isBreakDay && !isStartLater) {
      switch (focus) {
        case 'learning':
          // Prioritize new cards and learning cards
          newTarget = Math.min(dailyNewCap, newCards.length)
          reviewTarget = Math.min(
            dailyReviewCap - newTarget,
            learningCards.filter(c => c.dueDate <= dateStr).length
          )
          break

        case 'maintenance':
          // Keep up with due reviews
          newTarget = Math.min(Math.ceil(dailyNewCap / 2), newCards.length)
          reviewTarget = Math.min(
            dailyReviewCap - newTarget,
            atRiskCards.filter(c => c.dueDate <= dateStr).length
          )
          break

        case 'retrievability':
          // Focus on at-risk cards for exam
          newTarget = Math.min(Math.ceil(dailyNewCap / 3), newCards.length)
          // Prioritize cards with lowest retrievability
          const examRiskCards = atRiskCards.filter(c => c.retrievability < 0.85)
          reviewTarget = Math.min(dailyReviewCap - newTarget, examRiskCards.length)
          break
      }
    }

    // For start_later, front-load the work in later days
    if (strategy === 'start_later' && !isStartLater) {
      const remainingDays = totalDays - day
      const multiplier = Math.min(2, 1 + (0.5 / Math.max(1, remainingDays / 7)))
      newTarget = Math.ceil(newTarget * multiplier)
      reviewTarget = Math.ceil(reviewTarget * multiplier)
    }

    // Estimate minutes based on card count
    const totalCards = newTarget + reviewTarget
    const estimatedMinutes = Math.min(
      estimatedMinutesPerDay,
      Math.ceil(totalCards * 0.5) // ~30 seconds per card
    )

    sessions.push({
      date: dateStr,
      newTarget,
      reviewTarget,
      focus,
      estimatedMinutes
    })
  }

  return sessions
}

/**
 * Get at-risk cards that need attention before exam
 */
export function getAtRiskCards(
  cards: CardWithProgress[],
  examDate: string,
  threshold: number = 0.85
): CardRetrievability[] {
  const allCards = calculateDeckRetrievability(cards, examDate)
  return allCards
    .filter(c => c.retrievability < threshold && c.state !== 0)
    .sort((a, b) => a.retrievability - b.retrievability)
}

/**
 * Format session data for display
 */
export function formatSessionSummary(sessions: ExamSession[]): {
  totalSessions: number
  totalNewCards: number
  totalReviewCards: number
  averagePerDay: number
  learningDays: number
  maintenanceDays: number
  retrievabilityDays: number
} {
  const totalNew = sessions.reduce((sum, s) => sum + s.newTarget, 0)
  const totalReview = sessions.reduce((sum, s) => sum + s.reviewTarget, 0)

  return {
    totalSessions: sessions.length,
    totalNewCards: totalNew,
    totalReviewCards: totalReview,
    averagePerDay: Math.round((totalNew + totalReview) / Math.max(1, sessions.length)),
    learningDays: sessions.filter(s => s.focus === 'learning').length,
    maintenanceDays: sessions.filter(s => s.focus === 'maintenance').length,
    retrievabilityDays: sessions.filter(s => s.focus === 'retrievability').length
  }
}
