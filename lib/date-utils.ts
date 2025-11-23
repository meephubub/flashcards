// Utility functions for formatting dates in a human-readable way

/**
 * Format a date string to a nice readable format
 * @param dateString ISO date string or any valid date string
 * @param format 'short' | 'long' | 'relative'
 * @returns Formatted date string
 */
export function formatDate(dateString: string | null | undefined, format: 'short' | 'long' | 'relative' = 'short'): string {
    if (!dateString || dateString === 'Never') {
        return 'Never'
    }

    try {
        const date = new Date(dateString)

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return dateString
        }

        if (format === 'relative') {
            return formatRelativeDate(date)
        }

        if (format === 'long') {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        }

        // Default 'short' format
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    } catch (error) {
        console.error('Error formatting date:', error)
        return dateString
    }
}

/**
 * Format a date as a relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeDate(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffWeek = Math.floor(diffDay / 7)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) {
        return 'just now'
    } else if (diffMin < 60) {
        return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffHour < 24) {
        return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`
    } else if (diffDay < 7) {
        return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`
    } else if (diffWeek < 4) {
        return `${diffWeek} ${diffWeek === 1 ? 'week' : 'weeks'} ago`
    } else if (diffMonth < 12) {
        return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`
    } else {
        return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`
    }
}

/**
 * Format a date and time to a nice readable format
 */
export function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'Never') {
        return 'Never'
    }

    try {
        const date = new Date(dateString)

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return dateString
        }

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch (error) {
        console.error('Error formatting date/time:', error)
        return dateString
    }
}
