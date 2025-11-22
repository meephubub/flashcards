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
 * 
 * Rating system (0-5):

  const record = fsrsInstance.next(baseCard, now, ratingToGrade(rating))
  const nextCard = record.card as FsrsCard

  const due = nextCard.due ?? now

  const nextProgress: CardProgress = {
    easeFactor: currentProgress.easeFactor,
    interval: nextCard.scheduled_days,
    repetitions: nextCard.reps,
    dueDate: new Date(due).toISOString(),
    lastReviewed: now.toISOString(),
    fsrsState: nextCard,
    fsrsParams: params, // Persist params used for this review
  }

  return nextProgress
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

  // If due today or in the past
  if (dueDate <= now) {
    return "Due now"
  }

  // Calculate the difference in days
  const diffTime = Math.abs(dueDate.getTime() - now.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) {
    return "Tomorrow"
  } else {
    return `In ${diffDays} days`
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
