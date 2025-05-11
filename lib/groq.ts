export interface GeneratedCard {
  front: string
  back: string
}

export interface GenerationResult {
  cards: GeneratedCard[]
  topic: string
}

export async function generateFlashcards(topic: string, numberOfCards = 5): Promise<GenerationResult> {
  // Create a simpler, more direct prompt that's less likely to cause JSON parsing issues
  const prompt = `Generate ${numberOfCards} educational flashcards on the topic: "${topic}".
Each flashcard should include:

A clear, concise question on the front.

A comprehensive, informative answer on the back.

Format the response as a valid JSON object with a "cards" array.
Each item in the array should be an object with "front" and "back" string properties.

Keep the language simple and appropriate for learners.
Ensure the JSON is properly structured and free of syntax errors.

Example output:

{
  "cards": [
    {
      "front": "What is the capital of France?",
      "back": "The capital of France is Paris."
    }
  ]
}`

  try {
    // First attempt to generate flashcards
    const response = await makeGroqRequest(prompt)

    // Try to parse the JSON response
    let parsedContent
    try {
      parsedContent = JSON.parse(response)
      // If we successfully parsed JSON, process it
      return processFlashcardResponse(parsedContent, topic)
    } catch (error) {
      console.log("Failed to parse JSON response, attempting to fix format:", response)

      // If parsing failed, send a follow-up request to fix the format
      const fixPrompt = `The following response needs to be formatted as valid JSON with a "cards" array containing objects with "front" and "back" properties. Please convert this to proper JSON format:

${response}

Return ONLY valid JSON in this format:
{
  "cards": [
    {
      "front": "Question text",
      "back": "Answer text"
    },
    ...
  ]
}`

      try {
        // Make a second request to fix the formatting
        const fixedResponse = await makeGroqRequest(fixPrompt)

        try {
          // Try to parse the fixed response
          const fixedParsedContent = JSON.parse(fixedResponse)
          return processFlashcardResponse(fixedParsedContent, topic)
        } catch (secondError) {
          console.error("Failed to parse fixed JSON response:", fixedResponse)
          // If still failing, extract content manually
          return extractCardsManually(response, topic)
        }
      } catch (retryError) {
        console.error("Error in retry request:", retryError)
        return extractCardsManually(response, topic)
      }
    }
  } catch (error) {
    console.error("Error generating flashcards:", error)
    // Return a fallback result
    return createFallbackCards(topic)
  }
}

// Helper function to make a request to the Groq API
async function makeGroqRequest(promptContent: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates educational flashcards based on a given topic. Your goal is to create clear, accurate, and well-structured flashcards suitable for learners. Each flashcard must include a direct, focused question on the front and a concise but informative answer on the back. Always return your output as a valid JSON object containing a cards array. Each element in the array should be an object with front (the question as a string) and back (the answer as a string). Keep the language accessible, avoid overly technical jargon unless the topic requires it, and ensure all output is in valid JSON syntax. Do not include any extra commentary, explanations, or markdown outside of the JSON.",
        },
        {
          role: "user",
          content: promptContent,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || "Failed to generate flashcards")
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error("No content returned from Groq")
  }

  return content
}

// Helper function to process a valid JSON response
function processFlashcardResponse(parsedContent: any, topic: string): GenerationResult {
  // Extract the cards array - handle both array format and object with cards property
  let cards
  if (Array.isArray(parsedContent)) {
    cards = parsedContent
  } else if (parsedContent.cards && Array.isArray(parsedContent.cards)) {
    cards = parsedContent.cards
  } else {
    // If we can't find a cards array, create a fallback with the available data
    cards = []

    // Try to extract card data from the response in any format
    if (typeof parsedContent === "object") {
      // Look for properties that might contain card data
      for (const key in parsedContent) {
        if (
          parsedContent[key] &&
          typeof parsedContent[key] === "object" &&
          parsedContent[key].front &&
          parsedContent[key].back
        ) {
          cards.push(parsedContent[key])
        }
      }
    }

    // If still no cards, create a fallback card
    if (cards.length === 0) {
      return createFallbackCards(topic)
    }
  }

  // Validate each card has front and back properties
  const validCards = cards.filter((card: any) => card && typeof card === "object" && card.front && card.back)

  // If no valid cards were found, create a fallback
  if (validCards.length === 0) {
    return createFallbackCards(topic)
  }

  return {
    cards: validCards.map((card: any) => ({
      front: card.front,
      back: card.back,
    })),
    topic,
  }
}

// Helper function to manually extract cards from a non-JSON response
function extractCardsManually(content: string, topic: string): GenerationResult {
  const cards: GeneratedCard[] = []

  // Try to extract front/back pairs using regex patterns
  const frontBackPairs = content.match(/front["\s:]+([^"]+)["\s,]+back["\s:]+([^"]+)/gi)

  if (frontBackPairs && frontBackPairs.length > 0) {
    for (const pair of frontBackPairs) {
      const frontMatch = pair.match(/front["\s:]+([^"]+)/i)
      const backMatch = pair.match(/back["\s:]+([^"]+)/i)

      if (frontMatch && frontMatch[1] && backMatch && backMatch[1]) {
        cards.push({
          front: frontMatch[1].trim(),
          back: backMatch[1].trim(),
        })
      }
    }
  }

  // If we couldn't extract cards using regex, try to find question-answer patterns
  if (cards.length === 0) {
    const lines = content.split("\n").filter((line) => line.trim().length > 0)

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim()
      const nextLine = lines[i + 1].trim()

      // Look for patterns like "Q: ... A: ..." or numbered questions
      if (
        (line.startsWith("Q:") || line.match(/^\d+[.)]/)) &&
        (nextLine.startsWith("A:") || nextLine.match(/^Answer:/i))
      ) {
        cards.push({
          front: line.replace(/^Q:|\d+[.)]/, "").trim(),
          back: nextLine.replace(/^A:|Answer:/i, "").trim(),
        })
        i++ // Skip the answer line since we've already processed it
      }
    }
  }

  // If we still couldn't extract cards, create fallback cards
  if (cards.length === 0) {
    return createFallbackCards(topic)
  }

  return {
    cards,
    topic,
  }
}

// Helper function to create fallback cards when all else fails
function createFallbackCards(topic: string): GenerationResult {
  return {
    cards: [
      {
        front: `What is ${topic}?`,
        back: "This card was generated as a fallback. Please try generating flashcards again.",
      },
      {
        front: `Describe the key concepts of ${topic}.`,
        back: "This card was generated as a fallback. Please try generating flashcards again.",
      },
    ],
    topic,
  }
}
