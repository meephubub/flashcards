
import { useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'

interface UseTimeTrackingProps {
    activityType: 'study' | 'essay' | 'other'
    subjectId?: string | number
    isEnabled?: boolean
}

export function useTimeTracking({ activityType, subjectId, isEnabled = true }: UseTimeTrackingProps) {
    const sessionIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (!isEnabled) return

        // Generate session ID if not exists
        if (!sessionIdRef.current) {
            sessionIdRef.current = uuidv4()
        }

        const sessionId = sessionIdRef.current
        const sId = subjectId?.toString()

        const sendHeartbeat = async () => {
            // Don't track if page is hidden
            if (document.visibilityState === 'hidden') return

            try {
                await fetch('/api/activity/heartbeat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId,
                        type: activityType,
                        subjectId: sId,
                    }),
                })
            } catch (error) {
                console.error('Failed to send heartbeat:', error)
            }
        }

        // Send initial heartbeat
        sendHeartbeat()

        // Set up interval (every 30 seconds)
        const intervalId = setInterval(sendHeartbeat, 30000)

        // Handle visibility change
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            clearInterval(intervalId)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [activityType, subjectId, isEnabled])
}
