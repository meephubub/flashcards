import { NextResponse } from 'next/server';
import { generateMultipleChoiceQuestionsWithGroq } from '@/lib/groq';
import type { MCQGenerationResult } from '@/lib/groq';

export async function POST(req: Request) {
  try {
    const { noteContent, noteTitle, numberOfQuestions } = await req.json();

    if (!noteContent) {
      return NextResponse.json(
        { error: "Missing noteContent parameter" },
        { status: 400 }
      );
    }

    const result: MCQGenerationResult = await generateMultipleChoiceQuestionsWithGroq(
      noteContent,
      noteTitle, // Optional
      numberOfQuestions // Optional, will use default if not provided
    );

    if (result.mcqs.length === 0) {
        // Consider if this should be an error or just an empty success
        console.warn("No MCQs were generated for the provided content.");
        // Potentially return a specific message or status if no MCQs could be generated
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error in /api/generate-mcq:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred while generating MCQs" },
      { status: 500 }
    );
  }
} 