// stats.ts - Data fetching utilities for FSRS statistics
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from './supabase'
import { isProgressDue } from './spaced-repetition'

export interface UserStats {
    totalCards: number
    totalDecks: number
    cardsDueToday: number
    cardsStudiedToday: number
    averageRetentionRate: number
    currentStreak: number
    longestStreak: number
    totalReviews: number
}

export interface LearningCurveDataPoint {
    date: string
    reviews: number
    retention: number
    newCards: number
}

export interface CardStateDistribution {
    learning: number
    review: number
    relearning: number
}

export interface GCSEAnalytics {
    predictedForgetCount: number
    forgetPercentage: number
    weakestTopic: string
    weakestTopicAccuracy: number
    examDateStr: string
}


/**
 * Get user statistics for the stats dashboard
 */
export async function getUserStats(supabase: SupabaseClient, userId: string): Promise<UserStats> {
    try {
        // Get total decks
        const { count: totalDecks } = await supabase
            .from('decks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)

        // Get all cards for the user
        const { data: userDecks } = await supabase
            .from('decks')
            .select('id')
            .eq('user_id', userId)

        const deckIds = userDecks?.map(d => d.id) || []

        const { count: totalCards } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .in('deck_id', deckIds)

        // Get cards due today
        const today = new Date()
        const { data: progressRecords } = await supabase
            .from('card_progress')
            .select('*')
            .eq('user_id', userId)

        // Calculate due today from progress records
        const cardsDueToday = progressRecords?.filter(record => isProgressDue(record, today)).length || 0

        // Get cards studied today
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const cardsStudiedToday = progressRecords?.filter(record => {
            const lastReviewed = new Date(record.last_reviewed)
            return lastReviewed >= todayStart
        }).length || 0

        // Calculate average retention rate
        // In FSRS, retention can be estimated from the success rate of reviews or current stability
        // For now, we'll calculate it as (Total Reviews - Lapses) / Total Reviews if we had a review log
        // Since we only have current state, we can estimate it based on the number of cards with stability > 1 day
        // A better proxy with current data: Average probability of recall for all cards
        // P = 0.9 ^ (elapsed_days / stability)
        let totalProbability = 0
        let countForRetention = 0

        progressRecords?.forEach(record => {
            if (record.fsrs_state) {
                const stability = record.fsrs_state.stability
                const lastReviewed = new Date(record.last_reviewed)
                const elapsedDays = (today.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
                if (stability > 0) {
                    const retrievability = Math.pow(0.9, elapsedDays / stability)
                    totalProbability += retrievability
                    countForRetention++
                }
            }
        })

        const averageRetentionRate = countForRetention > 0 ? totalProbability / countForRetention : 0

        // Calculate streak (simplified based on last_reviewed dates)
        // Note: This is an approximation since we don't have a daily activity log table
        // We can only see the LAST review date for each card.
        // For a real streak, we'd need a 'daily_activity' table.
        // We'll return 0 for now or implement a best-effort check if we had more history.
        const currentStreak = cardsStudiedToday > 0 ? 1 : 0

        return {
            totalCards: totalCards || 0,
            totalDecks: totalDecks || 0,
            cardsDueToday,
            cardsStudiedToday: cardsStudiedToday || 0,
            averageRetentionRate,
            currentStreak,
            longestStreak: 0, // Placeholder until we have activity history
            totalReviews: progressRecords?.reduce((acc, curr) => acc + curr.repetitions, 0) || 0,
        }
    } catch (error) {
        console.error('Error fetching user stats:', error)
        return {
            totalCards: 0,
            totalDecks: 0,
            cardsDueToday: 0,
            cardsStudiedToday: 0,
            averageRetentionRate: 0,
            currentStreak: 0,
            longestStreak: 0,
            totalReviews: 0,
        }
    }
}

/**
 * Get learning curve data for visualization
 */
export async function getLearningCurveData(
    supabase: SupabaseClient,
    userId: string,
    days: number = 30
): Promise<LearningCurveDataPoint[]> {
    try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Since we don't have a review log, we can't reconstruct the exact history of reviews per day.
        // We will show "Cards Added" (based on created_at of progress) and "Last Reviewed" distribution.
        // This is a proxy for activity.

        const { data: progressRecords } = await supabase
            .from('card_progress')
            .select('*')
            .eq('user_id', userId)
            .gte('last_reviewed', startDate.toISOString())
            .lte('last_reviewed', endDate.toISOString())
            .order('last_reviewed', { ascending: true })

        // Group by date
        const dataByDate = new Map<string, { reviews: number; newCards: number }>()

        progressRecords?.forEach((record) => {
            const date = new Date(record.last_reviewed).toISOString().split('T')[0]
            const existing = dataByDate.get(date) || { reviews: 0, newCards: 0 }

            // We count this as a "review" on that day (it's the last review)
            existing.reviews += 1

            // Check if it was created on that day (approximate "new card")
            const createdDate = new Date(record.created_at).toISOString().split('T')[0]
            if (createdDate === date) {
                existing.newCards += 1
            }

            dataByDate.set(date, existing)
        })

        // Convert to array format for charting
        const result: LearningCurveDataPoint[] = []
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate)
            date.setDate(date.getDate() + i)
            const dateStr = date.toISOString().split('T')[0]
            const data = dataByDate.get(dateStr) || { reviews: 0, newCards: 0 }

            result.push({
                date: dateStr,
                reviews: data.reviews,
                retention: 0, // Hard to calculate historical retention without logs
                newCards: data.newCards,
            })
        }

        return result
    } catch (error) {
        console.error('Error fetching learning curve data:', error)
        return []
    }
}

/**
 * Get card state distribution (Learning/Review/Relearning)
 */
export async function getCardStateDistribution(
    supabase: SupabaseClient,
    userId: string
): Promise<CardStateDistribution> {
    try {
        const { data: progressRecords } = await supabase
            .from('card_progress')
            .select('fsrs_state, repetitions')
            .eq('user_id', userId)

        const distribution = {
            learning: 0,
            review: 0,
            relearning: 0,
        }

        progressRecords?.forEach((record) => {
            const fsrsState = record.fsrs_state as any
            // FSRS State: 0=New, 1=Learning, 2=Review, 3=Relearning
            if (fsrsState?.state === 1) {
                distribution.learning += 1
            } else if (fsrsState?.state === 2) {
                distribution.review += 1
            } else if (fsrsState?.state === 3) {
                distribution.relearning += 1
            } else if (fsrsState?.state === 0) {
                // New cards - technically not in "learning" yet but for stats we might group them or ignore
                // Let's group them in learning for now or ignore? 
                // Usually "New" is separate. Let's add them to learning to show "to be learned"
                distribution.learning += 1
            } else {
                // Fallback
                if (record.repetitions === 0) {
                    distribution.learning += 1
                } else {
                    distribution.review += 1
                }
            }
        })

        return distribution
    } catch (error) {
        console.error('Error fetching card state distribution:', error)
        return {
            learning: 0,
            review: 0,
            relearning: 0,
        }
    }
}
/**
 * Get GCSE specific analytics: forgetfulness prediction and weakest topic
 */
export async function getGCSEAnalytics(
    supabase: SupabaseClient,
    userId: string,
    examDate: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default to 30 days
): Promise<GCSEAnalytics> {
    try {
        const { data: progressRecords } = await supabase
            .from('card_progress')
            .select('*, cards(deck_id, decks(tag))')
            .eq('user_id', userId)

        if (!progressRecords || progressRecords.length === 0) {
            return {
                predictedForgetCount: 0,
                forgetPercentage: 0,
                weakestTopic: "None",
                weakestTopicAccuracy: 0,
                examDateStr: examDate.toLocaleDateString()
            }
        }

        const today = new Date()
        const daysToExam = (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        
        let predictedForgetCount = 0
        const topicStats = new Map<string, { total: number; correct: number }>()

        progressRecords.forEach((record: any) => {
            // 1. Forgetfulness prediction
            if (record.fsrs_state) {
                const stability = record.fsrs_state.stability
                const lastReviewed = new Date(record.last_reviewed)
                const elapsedDaysToExam = (examDate.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
                
                if (stability > 0) {
                    const retrievabilityAtExam = Math.pow(0.9, elapsedDaysToExam / stability)
                    if (retrievabilityAtExam < 0.9) { // Threshold for "likely to forget"
                        predictedForgetCount++
                    }
                }
            }

            // 2. Topic analytics
            const tag = record.cards?.decks?.tag || "General"
            const topic = tag.split('/')[0] // Get top-level tag as topic
            const stats = topicStats.get(topic) || { total: 0, correct: 0 }
            
            stats.total++
            // Assume "correct" if repetitions > 0 and easeFactor is decent
            // or just use latest rating if we had logs. 
            // Here we'll use a heuristic: stability > 5 days = "strong"
            if ((record.fsrs_state?.stability || 0) > 5) {
                stats.correct++
            }
            
            topicStats.set(topic, stats)
        })

        let weakestTopic = "General"
        let minAccuracy = 1.1

        topicStats.forEach((stats, topic) => {
            const accuracy = stats.correct / stats.total
            if (accuracy < minAccuracy) {
                minAccuracy = accuracy
                weakestTopic = topic
            }
        })

        return {
            predictedForgetCount,
            forgetPercentage: Math.round((predictedForgetCount / progressRecords.length) * 100),
            weakestTopic,
            weakestTopicAccuracy: Math.round(minAccuracy * 100),
            examDateStr: examDate.toLocaleDateString()
        }
    } catch (error) {
        console.error('Error fetching GCSE analytics:', error)
        return {
            predictedForgetCount: 0,
            forgetPercentage: 0,
            weakestTopic: "General",
            weakestTopicAccuracy: 0,
            examDateStr: examDate.toLocaleDateString()
        }
    }
}
