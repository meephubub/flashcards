"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ConfidenceRating } from "@/lib/spaced-repetition"
import { getRatingDescription } from "@/lib/spaced-repetition"

interface ConfidenceRatingProps {
  onRate: (rating: ConfidenceRating) => void
  onCancel: () => void
}

export function ConfidenceRatingComponent({ onRate, onCancel }: ConfidenceRatingProps) {
  const [hoveredRating, setHoveredRating] = useState<ConfidenceRating | null>(null)

  const ratings: ConfidenceRating[] = [0, 1, 2, 3, 4, 5]

  return (
    <Card className="p-4 space-y-4">
      <div className="text-center">
        <h3 className="font-medium text-lg">How well did you know this?</h3>
        <p className="text-sm text-muted-foreground">Rate your confidence to optimize your learning</p>
      </div>

      <div className="flex justify-center gap-2">
        {ratings.map((rating) => {
          // Use different button variants based on rating
          let variant = "outline"
          if (rating < 3) variant = "destructive"
          else if (rating >= 3) variant = "default"

          // Adjust opacity based on rating value
          const opacity =
            rating === 0
              ? "opacity-50"
              : rating === 1
                ? "opacity-60"
                : rating === 2
                  ? "opacity-70"
                  : rating === 3
                    ? "opacity-80"
                    : rating === 4
                      ? "opacity-90"
                      : "opacity-100"

          return (
            <Button
              key={rating}
              variant={variant as any}
              className={`h-12 w-12 ${opacity}`}
              onClick={() => onRate(rating)}
              onMouseEnter={() => setHoveredRating(rating)}
              onMouseLeave={() => setHoveredRating(null)}
            >
              {rating}
            </Button>
          )
        })}
      </div>

      <div className="text-center h-12">
        {hoveredRating !== null && <p className="text-sm">{getRatingDescription(hoveredRating)}</p>}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onCancel}>
          Skip
        </Button>
      </div>
    </Card>
  )
}
