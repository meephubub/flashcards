import { NextResponse } from "next/server"
import { generateAIFlashcards } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  let topic: string | undefined;
  let numberOfCards: number | undefined;
  let deckId: number | undefined;
  let noteContent: string | undefined;

  try {
    // Assign to the outer-scoped variables
    ({ topic, numberOfCards, deckId, noteContent } = await request.json());

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const result = await generateAIFlashcards(supabase, topic, numberOfCards || 5, deckId, noteContent)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error in generate route:", error)

    // Return a more helpful error message
    return NextResponse.json(
      {
        error: "Failed to generate flashcards",
        message: error.message,
        fallback: {
          cards: [
            {
              front: `What is the main concept of ${topic || "this topic"}?`,
              back: "This is a fallback card. The AI generation service is currently unavailable.",
            },
          ],
          topic: topic || "Fallback Topic",
        },
      },
      { status: 500 },
    )
  }
}
