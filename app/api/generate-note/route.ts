import { NextResponse } from "next/server";
import { generateNoteWithGroq } from "@/lib/groq";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: "Topic is required and must be a string." }, { status: 400 });
    }

    const note = await generateNoteWithGroq(topic);
    return NextResponse.json(note);

  } catch (error) {
    console.error("Error in /api/generate-note:", error);
    let errorMessage = "Failed to generate note.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: "An internal server error occurred.", details: errorMessage }, { status: 500 });
  }
} 