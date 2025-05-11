"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Trophy,
  Sparkles,
  Clock,
  Award,
  Brain,
  Save,
  RotateCw,
  Trash,
} from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { useDecks } from "@/context/deck-context"
import { useSettings } from "@/context/settings-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { generateQuestionsFromCards, type ExamQuestion } from "@/app/actions/generate-questions"
import { gradeAnswer, type GradingResult } from "@/app/actions/grade-answer"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd"
import confetti from "canvas-confetti"
import { DifficultySelector } from "@/components/difficulty-selector"
import {
  getCachedExamData,
  saveExamDataToCache,
  clearCachedExamData,
  getDifficultySettings,
  type ExamDifficulty,
} from "@/lib/exam-cache"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface ExamModeProps {
  deckId: number
}

export function ExamMode({ deckId }: ExamModeProps) {
  const { getDeck, loading } = useDecks()
  const { settings } = useSettings()
  const router = useRouter()
  const { toast } = useToast()

  const deck = getDeck(deckId)

  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, GradingResult>>({})
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGrading, setIsGrading] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(true)
  const [examScore, setExamScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("medium")
  const [hasCachedExam, setHasCachedExam] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMobile] = useMediaQuery("(max-width: 768px)")

  // For matching questions
  const [matchingPairs, setMatchingPairs] = useState<Array<{ left: string; right: string }>>([])

  // For sequence questions
  const [sequence, setSequence] = useState<string[]>([])

  const confettiRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Check for cached exam data when component mounts
  useEffect(() => {
    if (deck && !loading) {
      const cachedData = getCachedExamData(deckId)
      if (cachedData) {
        setHasCachedExam(true)
      } else {
        generateExamQuestions()
      }
    }
  }, [deck, loading, deckId])

  // Timer for exam
  useEffect(() => {
    if (!examStarted || examCompleted) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Auto-submit when time runs out
          if (!examCompleted) {
            toast({
              title: "Time's up!",
              description: "Your exam has been automatically submitted.",
              variant: "destructive",
            })
            calculateFinalScore()
            setExamCompleted(true)
          }
          return 0
        }

        // Save progress every minute
        if (prev % 60 === 0) {
          saveExamProgress()
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examStarted, examCompleted])

  // Save exam progress
  const saveExamProgress = () => {
    if (!examStarted || examCompleted) return

    setIsSaving(true)
    try {
      saveExamDataToCache(deckId, {
        deckId,
        questions,
        userAnswers,
        results,
        currentQuestionIndex,
        timeRemaining,
        streakCount,
        difficulty,
        startedAt: new Date().toISOString(),
      })

      setIsSaving(false)
      toast({
        title: "Progress saved",
        description: "Your exam progress has been saved automatically.",
      })
    } catch (error) {
      console.error("Error saving exam progress:", error)
      setIsSaving(false)
    }
  }

  // Resume cached exam
  const resumeCachedExam = () => {
    const cachedData = getCachedExamData(deckId)
    if (!cachedData) return

    setQuestions(cachedData.questions)
    setUserAnswers(cachedData.userAnswers)
    setResults(cachedData.results)
    setCurrentQuestionIndex(cachedData.currentQuestionIndex)
    setTimeRemaining(cachedData.timeRemaining)
    setStreakCount(cachedData.streakCount)
    setDifficulty(cachedData.difficulty)
    setExamStarted(true)
    setIsGeneratingQuestions(false)
    setShowResumeDialog(false)

    // Restore current question state
    const currentQuestion = cachedData.questions[cachedData.currentQuestionIndex]
    if (currentQuestion) {
      const savedAnswer = cachedData.userAnswers[currentQuestion.id] || ""

      if (currentQuestion.type === "matching" && currentQuestion.matchingPairs) {
        try {
          setMatchingPairs(JSON.parse(savedAnswer) || currentQuestion.matchingPairs)
        } catch {
          setMatchingPairs(currentQuestion.matchingPairs)
        }
      } else if (currentQuestion.type === "sequence" && currentQuestion.sequence) {
        try {
          setSequence(JSON.parse(savedAnswer) || currentQuestion.sequence)
        } catch {
          setSequence(currentQuestion.sequence)
        }
      } else {
        setCurrentAnswer(savedAnswer)
      }
    }

    toast({
      title: "Exam resumed",
      description: "Your previous exam progress has been loaded.",
    })
  }

  // Discard cached exam
  const discardCachedExam = () => {
    clearCachedExamData(deckId)
    setHasCachedExam(false)
    setShowResumeDialog(false)
    generateExamQuestions()
  }

  const generateExamQuestions = async (selectedDifficulty: ExamDifficulty = difficulty) => {
    if (!deck) return

    setIsGeneratingQuestions(true)
    try {
      // Clear any existing cached exam
      clearCachedExamData(deckId)

      // Get difficulty settings
      const settings = getDifficultySettings(selectedDifficulty)

      const generatedQuestions = await generateQuestionsFromCards(
        deck.cards,
        Math.min(settings.questionCount, deck.cards.length),
      )

      setQuestions(generatedQuestions)
      // Reset state
      setCurrentQuestionIndex(0)
      setUserAnswers({})
      setResults({})
      setCurrentAnswer("")
      setExamCompleted(false)
      setTimeRemaining(Math.round(60 * 15 * settings.timeMultiplier)) // Adjust time based on difficulty
      setStreakCount(0)
      setShowHint(false)
      setDifficulty(selectedDifficulty)
      setHasCachedExam(false)

      // Save initial exam state to cache
      saveExamDataToCache(deckId, {
        deckId,
        questions: generatedQuestions,
        userAnswers: {},
        results: {},
        currentQuestionIndex: 0,
        timeRemaining: Math.round(60 * 15 * settings.timeMultiplier),
        streakCount: 0,
        difficulty: selectedDifficulty,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error generating questions:", error)
      toast({
        title: "Error",
        description: "Failed to generate exam questions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  const loadCachedExam = () => {
    const cachedData = getCachedExamData(deckId)
    if (!cachedData) return

    setQuestions(cachedData.questions)
    setUserAnswers(cachedData.userAnswers)
    setResults(cachedData.results)
    setCurrentQuestionIndex(cachedData.currentQuestionIndex)
    setTimeRemaining(cachedData.timeRemaining)
    setStreakCount(cachedData.streakCount)
    setDifficulty(cachedData.difficulty)

    // Set current answer for the current question
    const currentQuestionId = cachedData.questions[cachedData.currentQuestionIndex]?.id
    if (currentQuestionId && cachedData.userAnswers[currentQuestionId]) {
      setCurrentAnswer(cachedData.userAnswers[currentQuestionId])
    }

    setHasCachedExam(false)
    setExamStarted(true)
  }

  const startExam = () => {
    setExamStarted(true)

    // Save initial exam state to cache
    saveExamDataToCache(deckId, {
      deckId,
      questions,
      userAnswers: {},
      results: {},
      currentQuestionIndex: 0,
      timeRemaining,
      streakCount: 0,
      difficulty,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    })
  }

  const saveExamState = () => {
    saveExamDataToCache(deckId, {
      deckId,
      questions,
      userAnswers,
      results,
      currentQuestionIndex,
      timeRemaining,
      streakCount,
      difficulty,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    })

    toast({
      title: "Progress saved",
      description: "Your exam progress has been saved. You can continue later.",
    })
  }

  const handleSubmitAnswer = async () => {
    const currentQuestion = questions[currentQuestionIndex]

    // Validate answer based on question type
    if (currentQuestion.type === "matching") {
      if (matchingPairs.length === 0) {
        toast({
          title: "Answer required",
          description: "Please match all pairs before submitting.",
          variant: "destructive",
        })
        return
      }
      // Convert matching pairs to string for grading
      setCurrentAnswer(JSON.stringify(matchingPairs))
    } else if (currentQuestion.type === "sequence") {
      if (sequence.length === 0) {
        toast({
          title: "Answer required",
          description: "Please arrange the sequence before submitting.",
          variant: "destructive",
        })
        return
      }
      // Convert sequence to string for grading
      setCurrentAnswer(JSON.stringify(sequence))
    } else if (!currentAnswer.trim()) {
      toast({
        title: "Answer required",
        description: "Please provide an answer before submitting.",
        variant: "destructive",
      })
      return
    }

    // Save the user's answer
    const answerToSave =
      currentQuestion.type === "matching"
        ? JSON.stringify(matchingPairs)
        : currentQuestion.type === "sequence"
          ? JSON.stringify(sequence)
          : currentAnswer

    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answerToSave,
    }))

    setIsGrading(true)

    try {
      // Grade the answer using AI
      const gradingResult = await gradeAnswer(
        currentQuestion.type,
        currentQuestion.question,
        currentQuestion.type === "matching"
          ? JSON.stringify(currentQuestion.matchingPairs)
          : currentQuestion.type === "sequence"
            ? JSON.stringify(currentQuestion.sequence)
            : currentQuestion.correctAnswer,
        answerToSave,
      )

      // Save the result
      setResults((prev) => {
        const newResults = {
          ...prev,
          [currentQuestion.id]: gradingResult,
        }

        // Save progress after grading
        setTimeout(() => {
          saveExamDataToCache(deckId, {
            deckId,
            questions,
            userAnswers: {
              ...userAnswers,
              [currentQuestion.id]: answerToSave,
            },
            results: newResults,
            currentQuestionIndex,
            timeRemaining,
            streakCount: gradingResult.isCorrect ? streakCount + 1 : 0,
            difficulty,
            startedAt: new Date().toISOString(),
          })
        }, 500)

        return newResults
      })

      // Update streak count
      if (gradingResult.isCorrect) {
        setStreakCount((prev) => prev + 1)

        // Show confetti for correct answers
        if (confettiRef.current && streakCount >= 2) {
          const rect = confettiRef.current.getBoundingClientRect()
          confetti({
            particleCount: 100,
            spread: 70,
            origin: {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            },
          })
        }
      } else {
        setStreakCount(0)
      }

      // Show feedback toast
      toast({
        title: gradingResult.isCorrect ? "Correct! 🎉" : "Not quite right 🤔",
        description: gradingResult.feedback,
        variant: gradingResult.isCorrect ? "default" : "destructive",
      })

      // Save progress to cache with the grading result
      saveExamDataToCache(deckId, {
        deckId,
        questions,
        userAnswers: {
          ...userAnswers,
          [currentQuestion.id]: answerToSave,
        },
        results: {
          ...results,
          [currentQuestion.id]: gradingResult,
        },
        currentQuestionIndex,
        timeRemaining,
        streakCount: gradingResult.isCorrect ? streakCount + 1 : 0,
        difficulty,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error grading answer:", error)
      toast({
        title: "Error",
        description: "Failed to grade your answer. Please try again.",
        variant: "destructive",
      })

      // Even if grading fails, save the user's answer
      saveExamDataToCache(deckId, {
        deckId,
        questions,
        userAnswers: {
          ...userAnswers,
          [currentQuestion.id]: answerToSave,
        },
        results,
        currentQuestionIndex,
        timeRemaining,
        streakCount,
        difficulty,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
    } finally {
      setIsGrading(false)
    }
  }

  const handleNextQuestion = () => {
    // Only allow proceeding if the current question has been answered and graded
    if (!results[questions[currentQuestionIndex].id]) {
      toast({
        title: "Answer required",
        description: "Please submit your answer before proceeding.",
        variant: "destructive",
      })
      return
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setCurrentAnswer("")
      setMatchingPairs([])
      setSequence([])
      setShowHint(false)

      // Prepare the next question if it's a matching or sequence type
      const nextQuestion = questions[currentQuestionIndex + 1]
      if (nextQuestion.type === "matching" && nextQuestion.matchingPairs) {
        // Shuffle the pairs for matching questions
        const shuffledPairs = [...nextQuestion.matchingPairs].sort(() => 0.5 - Math.random())
        setMatchingPairs(shuffledPairs)
      } else if (nextQuestion.type === "sequence" && nextQuestion.sequence) {
        // Shuffle the sequence
        const shuffledSequence = [...nextQuestion.sequence].sort(() => 0.5 - Math.random())
        setSequence(shuffledSequence)
      }

      // Save progress after moving to next question
      setTimeout(() => saveExamProgress(), 500)
    } else {
      // Calculate final score
      calculateFinalScore()
      setExamCompleted(true)
      // Clear cached exam data when completed
      clearCachedExamData(deckId)
    }
    // Save progress to cache
    saveExamDataToCache(deckId, {
      deckId,
      questions,
      userAnswers,
      results,
      currentQuestionIndex: currentQuestionIndex + 1,
      timeRemaining,
      streakCount,
      difficulty,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    })
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      // Restore previous answer if it exists
      const prevQuestionId = questions[currentQuestionIndex - 1].id
      const prevAnswer = userAnswers[prevQuestionId] || ""

      const prevQuestion = questions[currentQuestionIndex - 1]
      if (prevQuestion.type === "matching") {
        try {
          setMatchingPairs(JSON.parse(prevAnswer))
        } catch {
          setMatchingPairs(prevQuestion.matchingPairs || [])
        }
      } else if (prevQuestion.type === "sequence") {
        try {
          setSequence(JSON.parse(prevAnswer))
        } catch {
          setSequence(prevQuestion.sequence || [])
        }
      } else {
        setCurrentAnswer(prevAnswer)
      }

      // Save progress after moving to previous question
      setTimeout(() => saveExamProgress(), 500)
    }
  }

  const calculateFinalScore = () => {
    if (questions.length === 0) return 0

    let totalScore = 0
    let answeredQuestions = 0

    for (const question of questions) {
      if (results[question.id]) {
        totalScore += results[question.id].score
        answeredQuestions++
      }
    }

    const finalScore = answeredQuestions > 0 ? Math.round(totalScore / answeredQuestions) : 0

    setExamScore(finalScore)
    return finalScore
  }

  const restartExam = () => {
    // Clear cached exam data
    clearCachedExamData(deckId)
    setHasCachedExam(false)

    // Reset state
    setExamStarted(false)
    setExamCompleted(false)
    setCurrentQuestionIndex(0)
    setUserAnswers({})
    setResults({})
    setCurrentAnswer("")
    setMatchingPairs([])
    setSequence([])
    setStreakCount(0)
    setShowHint(false)

    // Generate new questions
    generateExamQuestions()
  }

  const toggleHint = () => {
    setShowHint(!showHint)
  }

  // Handle drag and drop for sequence questions
  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(sequence)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setSequence(items)
  }

  // Handle matching pairs
  const handleMatchingChange = (leftIndex: number, rightValue: string) => {
    const updatedPairs = [...matchingPairs]
    updatedPairs[leftIndex].right = rightValue
    setMatchingPairs(updatedPairs)
  }

  // Handle touch swipe for mobile navigation between questions
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    }

    const deltaX = touchEnd.x - touchStartRef.current.x
    const deltaY = touchEnd.y - touchStartRef.current.y

    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - go to previous question
        if (currentQuestionIndex > 0) {
          handlePreviousQuestion()
        }
      } else {
        // Swipe left - go to next question if already answered
        if (results[questions[currentQuestionIndex]?.id]) {
          handleNextQuestion()
        }
      }
    }

    touchStartRef.current = null
  }

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case "enter":
          if (currentQuestionIndex < questions.length - 1) {
            handleNextQuestion()
          } else {
            calculateFinalScore()
            setExamCompleted(true)
          }
          break
        case "h":
          if (showHint) {
            setShowHint(false)
          } else if (difficulty !== "hard") {
            setShowHint(true)
          }
          break
        case " ":
          if (currentQuestionIndex < questions.length - 1) {
            handleNextQuestion()
          }
          break
        case "p":
          if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1)
          }
          break
        case "1":
        case "2":
        case "3":
        case "4":
          if (currentQuestion?.type === "multiple-choice" && currentQuestion.options) {
            const index = parseInt(e.key) - 1
            if (index >= 0 && index < currentQuestion.options.length) {
              setUserAnswers((prev) => ({
                ...prev,
                [currentQuestion.id]: currentQuestion.options![index],
              }))
            }
          }
          break
        case "t":
          if (currentQuestion?.type === "true-false") {
            setUserAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: "True",
            }))
          }
          break
        case "f":
          if (currentQuestion?.type === "true-false") {
            setUserAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: "False",
            }))
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentQuestion, currentQuestionIndex, questions.length, showHint, difficulty])

  if (loading || isGeneratingQuestions) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>

        <Skeleton className="h-1 w-full" />

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Deck not found</h2>
        <p className="text-gray-500 mb-6">The deck you're looking for doesn't exist or has been deleted.</p>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    )
  }

  if (deck.cards.length < 3) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Not enough cards</h2>
        <p className="text-gray-500 mb-6">You need at least 3 cards in this deck to take an exam.</p>
        <Button asChild>
          <Link href={`/deck/${deckId}`}>Back to Deck</Link>
        </Button>
      </div>
    )
  }

  if (questions.length === 0 && !hasCachedExam) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Failed to generate exam questions</h2>
        <p className="text-gray-500 mb-6">There was an error creating exam questions from your flashcards.</p>
        <Button onClick={generateExamQuestions}>Try Again</Button>
      </div>
    )
  }

  // Show resume dialog
  if (showResumeDialog) {
    return (
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume Previous Exam?</DialogTitle>
            <DialogDescription>
              You have an unfinished exam for this deck. Would you like to resume where you left off or start a new
              exam?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={discardCachedExam} className="sm:order-1">
              <Trash className="mr-2 h-4 w-4" />
              Discard & Start New
            </Button>
            <Button onClick={resumeCachedExam} className="sm:order-2">
              <RotateCw className="mr-2 h-4 w-4" />
              Resume Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Show exam start screen
  if (!examStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/deck/${deckId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Exam: {deck.name}</h1>
        </div>

        <Card className="py-6">
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                <Brain className="h-12 w-12" />
              </div>

              <div className="mt-4">
                <h2 className="text-2xl font-bold">Ready to Test Your Knowledge?</h2>
                <p className="text-muted-foreground mt-2">
                  This exam contains questions of various types to test your understanding.
                </p>
              </div>
            </div>

            {hasCachedExam && (
              <Card className="bg-secondary/50 p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Resume Previous Exam</h3>
                    <p className="text-sm text-muted-foreground">
                      You have an unfinished exam. Would you like to continue?
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setHasCachedExam(false)}>
                      Start New
                    </Button>
                    <Button onClick={loadCachedExam}>
                      <RotateCw className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {!hasCachedExam && (
              <DifficultySelector
                onSelect={(selectedDifficulty) => {
                  setDifficulty(selectedDifficulty)
                  generateExamQuestions(selectedDifficulty)
                }}
                defaultDifficulty={difficulty}
              />
            )}

            {!hasCachedExam && (
              <div className="flex flex-col items-center pt-4">
                <Button onClick={startExam} size="lg" className="px-8">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start Exam
                </Button>

                <div className="text-sm text-muted-foreground mt-4">
                  <p>Tip: You can save your progress at any time and continue later.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const currentResult = results[currentQuestion?.id]
  const hasAnswered = !!currentResult
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  // Format time remaining
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

  // Get difficulty settings
  const diffSettings = getDifficultySettings(difficulty)

  // Render the exam completion screen
  if (examCompleted) {
    const answeredCount = Object.keys(results).length
    const correctCount = Object.values(results).filter((r) => r.isCorrect).length
    const isPassing = examScore >= diffSettings.passingScore

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/deck/${deckId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Exam Results: {deck.name}</h1>
        </div>

        <Card className="text-center py-8">
          <CardContent className="space-y-6">
            <div className="mx-auto w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
              <Trophy className="h-12 w-12" />
            </div>

            <div>
              <h2 className="text-3xl font-bold">{examScore}%</h2>
              <p className="text-muted-foreground mt-1">
                Your final score - {isPassing ? "Passed! 🎉" : "Not passed yet 🤔"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Passing score: {diffSettings.passingScore}%</p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-secondary p-4 rounded-lg">
                <div className="text-2xl font-bold">{answeredCount}</div>
                <div className="text-sm text-muted-foreground">Questions</div>
              </div>
              <div className="bg-secondary p-4 rounded-lg">
                <div className="text-2xl font-bold">{correctCount}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="bg-secondary p-4 rounded-lg">
                <div className="text-2xl font-bold">{Math.max(0, streakCount)}</div>
                <div className="text-sm text-muted-foreground">Best Streak</div>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={restartExam} className="mr-2">
                Take Another Exam
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/deck/${deckId}`}>Back to Deck</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-medium">Question Review</h2>

          {questions.map((question, index) => {
            const result = results[question.id]
            if (!result) return null

            // Use different border styles based on correctness
            const borderStyle = result.isCorrect ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive"

            return (
              <Card key={question.id} className={borderStyle}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.isCorrect ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    Question {index + 1}: {result.isCorrect ? "Correct" : "Incorrect"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium">Question:</div>
                    <div>{question.question}</div>
                  </div>
                  <div>
                    <div className="font-medium">Your answer:</div>
                    <div>{userAnswers[question.id]}</div>
                  </div>
                  <div>
                    <div className="font-medium">Correct answer:</div>
                    <div>{question.correctAnswer}</div>
                  </div>
                  <div>
                    <div className="font-medium">Feedback:</div>
                    <div>{result.explanation}</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="max-w-3xl mx-auto space-y-6"
      ref={confettiRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/deck/${deckId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold truncate">Exam: {deck.name}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Button variant="outline" size="sm" onClick={saveExamState} className="hidden sm:flex">
            <Save className="h-4 w-4 mr-2" />
            Save Progress
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-4 w-4" />
            <span className={timeRemaining < 60 ? "text-destructive" : ""}>{formattedTime}</span>
          </div>
          {streakCount > 0 && (
            <div className="flex items-center gap-1">
              <Award className="h-4 w-4" />
              <span>Streak: {streakCount}</span>
            </div>
          )}
          <div className="text-muted-foreground">
            {currentQuestionIndex + 1}/{questions.length}
          </div>
          {isSaving && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Save className="h-4 w-4 animate-pulse" />
              <span className="sr-only">Saving...</span>
            </div>
          )}
        </div>
      </div>

      <Progress value={progress} className="h-1" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center flex-wrap gap-2">
            <span>
              {currentQuestion.type === "multiple-choice" && "Multiple Choice"}
              {currentQuestion.type === "true-false" && "True or False"}
              {currentQuestion.type === "fill-in-blank" && "Fill in the Blank"}
              {currentQuestion.type === "short-answer" && "Short Answer"}
              {currentQuestion.type === "matching" && "Matching"}
              {currentQuestion.type === "sequence" && "Sequence"}
              {currentQuestion.type === "image-based" && "Image-Based Question"}
              {currentQuestion.type === "analogy" && "Analogy"}
            </span>
            {!hasAnswered && diffSettings.hintAllowed && (
              <Button variant="outline" size="sm" onClick={toggleHint}>
                {showHint ? "Hide Hint" : "Show Hint"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-lg font-medium">{currentQuestion.question}</div>

          {/* Show image for image-based questions */}
          {currentQuestion.type === "image-based" && currentQuestion.imageUrl && (
            <div className="flex justify-center my-4">
              <img
                src={currentQuestion.imageUrl || "/placeholder.svg"}
                alt="Question visual"
                className="max-w-full max-h-64 rounded-md"
              />
            </div>
          )}

          {/* Different input types based on question type */}
          {currentQuestion.type === "multiple-choice" && (
            <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer} disabled={hasAnswered}>
              {currentQuestion.options?.map((option, i) => (
                <div key={i} className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/50">
                  <RadioGroupItem value={option} id={`option-${i}`} />
                  <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === "true-false" && (
            <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer} disabled={hasAnswered}>
              <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/50">
                <RadioGroupItem value="True" id="true" />
                <Label htmlFor="true" className="flex-1 cursor-pointer">
                  True
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/50">
                <RadioGroupItem value="False" id="false" />
                <Label htmlFor="false" className="flex-1 cursor-pointer">
                  False
                </Label>
              </div>
            </RadioGroup>
          )}

          {currentQuestion.type === "fill-in-blank" && (
            <Input
              type="text"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              disabled={hasAnswered}
              placeholder="Your answer"
            />
          )}

          {currentQuestion.type === "short-answer" && (
            <Textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              disabled={hasAnswered}
              placeholder="Your answer"
            />
          )}

          {/* Matching question UI */}
          {currentQuestion.type === "matching" && currentQuestion.matchingPairs && (
            <div className={`grid ${isMobile ? "grid-cols-1 gap-6" : "grid-cols-2 gap-4"}`}>
              <div className="space-y-2">
                <h3 className="font-medium">Terms</h3>
                {currentQuestion.matchingPairs.map((pair, index) => (
                  <div key={index} className="p-2 bg-secondary rounded-md">
                    {pair.left}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Definitions</h3>
                {currentQuestion.matchingPairs.map((pair, index) => (
                  <select
                    key={index}
                    value={matchingPairs[index]?.right || ""}
                    onChange={(e) => handleMatchingChange(index, e.target.value)}
                    disabled={hasAnswered}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  >
                    <option value="">Select a match</option>
                    {currentQuestion.matchingPairs.map((p, i) => (
                      <option key={i} value={p.right}>
                        {p.right}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}

          {/* Sequence question UI */}
          {currentQuestion.type === "sequence" && currentQuestion.sequence && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="sequence">
                {(provided) => (
                  <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {sequence.map((item, index) => (
                      <Draggable key={item} draggableId={item} index={index} isDragDisabled={hasAnswered}>
                        {(provided) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-secondary p-3 rounded-md cursor-move"
                          >
                            {item}
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Show hint if available and toggled */}
          {showHint && currentQuestion.hint && (
            <div className="p-3 rounded-md bg-muted">
              <div className="text-sm text-muted-foreground">Hint:</div>
              <div>{currentQuestion.hint}</div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex w-full sm:w-auto justify-between">
            <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <Button variant="outline" onClick={saveExamState} className="sm:hidden">
              <Save className="h-4 w-4" />
            </Button>
          </div>

          <div>
            {!hasAnswered ? (
              <Button onClick={handleSubmitAnswer} disabled={isGrading} className="w-full sm:w-auto">
                {isGrading ? "Grading..." : "Submit Answer"}
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} className="w-full sm:w-auto">
                {currentQuestionIndex < questions.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  "Finish Exam"
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Add keyboard shortcuts help */}
      <div className="text-sm text-muted-foreground mt-4">
        <p className="font-medium mb-2">Keyboard Shortcuts:</p>
        <ul className="space-y-1">
          <li><kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> - Submit answer / Next question</li>
          <li><kbd className="px-2 py-1 bg-muted rounded">H</kbd> - Toggle hint</li>
          <li><kbd className="px-2 py-1 bg-muted rounded">N</kbd> - Next question</li>
          <li><kbd className="px-2 py-1 bg-muted rounded">P</kbd> - Previous question</li>
          {currentQuestion?.type === "multiple-choice" && (
            <li><kbd className="px-2 py-1 bg-muted rounded">1-4</kbd> - Select answer</li>
          )}
          {currentQuestion?.type === "true-false" && (
            <>
              <li><kbd className="px-2 py-1 bg-muted rounded">T</kbd> - True</li>
              <li><kbd className="px-2 py-1 bg-muted rounded">F</kbd> - False</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
