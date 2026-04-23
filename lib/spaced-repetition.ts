// Based on the SuperMemo SM-2 algorithm
// https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

import { fsrs, createEmptyCard, type Card as FsrsCard, type Grade } from "ts-fsrs"

export interface CardProgress {
  easeFactor: number // E-factor (easiness factor)
  interval: number // I (inter-repetition interval in days)
  repetitions: number // n (number of repetitions)
  dueDate: string // Next review date
  lastReviewed: string // Last review date
  fsrsState?: FsrsCard // Serialized FSRS card state for this card
  fsrsParams?: any // FSRS parameters used for this card
}

export type ConfidenceRating = 0 | 1 | 2 | 3 | 4 | 5

// Default initial values for a new card
export const DEFAULT_CARD_PROGRESS: CardProgress = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  dueDate: new Date().toISOString(),
  lastReviewed: new Date().toISOString(),
}

/**
 * Calculate the next review date based on the FSRS algorithm
 */
export function calculateNextReview(
  currentProgress: CardProgress,
  rating: ConfidenceRating,
  params?: any
): CardProgress {
  const f = fsrs(params)
  const now = new Date()

  // Convert our 0-5 rating to FSRS Grade (1-4)
  const grade = ratingToGrade(rating)

  // Reconstruct the FSRS card object and ensure Dates are actual Date objects
  let baseCard: FsrsCard;
  if (currentProgress.fsrsState) {
    const state = currentProgress.fsrsState as any;
    baseCard = {
      ...state,
      due: new Date(state.due),
      last_review: state.last_review ? new Date(state.last_review) : undefined
    } as FsrsCard;
  } else {
    // For legacy cards or new cards, start fresh
    baseCard = createEmptyCard(new Date(currentProgress.dueDate || now))
    // If it's a new card (reps=0), make sure it's due now for the scheduler
    if (currentProgress.repetitions === 0) {
      baseCard.due = now
    }
  }

  const record = f.next(baseCard, now, grade)
  const nextCard = record.card as FsrsCard

  const nextProgress: CardProgress = {
    easeFactor: currentProgress.easeFactor, // Legacy
    interval: nextCard.scheduled_days,
    repetitions: nextCard.reps,
    dueDate: nextCard.due.toISOString(),
    lastReviewed: now.toISOString(),
    fsrsState: nextCard,
    fsrsParams: params,
  }

  return nextProgress
}

function ratingToGrade(rating: ConfidenceRating): Grade {
  switch (rating) {
    case 0:
    case 1:
      return 1 // Again
    case 2:
      return 2 // Hard
    case 3:
    case 4:
    case 5:
      return 4 // Easy (as requested: wire Good/Easy to Easy)
    default:
      return 3 // Default to Good
  }
}

/**
 * Check if a card is due for review
 */
export function isCardDue(progress: CardProgress): boolean {
  const now = new Date()
  const dueDate = new Date(progress.dueDate)
  return now >= dueDate
}

/**
 * Get a human-readable string for the next review date
 */
export function getNextReviewText(progress: CardProgress): string {
  const dueDate = new Date(progress.dueDate)
  const now = new Date()

  if (dueDate <= now) {
    return "Due now"
  }

  const diffMs = dueDate.getTime() - now.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffSec < 60) {
    return `${diffSec}s`
  } else if (diffMin < 10) {
    const remainingSec = Math.floor((diffMs % (1000 * 60)) / 1000)
    return remainingSec > 0 ? `${diffMin}m ${remainingSec}s` : `${diffMin}m`
  } else if (diffMin < 60) {
    return `${diffMin}m`
  } else if (diffHours < 24) {
    return `${diffHours}h`
  } else if (diffDays === 0) {
    return "Today"
  } else if (diffDays === 1) {
    return "Tomorrow"
  } else if (diffDays < 30) {
    return `${diffDays}d`
  } else {
    const months = Math.round(diffDays / 30.44)
    return `${months}mo`
  }
}

/**
 * Get a description for a confidence rating
 */
export function getRatingDescription(rating: ConfidenceRating): string {
  switch (rating) {
    case 0:
      return "Complete blackout (Again)"
    case 1:
      return "Incorrect response (Again)"
    case 2:
      return "Correct response with difficulty (Hard)"
    case 3:
      return "Correct response with some effort (Good)"
    case 4:
      return "Correct response with hesitation (Good)"
    case 5:
      return "Perfect recall (Easy)"
    default:
      return ""
  }
}
