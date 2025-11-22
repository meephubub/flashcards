// stats.ts - Data fetching utilities for FSRS statistics
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from './supabase'

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
            .lte('due_date', today.toISOString())

        const cardsDueToday = progressRecords?.length || 0

        // Get cards studied today
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { count: cardsStudiedToday } = await supabase
            .from('card_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('last_reviewed', todayStart.toISOString())

        return {
            totalCards: totalCards || 0,
            totalDecks: totalDecks || 0,
            cardsDueToday,
            cardsStudiedToday: cardsStudiedToday || 0,
            averageRetentionRate: 0.85, // Placeholder - would need retention tracking
            currentStreak: 0, // Placeholder - would need streak tracking
            longestStreak: 0, // Placeholder
            totalReviews: progressRecords?.length || 0,
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
            existing.reviews += 1
            if (record.repetitions === 0) existing.newCards += 1
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
                retention: 0.85, // Placeholder - would need actual retention tracking
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
            if (fsrsState?.state === 0) {
                distribution.learning += 1
            } else if (fsrsState?.state === 1 || fsrsState?.state === 2) {
                distribution.review += 1
            } else if (fsrsState?.state === 3) {
                distribution.relearning += 1
            } else {
                // Fallback to repetition-based classification
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
