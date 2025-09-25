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

    // Validate format
    const allowedFormats = new Set(["markdown", "tab", "csv"])
    if (!allowedFormats.has(format)) {
      return NextResponse.json({ error: "Invalid format. Must be markdown, tab or csv." }, { status: 400 })
    }

    // Validate file size (e.g., <= 2MB)
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 413 })
    }

    // Read the file content
    const fileContent = await file.text()
    if (!fileContent || !fileContent.trim()) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 })
    }

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
    const result = await importCardsFromMarkdown(supabase, parsedDeck)

    if (!result) {
      return NextResponse.json({ error: "No valid cards found to import" }, { status: 400 })
    }

    const { deck, cardsAdded, cardsSkipped } = result
    return NextResponse.json({
      success: true,
      deck,
      cardsAdded,
      cardsSkipped,
      message: `Imported ${cardsAdded} card(s)${cardsSkipped ? `, skipped ${cardsSkipped}` : ""} into "${deck.name}"`,
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Failed to import flashcards" }, { status: 500 })
  }
}
