"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DifficultySelector } from "@/components/difficulty-selector"
import { generateQuestionsFromNotes, type QuestionType } from "@/app/actions/generate-questions-from-notes"
import { ExamQuestion } from "@/lib/exam-cache"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Brain, Sparkles, BookOpen, Clock, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface CreateExamFromNotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notesContent: string
  noteTitle?: string
}

interface ExamPreview {
  questions: ExamQuestion[]
  difficulty: string
  questionCount: number
  estimatedTime: number
}

export function CreateExamFromNotesDialog({
  open,
  onOpenChange,
  notesContent,
  noteTitle
}: CreateExamFromNotesDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  
  const [examName, setExamName] = useState(noteTitle ? `Exam: ${noteTitle}` : "")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "adaptive">("medium")
  const [questionCount, setQuestionCount] = useState(10)
  const [isGenerating, setIsGenerating] = useState(false)
  const [examPreview, setExamPreview] = useState<ExamPreview | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleGeneratePreview = async () => {
    if (!notesContent.trim()) {
      toast({
        title: "No content",
        description: "Please provide notes content to generate an exam.",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const questions = await generateQuestionsFromNotes(
        notesContent,
        Math.min(questionCount, 5), // Generate fewer questions for preview
        { difficulty }
      )

      const estimatedTime = Math.ceil(questionCount * 2) // 2 minutes per question

      setExamPreview({
        questions,
        difficulty,
        questionCount,
        estimatedTime
      })
      setShowPreview(true)
    } catch (error) {
      console.error("Error generating exam preview:", error)
      toast({
        title: "Error",
        description: "Failed to generate exam preview. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateExam = async () => {
    if (!examName.trim()) {
      toast({
        title: "Exam name required",
        description: "Please provide a name for your exam.",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const questions = await generateQuestionsFromNotes(
        notesContent,
        questionCount,
        { difficulty }
      )

      // Store the exam data in localStorage for the exam mode to use
      const examData = {
        examName,
        questions,
        difficulty,
        questionCount,
        source: "notes",
        notesContent: notesContent.substring(0, 200) + "...", // Store truncated content
        createdAt: new Date().toISOString()
      }

      localStorage.setItem("notes_exam_data", JSON.stringify(examData))

      toast({
        title: "Exam created!",
        description: "Your exam has been generated successfully.",
      })

      // Close dialog and navigate to exam
      onOpenChange(false)
      router.push("/exam-from-notes")
    } catch (error) {
      console.error("Error creating exam:", error)
      toast({
        title: "Error",
        description: "Failed to create exam. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getDifficultyDescription = (diff: string) => {
    switch (diff) {
      case "easy":
        return "Basic understanding questions"
      case "medium":
        return "Comprehension and application questions"
      case "hard":
        return "Deep analysis and critical thinking"
      case "adaptive":
        return "Difficulty adjusts based on performance"
      default:
        return ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Create Exam from Notes
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive exam based on your notes content. The AI will create questions that test understanding of the material.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Exam Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="exam-name">Exam Name</Label>
              <Input
                id="exam-name"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Enter exam name..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Difficulty Level</Label>
              <DifficultySelector
                onSelect={setDifficulty}
                defaultDifficulty={difficulty}
              />
            </div>

            <div>
              <Label htmlFor="question-count">Number of Questions</Label>
              <Select value={questionCount.toString()} onValueChange={(value) => setQuestionCount(parseInt(value))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 questions</SelectItem>
                  <SelectItem value="10">10 questions</SelectItem>
                  <SelectItem value="15">15 questions</SelectItem>
                  <SelectItem value="20">20 questions</SelectItem>
                  <SelectItem value="25">25 questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content Preview */}
          <div>
            <Label>Notes Content Preview</Label>
            <div className="mt-2 p-3 bg-muted rounded-md max-h-32 overflow-y-auto text-sm">
              {notesContent.length > 300 
                ? `${notesContent.substring(0, 300)}...`
                : notesContent
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {notesContent.length} characters • {notesContent.split('\n').length} lines
            </p>
          </div>

          {/* Preview Section */}
          {showPreview && examPreview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <Label className="text-sm font-medium">Exam Preview</Label>
              </div>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{examName || "Untitled Exam"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{examPreview.questionCount} Questions</p>
                        <p className="text-xs text-muted-foreground">{getDifficultyDescription(examPreview.difficulty)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">~{examPreview.estimatedTime} minutes</p>
                        <p className="text-xs text-muted-foreground">Estimated time</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Sample Questions</Label>
                    {examPreview.questions.slice(0, 3).map((question, index) => (
                      <div key={question.id} className="p-3 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            {question.type.replace('-', ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">Question {index + 1}</span>
                        </div>
                        <p className="text-sm">{question.question}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Progress for generation */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Generating exam questions...</span>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleGeneratePreview}
            disabled={isGenerating || !notesContent.trim()}
            className="sm:order-1"
          >
            <Target className="h-4 w-4 mr-2" />
            Preview Exam
          </Button>
          
          <Button
            onClick={handleCreateExam}
            disabled={isGenerating || !notesContent.trim() || !examName.trim()}
            className="sm:order-2"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isGenerating ? "Creating..." : "Create Exam"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 