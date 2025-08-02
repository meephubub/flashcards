"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd"
import confetti from "canvas-confetti"
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
  X,
} from "lucide-react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { ExamQuestion } from "@/lib/exam-cache"
import { gradeAnswer } from "@/app/actions/grade-answer"
import { gradeAnswerWithGroq } from "@/lib/groq"
import { getSentenceEmbedding, cosineSimilarity } from "@/app/actions/xenova-similarity"

interface NotesExamData {
  examName: string
  questions: ExamQuestion[]
  difficulty: string
  questionCount: number
  source: "notes"
  notesContent: string
  createdAt: string
}

interface QuestionState {
  answer: string
  matchingPairs: Array<{ left: string; right: string }>
  sequence: string[]
  isAnswered: boolean
  isGrading: boolean
  showHint: boolean
  hintLevel: number
  showFeedback: boolean
  chatMessages: Array<{ role: "user" | "assistant"; content: string }>
}

export default function ExamFromNotesPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [examData, setExamData] = useState<NotesExamData | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, any>>({})
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>({})
  const [examCompleted, setExamCompleted] = useState(false)
  const [examScore, setExamScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Load exam data from localStorage
  useEffect(() => {
    const storedData = localStorage.getItem("notes_exam_data")
    if (storedData) {
      try {
        const data = JSON.parse(storedData) as NotesExamData
        setExamData(data)
        setTimeRemaining(Math.round(60 * 15 * 2)) // 30 minutes default
        setIsLoading(false)
      } catch (error) {
        console.error("Error parsing exam data:", error)
        toast({
          title: "Error",
          description: "Failed to load exam data. Please create a new exam.",
          variant: "destructive"
        })
        router.push("/notes")
      }
    } else {
      toast({
        title: "No exam data",
        description: "No exam data found. Please create an exam from your notes.",
        variant: "destructive"
      })
      router.push("/notes")
    }
  }, [router, toast])

  const currentQuestion = examData?.questions[currentQuestionIndex]
  const currentQuestionState = currentQuestion ? questionStates[currentQuestion.id] : null

  // Initialize question state
  useEffect(() => {
    if (!currentQuestion) return

    setQuestionStates(prev => {
      if (prev[currentQuestion.id]) {
        return prev
      }

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

  // Timer
  useEffect(() => {
    if (!examStarted || examCompleted) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          if (!examCompleted) {
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
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examStarted, examCompleted, toast])

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

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !currentQuestionState) return

    // Validate answer
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
      let gradingResult
      if (currentQuestion.type === "short-answer") {
        try {
          const userEmbedding = await getSentenceEmbedding(answerToSave)
          const correctEmbedding = await getSentenceEmbedding(currentQuestion.correctAnswer)
          const similarity = cosineSimilarity(userEmbedding, correctEmbedding)
          
          if (similarity > 0.5) {
            gradingResult = {
              isCorrect: true,
              score: 100,
              feedback: `Accepted by semantic similarity (score: ${similarity.toFixed(4)})`,
            }
          } else {
            gradingResult = await gradeAnswerWithGroq(
              currentQuestion.type,
              currentQuestion.question,
              currentQuestion.correctAnswer,
              answerToSave
            )
            gradingResult = {
              ...gradingResult,
              isCorrect: gradingResult.isCorrect ?? false,
              feedback: (gradingResult.feedback || "") + ` (Semantic similarity: ${similarity.toFixed(4)})`,
            }
          }
        } catch (simErr: any) {
          const errorMsg = simErr?.message || String(simErr)
          if (
            errorMsg.includes("Something went wrong installing the \"sharp\" module") ||
            errorMsg.includes("Cannot find module '../build/Release/sharp-win32-x64.node'")
          ) {
            // Silently ignore this known error
          } else {
            console.error("[Xenova] Similarity error:", simErr)
          }
          gradingResult = await gradeAnswer(
            currentQuestion.type,
            currentQuestion.question,
            currentQuestion.correctAnswer,
            answerToSave
          )
        }
      } else {
        gradingResult = await gradeAnswer(
          currentQuestion.type,
          currentQuestion.question,
          currentQuestion.correctAnswer,
          answerToSave
        )
      }

      setUserAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answerToSave
      }))

      setResults(prev => ({
        ...prev,
        [currentQuestion.id]: gradingResult
      }))

      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          isAnswered: true,
          isGrading: false,
          showFeedback: true
        }
      }))

      if (gradingResult.isCorrect) {
        setStreakCount(prev => prev + 1)
      } else {
        setStreakCount(0)
      }

      toast({
        title: gradingResult.isCorrect ? "Correct! 🎉" : "Not quite right 🤔",
        description: `${gradingResult.feedback}\n\nCorrect answer: ${currentQuestion.correctAnswer}`,
        variant: gradingResult.isCorrect ? "default" : "destructive",
        duration: 1200
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

  const handleNextQuestion = () => {
    if (!examData) return

    if (currentQuestionIndex < examData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      calculateFinalScore()
      setExamCompleted(true)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const calculateFinalScore = () => {
    if (!examData) return 0

    let totalScore = 0
    let answeredQuestions = 0

    for (const question of examData.questions) {
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
    setExamStarted(false)
    setExamCompleted(false)
    setCurrentQuestionIndex(0)
    setUserAnswers({})
    setResults({})
    setQuestionStates({})
    setStreakCount(0)
    setTimeRemaining(Math.round(60 * 15 * 2))
  }

  if (isLoading) {
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
        </Card>
      </div>
    )
  }

  if (!examData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No exam data</h2>
        <p className="text-gray-500 mb-6">No exam data found. Please create an exam from your notes.</p>
        <Button asChild>
          <Link href="/notes">Back to Notes</Link>
        </Button>
      </div>
    )
  }

  // Show exam start screen
  if (!examStarted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Exam: {examData.examName}</h1>
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
                  This exam contains {examData.questionCount} questions generated from your notes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Questions</p>
                <p className="text-2xl font-bold">{examData.questionCount}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Difficulty</p>
                <p className="text-2xl font-bold capitalize">{examData.difficulty}</p>
              </div>
            </div>

            <div className="flex flex-col items-center pt-4">
              <Button onClick={() => setExamStarted(true)} size="lg" className="px-8">
                <Sparkles className="mr-2 h-4 w-4" />
                Start Exam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show exam completion screen
  if (examCompleted) {
    const answeredCount = Object.keys(results).length
    const correctCount = Object.values(results).filter((r) => r.isCorrect).length

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Exam Results: {examData.examName}</h1>
        </div>

        <Card className="text-center py-8">
          <CardContent className="space-y-6">
            <div className="mx-auto w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
              <Trophy className="h-12 w-12" />
            </div>

            <div>
              <h2 className="text-3xl font-bold">{examScore}%</h2>
              <p className="text-muted-foreground mt-1">Your final score</p>
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
                <Link href="/notes">Back to Notes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = ((currentQuestionIndex + 1) / examData.questions.length) * 100
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/notes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold truncate">Exam: {examData.examName}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
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
            {currentQuestionIndex + 1}/{examData.questions.length}
          </div>
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
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-lg font-medium">{currentQuestion.question}</div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex w-full sm:w-auto justify-between">
            <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          </div>

          <div>
            {!currentQuestionState?.isAnswered ? (
              <Button onClick={handleSubmitAnswer} disabled={currentQuestionState?.isGrading} className="w-full sm:w-auto">
                {currentQuestionState?.isGrading ? "Grading..." : "Submit Answer"}
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} className="w-full sm:w-auto">
                {currentQuestionIndex < examData.questions.length - 1 ? (
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
    </div>
  )
} 