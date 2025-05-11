import type { Card } from "@/lib/data"

interface ParsedDeck {
  name: string
  description: string
  cards: Card[]
}

export function parseMarkdownToFlashcards(markdown: string): ParsedDeck {
  // Default deck info
  let deckName = "Imported Deck"
  let deckDescription = ""
  const cards: Card[] = []

  // Split the markdown by lines
  const lines = markdown.split("\n")

  let currentCardFront: string | null = null
  let currentCardContent: string[] = []
  let cardId = 1

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check for deck name (# Header)
    if (line.startsWith("# ")) {
      deckName = line.substring(2).trim()
      continue
    }

    // Check for deck description (text right after the deck name)
    if (deckName !== "Imported Deck" && deckDescription === "" && line !== "" && !line.startsWith("## ")) {
      deckDescription = line
      continue
    }

    // Check for card front (## Header)
    if (line.startsWith("## ")) {
      // If we already have a card in progress, save it
      if (currentCardFront) {
        cards.push({
          id: cardId++,
          front: currentCardFront,
          back: currentCardContent.join("\n").trim(),
        })
        currentCardContent = []
      }

      // Start a new card
      currentCardFront = line.substring(2).trim()
      continue
    }

    // Add content to the current card back
    if (currentCardFront && line !== "") {
      currentCardContent.push(line)
    }
  }

  // Don't forget to add the last card if there is one
  if (currentCardFront) {
    cards.push({
      id: cardId,
      front: currentCardFront,
      back: currentCardContent.join("\n").trim(),
    })
  }

  return {
    name: deckName,
    description: deckDescription,
    cards,
  }
}
