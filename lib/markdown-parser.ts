interface ParsedCard {
  id: number
  front: string
  back: string
}

interface ParsedDeck {
  name: string
  description: string
  cards: ParsedCard[]
}

export function parseMarkdownToFlashcards(markdown: string): ParsedDeck {
  // Default deck info
  let deckName = "Imported Deck"
  let deckDescription = ""
  const cards: ParsedCard[] = []

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

export function parseTabDelimitedToFlashcards(text: string): ParsedDeck {
  // Default deck info
  let deckName = "Imported Deck"
  let deckDescription = ""
  const cards: ParsedCard[] = []

  // Split the text by lines
  const lines = text.split("\n")
  let cardId = 1

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Split the line by tabs
    const [front, back] = line.split("\t").map(part => part.trim())

    // Skip if we don't have both front and back
    if (!front || !back) continue

    // If this is the first line and it looks like a header, use it as the deck name
    if (i === 0 && !front.includes("?") && !front.includes(":")) {
      deckName = front
      deckDescription = back
      continue
    }

    // Add the card
    cards.push({
      id: cardId++,
      front,
      back,
    })
  }

  return {
    name: deckName,
    description: deckDescription,
    cards,
  }
}

export function parseCSVToFlashcards(text: string): ParsedDeck {
  // Default deck info
  let deckName = "Imported Deck"
  let deckDescription = ""
  const cards: ParsedCard[] = []

  // Split the text by lines
  const lines = text.split("\n")
  let cardId = 1

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line properly, handling quoted values
    const parts: string[] = []
    let current = ""
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    
    // Add the last part
    parts.push(current.trim())
    
    // Remove quotes from parts
    const [front, back] = parts.map(part => part.replace(/^"|"$/g, "").trim())

    // Skip if we don't have both front and back
    if (!front || !back) continue

    if (i === 0) {
      // First line is deck title and description
      deckName = front
      deckDescription = back
    } else {
      // All other lines are cards
      cards.push({
        id: cardId++,
        front,
        back,
      })
    }
  }

  return {
    name: deckName,
    description: deckDescription,
    cards,
  }
}
