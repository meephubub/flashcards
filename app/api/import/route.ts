import { NextResponse } from "next/server"
import { parseMarkdownToFlashcards, parseTabDelimitedToFlashcards, parseCSVToFlashcards } from "@/lib/markdown-parser"
import { importCardsFromMarkdown } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const format = formData.get("format") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read the file content
    const fileContent = await file.text()

    // Parse the content based on format
    let parsedDeck
    switch (format) {
      case "tab":
        parsedDeck = parseTabDelimitedToFlashcards(fileContent)
        break
      case "csv":
        parsedDeck = parseCSVToFlashcards(fileContent)
        break
      default:
        parsedDeck = parseMarkdownToFlashcards(fileContent)
    }

    // Create Supabase client
    const supabase = await createClient()

    // Import the cards to Supabase
    const newDeck = await importCardsFromMarkdown(supabase, parsedDeck)

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
