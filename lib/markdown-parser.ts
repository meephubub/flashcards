interface ParsedCard {
  id: number
  front: string
  back: string
  front_img_url?: string | null
  back_img_url?: string | null
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
  let headers: string[] | null = null
  let headerMap: { [key: string]: number } = {}

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Split the line by tabs
    const parts = line.split("\t").map(part => part.trim())

    if (i === 0) {
      // Check for headers
      const lowerParts = parts.map(p => p.toLowerCase())
      const isHeader = lowerParts.some(p => 
        p === "front" || p === "back" || p === "question" || p === "answer" || 
        p === "img_url" || p === "image" || p === "front_img_url" || p === "back_img_url"
      )

      if (isHeader) {
        headers = lowerParts
        headers.forEach((h, index) => {
          headerMap[h] = index
        })
        continue
      } else if (!parts[0].includes("?") && !parts[0].includes(":")) {
        // Legacy behavior: first line is deck title and description
        deckName = parts[0] || deckName
        deckDescription = parts[1] || deckDescription
        continue
      }
    }

    let front = ""
    let back = ""
    let front_img_url: string | null = null
    let back_img_url: string | null = null

    if (headers) {
      front = parts[headerMap["front"] ?? headerMap["question"] ?? 0] || ""
      back = parts[headerMap["back"] ?? headerMap["answer"] ?? 1] || ""
      front_img_url = parts[headerMap["front_img_url"] ?? headerMap["img_url"] ?? headerMap["image"] ?? -1] || null
      back_img_url = parts[headerMap["back_img_url"] ?? -1] || null
    } else {
      front = parts[0] || ""
      back = parts[1] || ""
      front_img_url = parts[2] || null
    }

    // Skip if we don't have both front and back
    if (!front && !back) continue

    // Add the card
    cards.push({
      id: cardId++,
      front,
      back,
      front_img_url,
      back_img_url
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
  let cardId = 1
  let headers: string[] | null = null
  let headerMap: { [key: string]: number } = {}

  // Parse CSV text as a stream, respecting quoted fields that may contain newlines
  const parseCSVRows = (input: string): string[][] => {
    const rows: string[][] = []
    let currentRow: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      const nextChar = input[i + 1]

      if (char === '"') {
        // Handle escaped quotes (double quotes "")
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++ // Skip the next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(current.trim())
        current = ""
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // End of row (but skip empty lines)
        if (current !== "" || currentRow.length > 0) {
          currentRow.push(current.trim())
          rows.push(currentRow)
          currentRow = []
          current = ""
        }
        // Skip \r\n line endings
        if (char === '\r' && nextChar === '\n') {
          i++
        }
      } else {
        current += char
      }
    }

    // Don't forget the last field/row
    if (current !== "" || currentRow.length > 0) {
      currentRow.push(current.trim())
      rows.push(currentRow)
    }

    return rows
  }

  const rows = parseCSVRows(text)

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const parts = rows[i]
    if (parts.length === 0) continue

    if (i === 0) {
      // Check for headers
      const lowerParts = parts.map(p => p.toLowerCase())
      const isHeader = lowerParts.some(p =>
        p === "front" || p === "back" || p === "question" || p === "answer" ||
        p === "img_url" || p === "image" || p === "front_img_url" || p === "back_img_url"
      )

      if (isHeader) {
        headers = lowerParts
        headers.forEach((h, index) => {
          headerMap[h] = index
        })
        continue
      } else {
        // First line is deck title and description
        deckName = parts[0] || deckName
        deckDescription = parts[1] || deckDescription
        continue
      }
    }

    let front = ""
    let back = ""
    let front_img_url: string | null = null
    let back_img_url: string | null = null

    if (headers) {
      front = parts[headerMap["front"] ?? headerMap["question"] ?? 0] || ""
      back = parts[headerMap["back"] ?? headerMap["answer"] ?? 1] || ""
      front_img_url = parts[headerMap["front_img_url"] ?? headerMap["img_url"] ?? headerMap["image"] ?? -1] || null
      back_img_url = parts[headerMap["back_img_url"] ?? -1] || null
    } else {
      front = parts[0] || ""
      back = parts[1] || ""
      front_img_url = parts[2] || null
    }

    // Skip if we don't have both front and back
    if (!front && !back) continue

    // All other lines are cards
    cards.push({
      id: cardId++,
      front,
      back,
      front_img_url: front_img_url || null,
      back_img_url: back_img_url || null,
    })
  }

  return {
    name: deckName,
    description: deckDescription,
    cards,
  }
}
