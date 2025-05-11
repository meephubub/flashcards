// Based on the SuperMemo SM-2 algorithm
// https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

export interface CardProgress {
  easeFactor: number // E-factor (easiness factor)
  interval: number // I (inter-repetition interval in days)
  repetitions: number // n (number of repetitions)
  dueDate: string // Next review date
  lastReviewed: string // Last review date
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
 * Calculate the next review date based on the SM-2 algorithm
 */
export function calculateNextReview(currentProgress: CardProgress, rating: ConfidenceRating): CardProgress {
  // Clone the current progress to avoid mutations
  const progress = { ...currentProgress }

  // Record the review date
  progress.lastReviewed = new Date().toISOString()

  // If the rating is less than 3, reset the repetition count
  // and set the interval to 1 day (start over)
  if (rating < 3) {
    progress.repetitions = 0
    progress.interval = 1
  } else {
    // Calculate the next interval based on the current repetition count
    if (progress.repetitions === 0) {
      progress.interval = 1
    } else if (progress.repetitions === 1) {
      progress.interval = 6
    } else {
      progress.interval = Math.round(progress.interval * progress.easeFactor)
    }

    // Increment the repetition count
    progress.repetitions += 1
  }

  // Update the ease factor based on the rating
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // where q is the quality of response (0-5)
  const newEF = progress.easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))

  // Ensure the ease factor doesn't go below 1.3
  progress.easeFactor = Math.max(1.3, newEF)

  // Calculate the next due date
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + progress.interval)
  progress.dueDate = dueDate.toISOString()

  return progress
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
      return "Complete blackout"
    case 1:
      return "Incorrect response; the correct answer remembered"
    case 2:
      return "Incorrect response; the correct answer seemed familiar"
    case 3:
      return "Correct response, but required significant effort to recall"
    case 4:
      return "Correct response, after some hesitation"
    case 5:
      return "Perfect response"
    default:
      return ""
  }
}
