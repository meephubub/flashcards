import * as React from "react"
import { Card, CardContent, CardImage } from "./ui/card"
import { Button } from "./ui/button"
import { CardProgress } from "@/lib/spaced-repetition"

interface CardDisplayProps {
  front: string
  back: string
  front_img_url?: string | null
  back_img_url?: string | null
  progress?: CardProgress
  onAnswer: (correct: boolean) => void
  className?: string
}

export function CardDisplay({ front, back, front_img_url, back_img_url, progress, onAnswer, className }: CardDisplayProps) {
  const [isFlipped, setIsFlipped] = React.useState(false)

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleAnswer = (correct: boolean) => {
    onAnswer(correct)
    setIsFlipped(false)
  }

  return (
    <Card className={className}>
      {!isFlipped && front_img_url && <CardImage src={front_img_url} alt="Front image" />}
      {isFlipped && back_img_url && <CardImage src={back_img_url} alt="Back image" />}
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="text-xl font-medium">
            {isFlipped ? back : front}
          </div>
          <div className="flex justify-center gap-4">
            {isFlipped ? (
              <>
                <Button variant="outline" onClick={() => handleAnswer(false)}>
                  Incorrect
                </Button>
                <Button onClick={() => handleAnswer(true)}>
                  Correct
                </Button>
              </>
            ) : (
              <Button onClick={handleFlip}>
                Show Answer
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
 