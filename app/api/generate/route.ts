import { NextResponse } from "next/server"
import { generateAIFlashcards } from "@/lib/data"

export async function POST(request: Request) {
  try {
    const { topic, numberOfCards, deckId } = await request.json()

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }

    const result = await generateAIFlashcards(topic, numberOfCards || 5, deckId)

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
              front: `What is the main concept of ${request.json().topic || "this topic"}?`,
              back: "This is a fallback card. The AI generation service is currently unavailable.",
            },
          ],
          topic: request.json().topic || "Fallback Topic",
        },
      },
      { status: 500 },
    )
  }
}
