// data-storage.ts
import { supabase } from "./supabase"
import type { Deck } from "./supabase"
import type { CardProgress } from "./spaced-repetition"
import { generateFlashcards } from "./groq"

// Initialize data storage - no-op since we're using Supabase
export function initializeDataStorage() {
  // No initialization needed as we're using Supabase
  return
}

// Get all decks with their cards
export async function getDecks(): Promise<Deck[]> {
  try {
    // Fetch all decks
    const { data: decksData, error: decksError } = await supabase
      .from("decks")
      .select("*")
      .order("created_at", { ascending: false })

    if (decksError) {
      console.error("Error fetching decks:", decksError)
      return []
    }

    // Transform the data to match our application's expected format
    const decks: Deck[] = await Promise.all(
      decksData.map(async (deck) => {
        // Fetch cards for this deck
        const { data: cardsData, error: cardsError } = await supabase
          .from("cards")
          .select("*")
          .eq("deck_id", deck.id)
          .order("created_at", { ascending: true })

        if (cardsError) {
          console.error(`Error fetching cards for deck ${deck.id}:`, cardsError)
          return {
            id: deck.id,
            name: deck.name,
            description: deck.description || "",
            tag: deck.tag,
            cardCount: deck.card_count || 0,
            lastStudied: deck.last_studied || "Never",
            cards: [],
          }
        }

        // Fetch progress data for all cards in this deck
        const cardIds = cardsData.map((card) => card.id)
        let progressData: any[] = []

        if (cardIds.length > 0) {
          const { data: progress, error: progressError } = await supabase
            .from("card_progress")
            .select("*")
            .in("card_id", cardIds)

          if (!progressError) {
            progressData = progress
          } else {
            console.error(`Error fetching progress for deck ${deck.id}:`, progressError)
          }
        }

        // Map cards with their progress data
        const cards = cardsData.map((card) => {
          const cardProgress = progressData.find((p) => p.card_id === card.id)

          return {
            id: card.id,
            front: card.front,
            back: card.back,
            img_url: card.img_url,
            progress: cardProgress
              ? {
                  easeFactor: cardProgress.ease_factor,
                  interval: cardProgress.interval,
                  repetitions: cardProgress.repetitions,
                  dueDate: cardProgress.due_date,
                  lastReviewed: cardProgress.last_reviewed,
                }
              : undefined,
          }
        })

        return {
          id: deck.id,
          name: deck.name,
          description: deck.description || "",
          tag: deck.tag,
          cardCount: cards.length,
          lastStudied: deck.last_studied || "Never",
          cards,
        }
      }),
    )

    return decks
  } catch (error) {
    console.error("Error in getDecks:", error)
    return []
  }
}

// Get a single deck by ID
export async function getDeck(id: number): Promise<Deck | undefined> {
  try {
    // Fetch the deck
    const { data: deck, error: deckError } = await supabase.from("decks").select("*").eq("id", id).single()

    if (deckError) {
      console.error(`Error fetching deck ${id}:`, deckError)
      return undefined
    }

    // Fetch cards for this deck
    const { data: cardsData, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", id)
      .order("created_at", { ascending: true })

    if (cardsError) {
      console.error(`Error fetching cards for deck ${id}:`, cardsError)
      return {
        id: deck.id,
        name: deck.name,
        description: deck.description || "",
        tag: deck.tag,
        cardCount: deck.card_count || 0,
        lastStudied: deck.last_studied || "Never",
        cards: [],
      }
    }

    // Fetch progress data for all cards in this deck
    const cardIds = cardsData.map((card) => card.id)
    let progressData: any[] = []

    if (cardIds.length > 0) {
      const { data: progress, error: progressError } = await supabase
        .from("card_progress")
        .select("*")
        .in("card_id", cardIds)

      if (!progressError) {
        progressData = progress
      } else {
        console.error(`Error fetching progress for deck ${id}:`, progressError)
      }
    }

    // Map cards with their progress data
    const cards = cardsData.map((card) => {
      const cardProgress = progressData.find((p) => p.card_id === card.id)

      return {
        id: card.id,
        front: card.front,
        back: card.back,
        img_url: card.img_url,
        progress: cardProgress
          ? {
              easeFactor: cardProgress.ease_factor,
              interval: cardProgress.interval,
              repetitions: cardProgress.repetitions,
              dueDate: cardProgress.due_date,
              lastReviewed: cardProgress.last_reviewed,
            }
          : undefined,
      }
    })

    return {
      id: deck.id,
      name: deck.name,
      description: deck.description || "",
      tag: deck.tag,
      cardCount: cards.length,
      lastStudied: deck.last_studied || "Never",
      cards,
    }
  } catch (error) {
    console.error(`Error in getDeck(${id}):`, error)
    return undefined
  }
}

// Create a new deck
export async function createDeck(name: string, description: string, tag: string | null = null): Promise<Deck | undefined> {
  try {
    const { data: deck, error } = await supabase
      .from("decks")
      .insert([
        {
          name,
          description,
          tag,
          card_count: 0,
          last_studied: "Never",
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating deck:", error)
      return undefined
    }

    return {
      id: deck.id,
      name: deck.name,
      description: deck.description || "",
      tag: deck.tag,
      cardCount: 0,
      lastStudied: "Never",
      cards: [],
    }
  } catch (error) {
    console.error("Error in createDeck:", error)
    return undefined
  }
}

// Update an existing deck
export async function updateDeck(updatedDeck: Deck): Promise<Deck | undefined> {
  try {
    const { data: deck, error } = await supabase
      .from("decks")
      .update({
        name: updatedDeck.name,
        description: updatedDeck.description,
        tag: updatedDeck.tag,
        card_count: updatedDeck.cardCount,
        last_studied: updatedDeck.lastStudied,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedDeck.id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating deck ${updatedDeck.id}:`, error)
      return undefined
    }

    // Update cards if they've changed
    for (const card of updatedDeck.cards) {
      await supabase
        .from("cards")
        .update({
          front: card.front,
          back: card.back,
          img_url: card.img_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
    }

    return {
      ...updatedDeck,
      id: deck.id,
      name: deck.name,
      description: deck.description || "",
      tag: deck.tag,
      cardCount: deck.card_count,
      lastStudied: deck.last_studied,
    }
  } catch (error) {
    console.error(`Error in updateDeck(${updatedDeck.id}):`, error)
    return undefined
  }
}

// Delete a deck
export async function deleteDeck(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from("decks").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting deck ${id}:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`Error in deleteDeck(${id}):`, error)
    return false
  }
}

// Add a card to a deck
export async function addCard(deckId: number, front: string, back: string, img_url?: string | null): Promise<Card | undefined> {
  try {
    // Insert the new card
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .insert([
        {
          deck_id: deckId,
          front,
          back,
          img_url,
        },
      ])
      .select()
      .single()

    if (cardError) {
      console.error(`Error adding card to deck ${deckId}:`, cardError)
      return undefined
    }

    // Update the card count in the deck
    const { data: deck, error: deckError } = await supabase.from("decks").select("card_count").eq("id", deckId).single()

    if (!deckError) {
      const newCardCount = (deck.card_count || 0) + 1
      await supabase
        .from("decks")
        .update({
          card_count: newCardCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deckId)
    }

    return {
      id: card.id,
      front: card.front,
      back: card.back,
      img_url: card.img_url,
    }
  } catch (error) {
    console.error(`Error in addCard(${deckId}):`, error)
    return undefined
  }
}

// Update a card
export async function updateCard(
  deckId: number,
  cardId: number,
  front: string,
  back: string,
  img_url?: string | null,
): Promise<Card | undefined> {
  try {
    const { data: card, error } = await supabase
      .from("cards")
      .update({
        front,
        back,
        img_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .eq("deck_id", deckId)
      .select()
      .single()

    if (error) {
      console.error(`Error updating card ${cardId} in deck ${deckId}:`, error)
      return undefined
    }

    return {
      id: card.id,
      front: card.front,
      back: card.back,
      img_url: card.img_url,
    }
  } catch (error) {
    console.error(`Error in updateCard(${deckId}, ${cardId}):`, error)
    return undefined
  }
}

// Delete a card
export async function deleteCard(deckId: number, cardId: number): Promise<boolean> {
  try {
    // Delete the card
    const { error: cardError } = await supabase.from("cards").delete().eq("id", cardId).eq("deck_id", deckId)

    if (cardError) {
      console.error(`Error deleting card ${cardId} from deck ${deckId}:`, cardError)
      return false
    }

    // Update the card count in the deck
    const { data: deck, error: deckError } = await supabase.from("decks").select("card_count").eq("id", deckId).single()

    if (!deckError) {
      const newCardCount = Math.max(0, (deck.card_count || 0) - 1)
      await supabase
        .from("decks")
        .update({
          card_count: newCardCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deckId)
    }

    return true
  } catch (error) {
    console.error(`Error in deleteCard(${deckId}, ${cardId}):`, error)
    return false
  }
}

// Update card progress
export async function updateCardProgress(deckId: number, cardId: number, progress: CardProgress): Promise<boolean> {
  try {
    // Check if progress record exists
    const { data: existingProgress, error: checkError } = await supabase
      .from("card_progress")
      .select("id")
      .eq("card_id", cardId)
      .maybeSingle()

    if (checkError) {
      console.error(`Error checking progress for card ${cardId}:`, checkError)
      return false
    }

    let progressError
    if (existingProgress) {
      // Update existing progress
      const { error } = await supabase
        .from("card_progress")
        .update({
          ease_factor: progress.easeFactor,
          interval: progress.interval,
          repetitions: progress.repetitions,
          due_date: progress.dueDate,
          last_reviewed: progress.lastReviewed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id)

      progressError = error
    } else {
      // Insert new progress
      const { error } = await supabase.from("card_progress").insert([
        {
          card_id: cardId,
          ease_factor: progress.easeFactor,
          interval: progress.interval,
          repetitions: progress.repetitions,
          due_date: progress.dueDate,
          last_reviewed: progress.lastReviewed,
        },
      ])

      progressError = error
    }

    if (progressError) {
      console.error(`Error updating progress for card ${cardId}:`, progressError)
      return false
    }

    // Update the last studied date in the deck
    const now = new Date()
    const formattedDate = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const { error: deckError } = await supabase
      .from("decks")
      .update({
        last_studied: formattedDate,
        updated_at: now.toISOString(),
      })
      .eq("id", deckId)

    if (deckError) {
      console.error(`Error updating last studied date for deck ${deckId}:`, deckError)
      // We still return true because the progress was updated successfully
    }

    return true
  } catch (error) {
    console.error(`Error in updateCardProgress(${deckId}, ${cardId}):`, error)
    return false
  }
}

// Get due cards for a deck
export async function getDueCards(deckId: number): Promise<Card[]> {
  try {
    const deck = await getDeck(deckId)
    if (!deck) return []

    const now = new Date()

    return deck.cards.filter((card) => {
      if (!card.progress) return true // If no progress, it's due
      const dueDate = new Date(card.progress.dueDate)
      return now >= dueDate
    })
  } catch (error) {
    console.error(`Error in getDueCards(${deckId}):`, error)
    return []
  }
}

// Import cards from markdown - this now directly adds to the database
export async function importCardsFromMarkdown(parsedDeck: any): Promise<Deck | undefined> {
  try {
    // Create a new deck
    const newDeck = await createDeck(parsedDeck.name, parsedDeck.description)
    if (!newDeck) {
      throw new Error("Failed to create deck")
    }

    // Add cards to the deck
    for (const card of parsedDeck.cards) {
      await addCard(newDeck.id, card.front, card.back)
    }

    // Return the updated deck
    return getDeck(newDeck.id)
  } catch (error) {
    console.error("Error importing cards from markdown:", error)
    return undefined
  }
}

// Generate AI flashcards
export async function generateAIFlashcards(topic: string, numberOfCards: number, deckId?: number, noteContent?: string): Promise<any> {
  try {
    // Generate flashcards using Groq
    const result = await generateFlashcards(topic, numberOfCards, noteContent)

    if (deckId) {
      // Add cards to existing deck
      for (const card of result.cards) {
        await addCard(deckId, card.front, card.back)
      }
      return {
        success: true,
        message: `Added ${result.cards.length} cards to existing deck`,
        deckId,
      }
    } else {
      // Create a new deck
      const newDeck = await createDeck(topic, `AI-generated flashcards about ${topic}`)
      if (!newDeck) {
        throw new Error("Failed to create deck")
      }

      // Add cards to the new deck
      for (const card of result.cards) {
        await addCard(newDeck.id, card.front, card.back)
      }

      return {
        success: true,
        message: `Created new deck with ${result.cards.length} cards`,
        deckId: newDeck.id,
      }
    }
  } catch (error) {
    console.error("Error generating AI flashcards:", error)
    return {
      success: false,
      message: "Failed to generate flashcards",
    }
  }
}

export type Card = {
  id: number
  front: string
  back: string
  img_url?: string | null
  progress?: CardProgress
}
