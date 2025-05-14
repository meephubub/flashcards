import type { ExamQuestion } from "@/app/actions/generate-questions"
import type { Card } from "@/types/flashcard"
import { makeGroqRequest } from "@/lib/groq"

export interface QuestionQuality {
  score: number // 0-1 
  issues: string[]
  suggestions: string[]
  strengths: string[]
}

export async function validateQuestionQuality(
  question: ExamQuestion,
  cards: Card[]
): Promise<QuestionQuality> {
  const validationPrompt = `Evaluate the quality of this exam question:

Question: ${question.question}
Type: ${question.type}
Correct Answer: ${question.correctAnswer}
${question.options ? `Options: ${question.options.join(', ')}` : ''}

Evaluate based on:
1. Clarity and unambiguity
2. Appropriate difficulty
3. Relevance to source material
4. Quality of distractors (for multiple choice)
5. Absence of trick questions or gotchas
6. Grammatical correctness
7. Conceptual soundness

Source cards context:
${cards.slice(0, 5).map(c => `"${c.front}" -> "${c.back}"`).join('\n')}

Respond with a JSON object containing:
{
  "score": 0.85, // 0-1 rating
  "issues": ["List any problems found"],
  "suggestions": ["Specific improvement suggestions"],
  "strengths": ["What works well in this question"]
}

Be constructive and specific in your evaluation.`

  try {
    const response = await makeGroqRequest(validationPrompt, true)
    const quality = JSON.parse(response) as QuestionQuality
    
    // Ensure score is within bounds
    quality.score = Math.max(0, Math.min(1, quality.score))
    
    return quality
  } catch (error) {
    console.error('Error validating question quality:', error)
    // Return default quality assessment
    return {
      score: 0.7,
      issues: ['Unable to validate question quality'],
      suggestions: ['Review question manually'],
      strengths: ['Question generated successfully']
    }
  }
}

export function validateQuestionStructure(question: ExamQuestion): QuestionQuality {
  const issues: string[] = []
  const suggestions: string[] = []
  const strengths: string[] = []
  let score = 1.0

  // Check question text
  if (!question.question || question.question.length < 10) {
    issues.push('Question text is too short or missing')
    score -= 0.3
  } else {
    strengths.push('Question has adequate length')
  }

  // Check correct answer
  if (!question.correctAnswer || question.correctAnswer.length < 1) {
    issues.push('Correct answer is missing')
    score -= 0.4
  } else {
    strengths.push('Correct answer provided')
  }

  // Type-specific validation
  switch (question.type) {
    case 'multiple-choice':
      if (!question.options || question.options.length < 2) {
        issues.push('Multiple choice needs at least 2 options')
        score -= 0.3
      } else if (question.options.length < 4) {
        suggestions.push('Consider adding more options for better difficulty')
        score -= 0.1
      } else {
        strengths.push('Good number of multiple choice options')
      }

      if (question.options && !question.options.includes(question.correctAnswer)) {
        issues.push('Correct answer not found in options')
        score -= 0.4
      }
      break

    case 'true-false':
      if (!['true', 'false'].some(val => 
        question.correctAnswer.toLowerCase().includes(val.toLowerCase()))) {
        issues.push('True/false answer must be True or False')
        score -= 0.3
      }
      break

    case 'matching':
      if (!question.matchingPairs || question.matchingPairs.length < 2) {
        issues.push('Matching questions need at least 2 pairs')
        score -= 0.3
      } else {
        strengths.push('Matching pairs provided')
      }
      break

    case 'sequence':
      if (!question.sequence || question.sequence.length < 2) {
        issues.push('Sequence questions need at least 2 items')
        score -= 0.3
      } else {
        strengths.push('Sequence items provided')
      }
      break
  }

  // Check for common issues
  if (question.question.includes('?') && !question.question.endsWith('?')) {
    suggestions.push('Consider ending question with proper punctuation')
    score -= 0.05
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    issues,
    suggestions,
    strengths
  }
} 