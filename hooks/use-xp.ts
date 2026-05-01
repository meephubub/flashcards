import { useState, useEffect, useCallback } from 'react'

export function useXp() {
  const [totalXp, setTotalXp] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user XP on mount
  useEffect(() => {
    const fetchXp = async () => {
      try {
        const response = await fetch('/api/xp')
        if (response.ok) {
          const data = await response.json()
          setTotalXp(data.xp || 0)
        }
      } catch (error) {
        console.error('Failed to fetch XP:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchXp()
  }, [])

  // Function to add XP
  const addXp = useCallback(async (xp: number) => {
    if (xp <= 0) return

    try {
      const response = await fetch('/api/xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ xp }),
      })

      if (response.ok) {
        setTotalXp(prev => prev + xp)
        return true
      } else {
        console.error('Failed to update XP:', await response.text())
        return false
      }
    } catch (error) {
      console.error('Failed to update XP:', error)
      return false
    }
  }, [])

  return {
    totalXp,
    isLoading,
    addXp,
  }
}
