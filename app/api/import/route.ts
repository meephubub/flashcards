import { NextResponse } from "next/server"
import { parseMarkdownToFlashcards } from "@/lib/markdown-parser"
import { importCardsFromMarkdown } from "@/lib/data"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read the file content
    const fileContent = await file.text()

    // Parse the markdown
    const parsedDeck = parseMarkdownToFlashcards(fileContent)

    // Import the cards to Supabase
    const newDeck = await importCardsFromMarkdown(parsedDeck)

    if (!newDeck) {
      return NextResponse.json({ error: "Failed to import flashcards" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deck: newDeck,
      message: `Successfully imported ${parsedDeck.cards.length} cards into "${parsedDeck.name}"`,
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Failed to import flashcards" }, { status: 500 })
  }
}
