"use server"

import { revalidatePath } from "next/cache"
import type { ExamDifficulty } from "@/lib/exam-cache"
import { makeGroqRequest } from "@/lib/groq"
import { ExamQuestion } from "@/lib/exam-cache"

export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-answer"
  | "matching"
  | "sequence"
  | "analogy"
  | "critical-thinking"
  | "application"
  | "scenario"
  | "compare-contrast"
  | "cause-effect"

export interface GenerateOptions {
  type?: QuestionType
  difficulty?: ExamDifficulty
  previousQuestions?: ExamQuestion[]
}

export async function generateQuestionsFromNotes(
  notesContent: string,
  count: number,
  options?: GenerateOptions
): Promise<ExamQuestion[]> {
  if (!notesContent.trim()) {
    throw new Error("Notes content is required to generate questions")
  }

  const questions: ExamQuestion[] = []

  // Determine question types based on difficulty and previous questions
  const getQuestionTypes = (): QuestionType[] => {
    if (options?.type) {
      return [options.type]
    }

    const types: QuestionType[] = ["multiple-choice", "true-false", "short-answer"]
    
    if (options?.difficulty === "medium" || options?.difficulty === "hard") {
      types.push("short-answer", "matching")
    }
    
    if (options?.difficulty === "hard") {
      types.push("sequence", "analogy")
    }

    // Avoid repeating the same question type too often
    if (options?.previousQuestions) {
      const recentTypes = options.previousQuestions.slice(-3).map(q => q.type)
      return types.filter(type => !recentTypes.includes(type))
    }

    return types
  }

  // Generate the requested number of questions using Groq
  for (let i = 0; i < count; i++) {
    const availableTypes = getQuestionTypes()
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)]
    
    try {
      const question = await createQuestionFromNotes(
        notesContent,
        type,
        options?.difficulty || 'medium',
        i + 1
      )
      questions.push(question)
    } catch (err) {
      console.error("Error generating question:", err)
      // Continue with next question if one fails
      continue
    }
  }

  return questions
}

async function createQuestionFromNotes(
  notesContent: string,
  type: QuestionType,
  difficulty: ExamDifficulty,
  questionNumber: number
): Promise<ExamQuestion> {
  const difficultyPrompts = {
    easy: "Create a straightforward question that tests basic understanding.",
    medium: "Create a moderately challenging question that tests comprehension and application.",
    hard: "Create a challenging question that tests deep understanding, analysis, and critical thinking.",
    adaptive: "Create a question that adapts to the student's performance level."
  }

  const typePrompts = {
    "multiple-choice": "Generate a multiple choice question with 4 options (A, B, C, D). Only one should be correct.",
    "true-false": "Generate a true/false question that tests understanding of the concepts.",
    "short-answer": "Generate a short answer question that requires a concise but complete response.",
    "matching": "Generate a matching question with 4-6 pairs of related terms and definitions.",
    "sequence": "Generate a sequence question where students must arrange 4-6 items in the correct order.",
    "analogy": "Generate an analogy question that tests understanding through comparison.",
    "critical-thinking": "Generate a critical thinking question that requires analysis and evaluation.",
    "application": "Generate an application question that tests how well students can apply concepts.",
    "scenario": "Generate a scenario-based question that presents a real-world situation.",
    "compare-contrast": "Generate a compare-contrast question that tests understanding of differences and similarities.",
    "cause-effect": "Generate a cause-effect question that tests understanding of relationships."
  }

  const prompt = `Based on the following notes content, generate a high-quality exam question.

Notes Content:
${notesContent}

Requirements:
- Question type: ${type}
- Difficulty: ${difficulty} (${difficultyPrompts[difficulty]})
- ${typePrompts[type]}
- Make the question relevant to the notes content
- Ensure the question tests understanding, not just memorization
- Provide a clear, correct answer
- For multiple choice, provide exactly 4 options labeled A, B, C, D
- For matching, provide 4-6 pairs
- For sequence, provide 4-6 items to arrange

Please format your response as a JSON object with the following structure:
{
  "id": ${questionNumber},
  "type": "${type}",
  "question": "The question text",
  "correctAnswer": "The correct answer",
  "options": ["Option A", "Option B", "Option C", "Option D"] (only for multiple-choice),
  "matchingPairs": [{"left": "term1", "right": "definition1"}, ...] (only for matching),
  "sequence": ["item1", "item2", ...] (only for sequence),
  "difficulty": "${difficulty}",
  "explanation": "Brief explanation of why this answer is correct",
  "hint": "A helpful hint for students"
}

Ensure the JSON is valid and complete.`

  try {
    const response = await makeGroqRequest(prompt, true)
    
    // Parse the JSON response
    const questionData = JSON.parse(response) as ExamQuestion
    
    // Validate the question data
    if (!questionData.question || !questionData.correctAnswer) {
      throw new Error("Invalid question data received")
    }

    return {
      ...questionData,
      id: questionNumber,
      type,
      difficulty
    }
  } catch (error) {
    console.error("Error creating question from notes:", error)
    
    // Fallback to a simple question if AI generation fails
    return createFallbackQuestion(notesContent, type, difficulty, questionNumber)
  }
}

function createFallbackQuestion(
  notesContent: string,
  type: QuestionType,
  difficulty: ExamDifficulty,
  questionNumber: number
): ExamQuestion {
  // Extract key concepts from notes content
  const lines = notesContent.split('\n').filter(line => line.trim().length > 0)
  const firstLine = lines[0] || "Content from notes"
  
  const baseQuestion: ExamQuestion = {
    id: questionNumber,
    type,
    question: `Based on the notes, what is the main topic discussed?`,
    correctAnswer: firstLine,
    difficulty,
    explanation: "This is a fallback question generated when AI processing failed."
  }

  switch (type) {
    case "multiple-choice":
      return {
        ...baseQuestion,
        options: [
          firstLine,
          "Option B",
          "Option C", 
          "Option D"
        ]
      }
    case "true-false":
      return {
        ...baseQuestion,
        question: "The notes contain information about the main topic.",
        correctAnswer: "True"
      }
    case "matching":
      return {
        ...baseQuestion,
        question: "Match the terms with their definitions:",
        matchingPairs: [
          { left: "Term 1", right: "Definition 1" },
          { left: "Term 2", right: "Definition 2" },
          { left: "Term 3", right: "Definition 3" },
          { left: "Term 4", right: "Definition 4" }
        ]
      }
    case "sequence":
      return {
        ...baseQuestion,
        question: "Arrange the following items in the correct order:",
        sequence: ["Step 1", "Step 2", "Step 3", "Step 4"]
      }
    default:
      return baseQuestion
  }
} 