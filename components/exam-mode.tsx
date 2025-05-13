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
  X,
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
import { generateQuestionsFromCards, type ExamQuestion, type GradingResult } from "@/app/actions/generate-questions"
import { gradeAnswer } from "@/app/actions/grade-answer"
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
import { generateHint } from "@/lib/groq"
import { makeGroqRequest } from "@/lib/groq"
import type { GenerateOptions } from "@/app/actions/generate-questions"
import type { QuestionType } from "@/app/actions/generate-questions"

interface ExamModeProps {
  deckId: number
}

interface QuestionState {
  answer: string;
  matchingPairs: Array<{ left: string; right: string }>;
  sequence: string[];
  isAnswered: boolean;
  isGrading: boolean;
  showHint: boolean;
  hintLevel: number;
  showFeedback: boolean;
  chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
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
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>({})
  const [examCompleted, setExamCompleted] = useState(false)
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [examScore, setExamScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("medium")
  const [hasCachedExam, setHasCachedExam] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMobile] = useMediaQuery("(max-width: 768px)")
  const [totalQuestions, setTotalQuestions] = useState(0)

  // For matching questions
  const [matchingPairs, setMatchingPairs] = useState<Array<{ left: string; right: string }>>([])

  // For sequence questions
  const [sequence, setSequence] = useState<string[]>([])

  const confettiRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const [userPerformance, setUserPerformance] = useState<number>(0)
  const [questionTypeDistribution, setQuestionTypeDistribution] = useState<Record<string, number>>({})
  const [showFeedback, setShowFeedback] = useState(false)
  const [detailedFeedback, setDetailedFeedback] = useState<string>("")
  const [timePressure, setTimePressure] = useState<"low" | "medium" | "high">("medium")
  const [adaptiveScoring, setAdaptiveScoring] = useState(false)

  // Enhanced hint system
  const [hintLevel, setHintLevel] = useState<number>(0)
  const [hintCooldown, setHintCooldown] = useState<boolean>(false)
  const [isGeneratingHint, setIsGeneratingHint] = useState<boolean>(false)
  const [currentHint, setCurrentHint] = useState<string>("")

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())

  // Get current question and its state
  const currentQuestion = questions[currentQuestionIndex]
  const currentQuestionState = currentQuestion ? questionStates[currentQuestion.id] : null
  const currentResult = currentQuestion ? results[currentQuestion.id] : null

  // Update the useEffect for question state initialization
  useEffect(() => {
    if (!currentQuestion) return

    setQuestionStates(prev => {
      // If state already exists for this question, keep it
      if (prev[currentQuestion.id]) {
        return prev
      }

      // Initialize new state for this question
      const newState: QuestionState = {
        answer: userAnswers[currentQuestion.id] || "",
        matchingPairs: currentQuestion.type === "matching" && currentQuestion.matchingPairs 
          ? [...currentQuestion.matchingPairs].sort(() => 0.5 - Math.random())
          : [],
        sequence: currentQuestion.type === "sequence" && currentQuestion.sequence
          ? [...currentQuestion.sequence].sort(() => 0.5 - Math.random())
          : [],
        isAnswered: !!results[currentQuestion.id],
        isGrading: false,
        showHint: false,
        hintLevel: 0,
        showFeedback: false,
        chatMessages: []
      }

      return {
        ...prev,
        [currentQuestion.id]: newState
      }
    })
  }, [currentQuestion, userAnswers, results])

  // Remove any remaining references to old state management
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  // Update the saveExamProgress function
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
        startedAt: new Date().toISOString()
      })

      setIsSaving(false)
      setTimeout(() => {
        toast({
          title: "Progress saved",
          description: "Your exam progress has been saved automatically."
        })
      }, 0)
    } catch (error) {
      console.error("Error saving exam progress:", error)
      setIsSaving(false)
    }
  }

  // Handle answer input changes
  const handleAnswerChange = (value: string) => {
    if (!currentQuestion || currentQuestionState?.isAnswered) return

    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        answer: value
      }
    }))
  }

  // Handle matching pairs changes
  const handleMatchingChange = (leftIndex: number, rightValue: string) => {
    if (!currentQuestion || currentQuestionState?.isAnswered) return

    const updatedPairs = [...(currentQuestionState?.matchingPairs || [])]
    updatedPairs[leftIndex] = { ...updatedPairs[leftIndex], right: rightValue }

    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        matchingPairs: updatedPairs
      }
    }))
  }

  // Handle sequence changes
  const handleDragEnd = (result: any) => {
    if (!currentQuestion || currentQuestionState?.isAnswered || !result.destination) return

    const items = Array.from(currentQuestionState?.sequence || [])
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        sequence: items
      }
    }))
  }

  // Enhanced answer submission
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !currentQuestionState) return

    // Validate answer based on question type
    if (currentQuestion.type === "matching") {
      if (currentQuestionState.matchingPairs.length === 0) {
        toast({
          title: "Answer required",
          description: "Please match all pairs before submitting.",
          variant: "destructive"
        })
        return
      }
    } else if (currentQuestion.type === "sequence") {
      if (currentQuestionState.sequence.length === 0) {
        toast({
          title: "Answer required",
          description: "Please arrange the sequence before submitting.",
          variant: "destructive"
        })
        return
      }
    } else if (!currentQuestionState.answer.trim()) {
      toast({
        title: "Answer required",
        description: "Please provide an answer before submitting.",
        variant: "destructive"
      })
      return
    }

    // Save the user's answer
    const answerToSave = currentQuestion.type === "matching"
      ? JSON.stringify(currentQuestionState.matchingPairs)
      : currentQuestion.type === "sequence"
        ? JSON.stringify(currentQuestionState.sequence)
        : currentQuestionState.answer

    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isGrading: true
      }
    }))

    try {
      const gradingResult = await gradeAnswer(
        currentQuestion.type,
        currentQuestion.question,
        currentQuestion.type === "matching"
          ? JSON.stringify(currentQuestion.matchingPairs)
          : currentQuestion.type === "sequence"
            ? JSON.stringify(currentQuestion.sequence)
            : currentQuestion.correctAnswer,
        answerToSave,
        {
          adaptiveScoring,
          timePressure,
          previousAnswers: Object.values(results),
          questionType: currentQuestion.type
        }
      )

      // Update user answers and results
      setUserAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answerToSave
      }))

      setResults(prev => ({
        ...prev,
        [currentQuestion.id]: gradingResult
      }))

      // Update question state
      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          isAnswered: true,
          isGrading: false,
          showFeedback: true
        }
      }))

      // Update streak count
      if (gradingResult.isCorrect) {
        setStreakCount(prev => prev + 1)
      } else {
        setStreakCount(0)
      }

      toast({
        title: gradingResult.isCorrect ? "Correct! 🎉" : "Not quite right 🤔",
        description: gradingResult.feedback,
        variant: gradingResult.isCorrect ? "default" : "destructive"
      })
    } catch (error) {
      console.error("Error grading answer:", error)
      toast({
        title: "Error",
        description: "Failed to grade your answer. Please try again.",
        variant: "destructive"
      })
    } finally {
      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          isGrading: false
        }
      }))
    }
  }

  // Enhanced next question logic
  const handleNextQuestion = async () => {
    if (!currentQuestion) return

    if (currentQuestionIndex < totalQuestions - 1) {
      const nextIndex = currentQuestionIndex + 1

      // Generate next question if it doesn't exist
      if (!questions[nextIndex]) {
        const settings = getDifficultySettings(difficulty, userPerformance)
        const availableTypes = settings.questionTypes

        // Balance question types based on distribution
        const typeCounts = Object.entries(questionTypeDistribution)
        const leastUsedType =
          typeCounts.length > 0
            ? typeCounts.sort((a, b) => a[1] - b[1])[0][0]
            : availableTypes[Math.floor(Math.random() * availableTypes.length)]

        await generateQuestion(nextIndex, leastUsedType as QuestionType)
      }

      // Update current question index
      setCurrentQuestionIndex(nextIndex)

      // Save progress every 5 questions
      if (nextIndex % 5 === 0) {
        setTimeout(() => saveExamProgress(), 500)
      }
    } else {
      calculateFinalScore()
      setExamCompleted(true)
      // Clear cached exam data when completed
      clearCachedExamData(deckId)
    }
  }

  // Generate a single question
  const generateQuestion = async (index: number, type: QuestionType) => {
    if (!deck) return null

    setIsGeneratingQuestion(true)
    try {
      const settings = getDifficultySettings(difficulty, userPerformance)
      const generatedQuestions = await generateQuestionsFromCards(
        deck.cards,
        1, // Generate only one question
        {
          type,
          difficulty,
          previousQuestions: questions
        }
      )

      if (generatedQuestions.length > 0) {
        const question = generatedQuestions[0]
        setQuestions((prev) => {
          const newQuestions = [...prev]
          newQuestions[index] = question
          return newQuestions
        })
        return question
      }
      return null
    } catch (error) {
      console.error("Error generating question:", error)
      setTimeout(() => {
        toast({
          title: "Error",
          description: "Failed to generate question. Please try again.",
          variant: "destructive",
        })
      }, 0)
      return null
    } finally {
      setIsGeneratingQuestion(false)
    }
  }

  // Initialize exam
  const initializeExam = async (selectedDifficulty: ExamDifficulty = difficulty) => {
    if (!deck) return

    setIsGeneratingQuestion(true)
    try {
      // Clear any existing cached exam
      clearCachedExamData(deckId)

      // Get difficulty settings
      const settings = getDifficultySettings(selectedDifficulty)
      setTotalQuestions(Math.min(settings.questionCount, deck.cards.length))

      // Reset all state
      setQuestions([])
      setUserAnswers({})
      setResults({})
      setQuestionStates({})
      setCurrentQuestionIndex(0)
      setExamCompleted(false)
      setTimeRemaining(Math.round(60 * 15 * settings.timeMultiplier))
      setStreakCount(0)
      setDifficulty(selectedDifficulty)
      setHasCachedExam(false)

      // Generate first question
      const firstQuestion = await generateQuestion(
        0,
        settings.questionTypes[Math.floor(Math.random() * settings.questionTypes.length)] as QuestionType
      )
      if (!firstQuestion) {
        throw new Error("Failed to generate first question")
      }

      // Save initial exam state to cache
      saveExamDataToCache(deckId, {
        deckId,
        questions: [firstQuestion],
        userAnswers: {},
        results: {},
        currentQuestionIndex: 0,
        timeRemaining: Math.round(60 * 15 * settings.timeMultiplier),
        streakCount: 0,
        difficulty: selectedDifficulty,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })
    } catch (error) {
      console.error("Error initializing exam:", error)
      setTimeout(() => {
        toast({
          title: "Error",
          description: "Failed to initialize exam. Please try again.",
          variant: "destructive"
        })
      }, 0)
    } finally {
      setIsGeneratingQuestion(false)
    }
  }

  // Check for cached exam data when component mounts
  useEffect(() => {
    const initializeExamState = async () => {
      if (deck && !loading) {
        const cachedData = getCachedExamData(deckId)
        if (cachedData) {
          setHasCachedExam(true)
          setShowResumeDialog(true)
        } else {
          await initializeExam()
        }
      }
    }

    initializeExamState()
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
            // Move toast to effect
            setTimeout(() => {
              toast({
                title: "Time's up!",
                description: "Your exam has been automatically submitted.",
                variant: "destructive",
              })
            }, 0)
            calculateFinalScore()
            setExamCompleted(true)
          }
          return 0
        }

        // Save progress every 5 minutes instead of every minute
        if (prev % 300 === 0) {
          saveExamProgress()
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examStarted, examCompleted])

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
    setIsGeneratingQuestion(false)
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
        setQuestionStates(prev => ({
          ...prev,
          [currentQuestion.id]: {
            ...prev[currentQuestion.id],
            answer: savedAnswer
          }
        }))
      }
    }

    // Move toast to effect
    setTimeout(() => {
      toast({
        title: "Exam resumed",
        description: "Your previous exam progress has been loaded.",
      })
    }, 0)
  }

  // Discard cached exam
  const discardCachedExam = () => {
    clearCachedExamData(deckId)
    setHasCachedExam(false)
    setShowResumeDialog(false)
    initializeExam()
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
      lastUpdated: new Date().toISOString()
    })

    toast({
      title: "Progress saved",
      description: "Your exam progress has been saved. You can continue later.",
    })
  }

  // Calculate user performance based on recent answers
  const calculateUserPerformance = () => {
    const recentAnswers = Object.values(results).slice(-5)
    if (recentAnswers.length === 0) return 0

    const correctAnswers = recentAnswers.filter((r) => r.isCorrect).length
    return (correctAnswers / recentAnswers.length) * 100
  }

  // Update difficulty settings based on performance
  useEffect(() => {
    if (difficulty === "adaptive") {
      const performance = calculateUserPerformance()
      setUserPerformance(performance)
      const settings = getDifficultySettings(difficulty, performance)
      setTimePressure(settings.timePressure)
      setAdaptiveScoring(settings.adaptiveScoring)
    }
  }, [results, difficulty])

  // Enhanced feedback system
  const getDetailedFeedback = (result: GradingResult) => {
    if (!result.isCorrect) {
      const feedback = []

      if (result.explanation) {
        feedback.push(result.explanation)
      }

      if (result.suggestions) {
        feedback.push("\nSuggestions for improvement:")
        feedback.push(result.suggestions)
      }

      if (result.relatedConcepts) {
        feedback.push("\nRelated concepts to review:")
        feedback.push(result.relatedConcepts.join(", "))
      }

      return feedback.join("\n")
    }

    return result.feedback
  }

  // Reset state when moving to a new question
  useEffect(() => {
    if (!currentQuestion) return

    // Reset all answer-related state
    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        answer: "",
        matchingPairs: [],
        sequence: [],
        isAnswered: false,
        isGrading: false,
        showHint: false,
        hintLevel: 0,
        showFeedback: false
      }
    }))
  }, [currentQuestionIndex, currentQuestion])

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
    setQuestionStates({})
    setStreakCount(0)

    // Generate new questions
    initializeExam()
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

  // Update the keyboard shortcuts handler to use questionStates
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case "enter":
          if (currentQuestionIndex < totalQuestions - 1) {
            handleNextQuestion()
          } else {
            calculateFinalScore()
            setExamCompleted(true)
          }
          break
        case "h":
          if (currentQuestionState?.showHint) {
            setQuestionStates(prev => ({
              ...prev,
              [currentQuestion.id]: {
                ...prev[currentQuestion.id],
                showHint: false
              }
            }))
          } else if (difficulty !== "hard") {
            setQuestionStates(prev => ({
              ...prev,
              [currentQuestion.id]: {
                ...prev[currentQuestion.id],
                showHint: true
              }
            }))
          }
          break
        case " ":
          if (currentQuestionIndex < totalQuestions - 1) {
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
            const index = Number.parseInt(e.key) - 1
            if (index >= 0 && index < currentQuestion.options.length) {
              setQuestionStates(prev => ({
                ...prev,
                [currentQuestion.id]: {
                  ...prev[currentQuestion.id],
                  answer: currentQuestion.options[index]
                }
              }))
            }
          }
          break
        case "t":
          if (currentQuestion?.type === "true-false") {
            setQuestionStates(prev => ({
              ...prev,
              [currentQuestion.id]: {
                ...prev[currentQuestion.id],
                answer: "True"
              }
            }))
          }
          break
        case "f":
          if (currentQuestion?.type === "true-false") {
            setQuestionStates(prev => ({
              ...prev,
              [currentQuestion.id]: {
                ...prev[currentQuestion.id],
                answer: "False"
              }
            }))
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentQuestionIndex, questions, currentQuestionState?.showHint, difficulty, totalQuestions])

  // Update the loadCachedExam function to use questionStates
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
    setTotalQuestions(cachedData.questions.length)

    // Initialize question states from cached data
    const initialQuestionStates: Record<number, QuestionState> = {}
    cachedData.questions.forEach(question => {
      initialQuestionStates[question.id] = {
        answer: cachedData.userAnswers[question.id] || "",
        matchingPairs: question.type === "matching" && question.matchingPairs
          ? [...question.matchingPairs].sort(() => 0.5 - Math.random())
          : [],
        sequence: question.type === "sequence" && question.sequence
          ? [...question.sequence].sort(() => 0.5 - Math.random())
          : [],
        isAnswered: !!cachedData.results[question.id],
        isGrading: false,
        showHint: false,
        hintLevel: 0,
        showFeedback: false,
        chatMessages: []
      }
    })
    setQuestionStates(initialQuestionStates)

    setHasCachedExam(false)
    setExamStarted(true)
  }

  // Add new function to handle chat messages
  const handleChatMessage = async (message: string) => {
    if (!currentQuestion || !currentQuestionState) return

    // Add user message to chat
    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        chatMessages: [
          ...prev[currentQuestion.id].chatMessages,
          { role: "user", content: message }
        ]
      }
    }))

    // Generate AI response
    try {
      const prompt = `You are a helpful tutor helping a student with an exam question. The question is:

Question: ${currentQuestion.question}
Type: ${currentQuestion.type}
Correct Answer: ${currentQuestion.correctAnswer}

Previous chat context:
${currentQuestionState.chatMessages.map(msg => `${msg.role}: ${msg.content}`).join("\n")}

Student's latest message: ${message}

Provide a helpful response that:
1. Guides the student without giving away the answer
2. Helps them think through the problem
3. Provides relevant hints based on the question type
4. Maintains a supportive and encouraging tone
5. Suggests specific approaches or strategies

Keep your response concise and focused.`

      const response = await makeGroqRequest(prompt, true)
      
      // Add AI response to chat
      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          chatMessages: [
            ...prev[currentQuestion.id].chatMessages,
            { role: "assistant", content: response }
          ]
        }
      }))
    } catch (error) {
      console.error("Error generating chat response:", error)
      // Add error message to chat
      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          chatMessages: [
            ...prev[currentQuestion.id].chatMessages,
            { role: "assistant", content: "I apologize, but I'm having trouble generating a response right now. Please try asking your question again." }
          ]
        }
      }))
    }
  }

  if (loading || isGeneratingQuestion) {
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
        <Button onClick={() => initializeExam()}>Try Again</Button>
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
                  This exam contains dynamic questions generated on the fly to test your understanding.
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
                  initializeExam(selectedDifficulty)
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
                  <p>Tip: Questions are generated dynamically as you progress through the exam.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100

  // Format time remaining
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

  // Get difficulty settings
  const diffSettings = getDifficultySettings(difficulty)

  // Enhanced exam completion screen
  if (examCompleted) {
    const answeredCount = Object.keys(results).length
    const correctCount = Object.values(results).filter((r) => r.isCorrect).length
    const settings = getDifficultySettings(difficulty, userPerformance)
    const isPassing = examScore >= settings.passingScore

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
              <p className="text-xs text-muted-foreground mt-1">Passing score: {settings.passingScore}%</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((question, index) => {
              const result = results[question.id]
              if (!result) return null

              // Use different border styles based on correctness
              const borderStyle = result.isCorrect ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive"
              const bgStyle = result.isCorrect ? "bg-success/5" : "bg-destructive/5"

              return (
                <Card key={question.id} className={`${borderStyle} ${bgStyle} rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 ease-in-out transform hover:-translate-y-1 border border-border/50`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {result.isCorrect ? (
                        <Check className="h-5 w-5 text-success" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      Question {index + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Question:</div>
                      <div className="text-sm">{question.question}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Your answer:</div>
                      <div className="text-sm">{userAnswers[question.id]}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Correct answer:</div>
                      <div className="text-sm">{question.correctAnswer}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Feedback:</div>
                      <div className="text-sm">{result.explanation}</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exam Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-bold">{examScore}%</p>
              </div>
              <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className={`text-2xl font-bold ${isPassing ? "text-success" : "text-destructive"}`}>
                  {isPassing ? "Passed" : "Failed"}
                </p>
              </div>
              <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Questions</p>
                <p className="text-2xl font-bold">{totalQuestions}</p>
              </div>
              <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Correct</p>
                <p className="text-2xl font-bold">{correctCount}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Question Type Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(questionTypeDistribution).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                    <span className="capitalize text-sm">{type.replace(/-/g, " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Performance Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-xl font-bold">{Math.round((correctCount / answeredCount) * 100)}%</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Best Streak</p>
                  <p className="text-xl font-bold">{Math.max(0, streakCount)}</p>
                </div>
                {difficulty === "adaptive" && (
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Final Difficulty</p>
                    <p className="text-xl font-bold capitalize">{timePressure}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-2">
              <Button onClick={restartExam} className="flex-1">
                Take Another Exam
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href={`/deck/${deckId}`}>Back to Deck</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
            {currentQuestionIndex + 1}/{totalQuestions}
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
            {!currentQuestionState?.isAnswered && diffSettings.hintAllowed && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestionStates(prev => ({
                    ...prev,
                    [currentQuestion.id]: {
                      ...prev[currentQuestion.id],
                      showHint: true
                    }
                  }))}
                  disabled={currentQuestionState?.isGrading}
                  className="relative"
                >
                  Show Hint
                </Button>
              </div>
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
            <RadioGroup
              value={currentQuestionState?.answer || ""}
              onValueChange={handleAnswerChange}
              disabled={currentQuestionState?.isAnswered}
              className="space-y-3"
            >
              {currentQuestion.options?.map((option: string, i: number) => (
                <div
                  key={i}
                  className={`flex items-center space-x-3 p-4 rounded-lg border transition-all duration-200
                    ${
                      currentQuestionState?.answer === option
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }
                    ${
                      currentQuestionState?.isAnswered
                        ? option === currentQuestion.correctAnswer
                          ? "border-success bg-success/5"
                          : currentQuestionState?.answer === option
                            ? "border-destructive bg-destructive/5"
                            : ""
                        : "cursor-pointer"
                    }`}
                  onClick={() => !currentQuestionState?.isAnswered && handleAnswerChange(option)}
                >
                  <RadioGroupItem value={option} id={`option-${i}`} className="h-5 w-5" />
                  <Label
                    htmlFor={`option-${i}`}
                    className={`flex-1 cursor-pointer text-base
                      ${currentQuestionState?.isAnswered && option === currentQuestion.correctAnswer ? "text-success" : ""}
                      ${currentQuestionState?.isAnswered && currentQuestionState?.answer === option && option !== currentQuestion.correctAnswer ? "text-destructive" : ""}
                    `}
                  >
                    {option}
                  </Label>
                  {currentQuestionState?.isAnswered && option === currentQuestion.correctAnswer && (
                    <Check className="h-5 w-5 text-success" />
                  )}
                  {currentQuestionState?.isAnswered && currentQuestionState?.answer === option && option !== currentQuestion.correctAnswer && (
                    <X className="h-5 w-5 text-destructive" />
                  )}
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === "true-false" && (
            <RadioGroup
              value={currentQuestionState?.answer || ""}
              onValueChange={handleAnswerChange}
              disabled={currentQuestionState?.isAnswered}
              className="space-y-2"
            >
              <div
                className="flex items-center space-x-2 p-3 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => !currentQuestionState?.isAnswered && handleAnswerChange("True")}
              >
                <RadioGroupItem value="True" id="true" />
                <Label htmlFor="true" className="flex-1 cursor-pointer">
                  True
                </Label>
              </div>
              <div
                className="flex items-center space-x-2 p-3 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => !currentQuestionState?.isAnswered && handleAnswerChange("False")}
              >
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
              value={currentQuestionState?.answer || ""}
              onChange={(e) => {
                if (!currentQuestionState?.isAnswered) {
                  handleAnswerChange(e.target.value)
                }
              }}
              disabled={currentQuestionState?.isAnswered}
              placeholder="Your answer"
            />
          )}

          {currentQuestion.type === "short-answer" && (
            <Textarea
              value={currentQuestionState?.answer || ""}
              onChange={(e) => {
                if (!currentQuestionState?.isAnswered) {
                  handleAnswerChange(e.target.value)
                }
              }}
              disabled={currentQuestionState?.isAnswered}
              placeholder="Your answer"
            />
          )}

          {/* Matching question UI */}
          {currentQuestion.type === "matching" && currentQuestion.matchingPairs && (
            <div className={`grid ${isMobile ? "grid-cols-1 gap-6" : "grid-cols-2 gap-4"}`}>
              <div className="space-y-2">
                <h3 className="font-medium">Terms</h3>
                {currentQuestion.matchingPairs.map((pair: { left: string; right: string }, index: number) => (
                  <div key={`term-${index}`} className="p-2 bg-secondary rounded-md">
                    {pair.left}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Definitions</h3>
                {currentQuestion.matchingPairs.map((pair: { left: string; right: string }, index: number) => (
                  <select
                    key={`select-${index}`}
                    value={currentQuestionState?.matchingPairs[index]?.right || ""}
                    onChange={(e) => handleMatchingChange(index, e.target.value)}
                    disabled={currentQuestionState?.isAnswered}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  >
                    <option value="">Select a match</option>
                    {currentQuestion.matchingPairs.map((p: { left: string; right: string }, i: number) => (
                      <option key={`option-${index}-${i}`} value={p.right}>
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
                    {currentQuestionState?.sequence.map((item, index) => (
                      <Draggable key={item} draggableId={item} index={index} isDragDisabled={currentQuestionState?.isAnswered}>
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

          {/* Enhanced hint display */}
          {currentQuestionState?.showHint && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">AI Tutor Chat</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuestionStates(prev => ({
                    ...prev,
                    [currentQuestion.id]: {
                      ...prev[currentQuestion.id],
                      showHint: false
                    }
                  }))}
                  className="h-6 px-2"
                >
                  Close
                </Button>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {currentQuestionState.chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask for help..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      handleChatMessage(e.currentTarget.value.trim())
                      e.currentTarget.value = ""
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                    if (input.value.trim()) {
                      handleChatMessage(input.value.trim())
                      input.value = ""
                    }
                  }}
                >
                  Send
                </Button>
              </div>
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
            {!currentQuestionState?.isAnswered ? (
              <Button onClick={handleSubmitAnswer} disabled={currentQuestionState?.isGrading} className="w-full sm:w-auto">
                {currentQuestionState?.isGrading ? "Grading..." : "Submit Answer"}
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} className="w-full sm:w-auto">
                {currentQuestionIndex < totalQuestions - 1 ? (
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
          <li>
            <kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> - Submit answer / Next question
          </li>
          <li>
            <kbd className="px-2 py-1 bg-muted rounded">H</kbd> - Toggle hint
          </li>
          <li>
            <kbd className="px-2 py-1 bg-muted rounded">N</kbd> - Next question
          </li>
          <li>
            <kbd className="px-2 py-1 bg-muted rounded">P</kbd> - Previous question
          </li>
          {currentQuestion?.type === "multiple-choice" && (
            <li>
              <kbd className="px-2 py-1 bg-muted rounded">1-4</kbd> - Select answer
            </li>
          )}
          {currentQuestion?.type === "true-false" && (
            <>
              <li>
                <kbd className="px-2 py-1 bg-muted rounded">T</kbd> - True
              </li>
              <li>
                <kbd className="px-2 py-1 bg-muted rounded">F</kbd> - False
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
