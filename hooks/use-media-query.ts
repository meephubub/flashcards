"use client"

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): [boolean] {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window !== "undefined") {
      const media = window.matchMedia(query)

      // Set initial value
      setMatches(media.matches)

      // Define callback for media query changes
      const listener = () => {
        setMatches(media.matches)
      }

      // Add listener
      media.addEventListener("change", listener)

      // Clean up
      return () => {
        media.removeEventListener("change", listener)
      }
    }

    // Default to false on server-side
    return () => {}
  }, [query])

  return [matches]
}
