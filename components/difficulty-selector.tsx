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
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {difficulties.map((difficulty) => (
          <Card
            key={difficulty.value}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedDifficulty === difficulty.value ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleSelect(difficulty.value)}
          >
            <CardContent className="p-3 flex flex-col items-center text-center">
              <div className="text-2xl mb-1">{difficulty.icon}</div>
              <h4 className="font-medium text-sm">{difficulty.label}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{difficulty.description}</p>
              {selectedDifficulty === difficulty.value && <CheckCircle2 className="h-4 w-4 text-primary mt-1" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
