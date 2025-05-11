"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import type { ExamDifficulty } from "@/lib/exam-cache"

interface DifficultyOption {
  value: ExamDifficulty
  label: string
  description: string
  icon: React.ReactNode
}

interface DifficultySelectorProps {
  onSelect: (difficulty: ExamDifficulty) => void
  defaultDifficulty?: ExamDifficulty
}

export function DifficultySelector({ onSelect, defaultDifficulty = "medium" }: DifficultySelectorProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<ExamDifficulty>(defaultDifficulty)

  const difficulties: DifficultyOption[] = [
    {
      value: "easy",
      label: "Easy",
      description: "More time, fewer questions, and hints available",
      icon: "🌱",
    },
    {
      value: "medium",
      label: "Medium",
      description: "Standard time and questions with hints",
      icon: "🌿",
    },
    {
      value: "hard",
      label: "Hard",
      description: "Less time, more questions, and no hints",
      icon: "🌳",
    },
  ]

  const handleSelect = (difficulty: ExamDifficulty) => {
    setSelectedDifficulty(difficulty)
    onSelect(difficulty)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select Difficulty</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {difficulties.map((difficulty) => (
          <Card
            key={difficulty.value}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedDifficulty === difficulty.value ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleSelect(difficulty.value)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="text-3xl mb-2">{difficulty.icon}</div>
              <h4 className="font-medium">{difficulty.label}</h4>
              <p className="text-sm text-muted-foreground mt-1">{difficulty.description}</p>
              {selectedDifficulty === difficulty.value && <CheckCircle2 className="h-5 w-5 text-primary mt-2" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
