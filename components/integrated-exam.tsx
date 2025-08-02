"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
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
  X,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { type Note } from "@/lib/supabase"
import { ExamQuestion } from "@/lib/exam-cache"
import { gradeAnswer } from "@/app/actions/grade-answer"
import { gradeAnswerWithGroq } from "@/lib/groq"

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

interface IntegratedExamProps {
  examData: NotesExamData | null
  onClose: () => void
  onStatsUpdate: (stats: {
    currentQuestion: number
    totalQuestions: number
    timeRemaining: number
    streakCount: number
    examScore: number
    examCompleted: boolean
  }) => void
}

export default function IntegratedExam({ examData: initialExamData, onClose, onStatsUpdate }: IntegratedExamProps) {
  const { toast } = useToast()

  // Use the prop directly, no need for an extra state layer for the exam data itself.
  const examData = initialExamData

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, any>>({})
  const [questionStates, setQuestionStates] = useState<Record<number, QuestionState>>(() => {
    if (!examData || !examData.questions || examData.questions.length === 0) {
      return {};
    }
    const firstQuestion = examData.questions[0];
    return {
      [firstQuestion.id]: {
        answer: "",
        matchingPairs: firstQuestion.type === "matching" && firstQuestion.matchingPairs ? [...firstQuestion.matchingPairs].sort(() => 0.5 - Math.random()) : [],
        sequence: firstQuestion.type === "sequence" && firstQuestion.sequence ? [...firstQuestion.sequence].sort(() => 0.5 - Math.random()) : [],
        isAnswered: false,
        isGrading: false,
        showHint: false,
        hintLevel: 0,
        showFeedback: false,
        chatMessages: [],
      },
    };
  });
  const [examCompleted, setExamCompleted] = useState(false)
  const [examScore, setExamScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true) // Keep this for initial setup

  const currentQuestion = examData?.questions[currentQuestionIndex];
  const currentQuestionState = currentQuestion ? questionStates[currentQuestion.id] : null;

  // This effect now only handles setup that runs once when the component mounts with data.
  useEffect(() => {
    if (examData) {
      setTimeRemaining(Math.round(60 * 15 * 2)) // 30 minutes default
      setIsLoading(false)
    } else {
      // This part handles the case where the component is rendered without any data.
      toast({
        title: "Failed to load exam data",
        description: "The exam data was not provided. Please try again.",
        variant: "destructive",
      })
      onClose()
    }
    // We only want this to run once on mount, or if onClose/toast changes (which they shouldn't).
  }, [examData, onClose, toast])

  const { shuffledPairs, shuffledOptions, shuffledTerms } = useMemo(() => {
    if (!currentQuestion) {
      return { shuffledPairs: [], shuffledOptions: [], shuffledTerms: [] }
    }
    const pairs = currentQuestion.matchingPairs ? [...currentQuestion.matchingPairs].sort(() => Math.random() - 0.5) : []
    const options = currentQuestion.options ? [...currentQuestion.options].sort(() => Math.random() - 0.5) : []
    const terms = currentQuestion.matchingPairs ? currentQuestion.matchingPairs.map(p => p.right).sort(() => Math.random() - 0.5) : []
    return { shuffledPairs: pairs, shuffledOptions: options, shuffledTerms: terms }
  }, [currentQuestion])

  // Loading state check
  const isLoadingState = isLoading || !examData || !currentQuestion || !currentQuestionState

  // Combined stats update effect to avoid duplicate updates
  useEffect(() => {
    if (examData) {
      onStatsUpdate({
        currentQuestion: currentQuestionIndex + 1,
        totalQuestions: examData.questions.length,
        timeRemaining,
        streakCount,
        examScore,
        examCompleted
      })
    }
  }, [currentQuestionIndex, timeRemaining, streakCount, examScore, examCompleted, examData, onStatsUpdate])

  // Timer effect
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

  // These declarations were moved to the top of the component to ensure all hooks are called before any conditional returns

  // Render loading state if needed
  if (isLoadingState) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-4xl h-[90vh] flex flex-col">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="flex-grow flex flex-col items-center justify-center">
            <Skeleton className="h-24 w-full mb-4" />
            <Skeleton className="h-12 w-3/4" />
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    )
  }

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

    if (currentQuestion.type === "matching") {
      if (!currentQuestionState.matchingPairs || currentQuestionState.matchingPairs.length === 0) {
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
        gradingResult = await gradeAnswerWithGroq(
          currentQuestion.type,
          currentQuestion.question,
          currentQuestion.correctAnswer,
          answerToSave
        )
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
        title: gradingResult.isCorrect ? "Correct! " : "Not quite right ",
        description: gradingResult.feedback,
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
      if (currentQuestion) {
        setQuestionStates(prev => ({
          ...prev,
          [currentQuestion.id]: {
            ...prev[currentQuestion.id],
            isGrading: false
          }
        }))
      }
    }
  }

  const handleNextQuestion = () => {
    if (!examData) return;

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < examData.questions.length) {
      const nextQuestion = examData.questions[nextIndex];

      // Initialize state for the next question if it doesn't exist
      setQuestionStates(prev => {
        if (prev[nextQuestion.id]) {
          return prev;
        }
        const newState: QuestionState = {
          answer: userAnswers[nextQuestion.id] || "",
          matchingPairs: nextQuestion.type === "matching" && nextQuestion.matchingPairs ? [...nextQuestion.matchingPairs].sort(() => 0.5 - Math.random()) : [],
          sequence: nextQuestion.type === "sequence" && nextQuestion.sequence
            ? [...nextQuestion.sequence].sort(() => 0.5 - Math.random())
            : [],
          isAnswered: !!results[nextQuestion.id],
          isGrading: false,
          showHint: false,
          hintLevel: 0,
          showFeedback: false,
          chatMessages: []
        };
        return {
          ...prev,
          [nextQuestion.id]: newState
        };
      });

      setCurrentQuestionIndex(nextIndex);
    } else {
      calculateFinalScore();
      setExamCompleted(true);
    }
  };

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
      <div className="space-y-6">
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
        <Button onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }

  if (!examStarted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
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

  if (examCompleted) {
    const answeredCount = Object.keys(results).length
    const correctCount = Object.values(results).filter((r) => r.isCorrect).length

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
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
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = ((currentQuestionIndex + 1) / examData.questions.length) * 100

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold truncate">Exam: {examData.examName}</h1>
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

          {currentQuestionState?.isAnswered && !results[currentQuestion.id]?.isCorrect && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Correct Answer:</span>
              </div>
              <p className="text-sm text-foreground">{currentQuestion.correctAnswer}</p>
            </div>
          )}

          {currentQuestion.type === "multiple-choice" && currentQuestion.options && (
            <RadioGroup
              value={currentQuestionState?.answer || ""}
              onValueChange={handleAnswerChange}
              disabled={currentQuestionState?.isAnswered}
              className="space-y-3"
            >
              {shuffledOptions.map((option: string, i: number) => (
                <div
                  key={i}
                  className={`flex items-center space-x-3 p-4 rounded-lg border transition-all duration-200 ${
                    currentQuestionState?.answer === option
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  } ${
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
                    className={`flex-1 cursor-pointer text-base ${
                      currentQuestionState?.isAnswered && option === currentQuestion.correctAnswer ? "text-success" : ""
                    } ${
                      currentQuestionState?.isAnswered &&
                      currentQuestionState?.answer === option &&
                      option !== currentQuestion.correctAnswer
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {option}
                  </Label>
                  {currentQuestionState?.isAnswered && option === currentQuestion.correctAnswer && (
                    <Check className="h-5 w-5 text-success" />
                  )}
                  {currentQuestionState?.isAnswered &&
                    currentQuestionState?.answer === option &&
                    option !== currentQuestion.correctAnswer && <X className="h-5 w-5 text-destructive" />}
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

          {currentQuestion.type === "matching" && currentQuestion.matchingPairs && shuffledPairs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-medium">Terms</h3>
                {shuffledPairs.map((pair: { left: string; right: string }, index: number) => (
                  <div key={`term-${index}`} className="p-2 bg-secondary rounded-md">
                    {pair.left}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Definitions</h3>
                {shuffledPairs.map((pair: { left: string; right: string }, index: number) => (
                  <select
                    key={`select-${index}`}
                    value={currentQuestionState?.matchingPairs[index]?.right || ""}
                    onChange={(e) => handleMatchingChange(index, e.target.value)}
                    disabled={currentQuestionState?.isAnswered}
                    className="w-full p-2 rounded-md border border-input bg-background"
                  >
                    <option value="">Select a match</option>
                    {shuffledTerms.map((term: string, i: number) => (
                      <option key={`option-${index}-${i}`} value={term}>
                        {term}
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