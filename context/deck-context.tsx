"use client"

import { createContext, useState, useContext, useEffect, type ReactNode } from "react"
import type { CardProgress } from "@/lib/spaced-repetition"
import * as dataService from "@/lib/data"

export interface Card {
  id: number
  front: string
  back: string
  img_url?: string | null
  progress?: CardProgress
}

export interface Deck {
  id: number
  name: string
  description: string
  tag: string | null
  cardCount: number
  lastStudied: string
  cards: Card[]
}

interface DeckContextType {
  decks: Deck[]
  loading: boolean
  addDeck: (name: string, description: string, tag?: string | null) => Promise<Deck>
  updateDeck: (deck: Deck) => Promise<Deck>
  deleteDeck: (id: number) => Promise<boolean>
  addCard: (deckId: number, front: string, back: string, img_url?: string | null) => Promise<Card>
  updateCard: (deckId: number, cardId: number, front: string, back: string, img_url?: string | null) => Promise<Card>
  deleteCard: (deckId: number, cardId: number) => Promise<boolean>
  getDeck: (id: number) => Deck | undefined
  refreshDecks: () => Promise<void>
  updateCardProgress: (deckId: number, cardId: number, progress: CardProgress) => Promise<boolean>
  getDueCards: (deckId: number) => Card[]
}

const DeckContext = createContext<DeckContextType | undefined>(undefined)

export function DeckProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [dueCardsCache, setDueCardsCache] = useState<Record<number, Card[]>>({})

  // Fetch decks on initial load
  useEffect(() => {
    refreshDecks()
  }, [])

  const refreshDecks = async () => {
    try {
      setLoading(true)
      const fetchedDecks = await dataService.getDecks()
      setDecks(fetchedDecks)

      // Clear due cards cache when refreshing decks
      setDueCardsCache({})
    } catch (error) {
      console.error("Error fetching decks:", error)
    } finally {
      setLoading(false)
    }
  }

  const addDeck = async (name: string, description: string, tag: string | null = null): Promise<Deck> => {
    const newDeck = await dataService.createDeck(name, description, tag)

    if (!newDeck) {
      throw new Error("Failed to create deck")
    }

    setDecks([...decks, newDeck])
    return newDeck
  }

  const updateDeck = async (updatedDeck: Deck): Promise<Deck> => {
    const result = await dataService.updateDeck(updatedDeck)

    if (!result) {
      throw new Error("Failed to update deck")
    }

    setDecks(decks.map((deck) => (deck.id === result.id ? result : deck)))
    return result
  }

  const deleteDeck = async (id: number): Promise<boolean> => {
    const success = await dataService.deleteDeck(id)

    if (!success) {
      throw new Error("Failed to delete deck")
    }

    setDecks(decks.filter((deck) => deck.id !== id))
    return true
  }

  const addCard = async (deckId: number, front: string, back: string, img_url?: string | null): Promise<Card> => {
    const newCard = await dataService.addCard(deckId, front, back, img_url)

    if (!newCard) {
      throw new Error("Failed to add card")
    }

    // Update the local state
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = [...deck.cards, newCard]
          return {
            ...deck,
            cards: updatedCards,
            cardCount: updatedCards.length,
          }
        }
        return deck
      }),
    )

    // Clear due cards cache for this deck
    setDueCardsCache({
      ...dueCardsCache,
      [deckId]: undefined,
    })

    return newCard
  }

  const updateCard = async (deckId: number, cardId: number, front: string, back: string, img_url?: string | null): Promise<Card> => {
    const updatedCard = await dataService.updateCard(deckId, cardId, front, back, img_url)

    if (!updatedCard) {
      throw new Error("Failed to update card")
    }

    // Update the local state
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = deck.cards.map((card) => (card.id === cardId ? updatedCard : card))
          return { ...deck, cards: updatedCards }
        }
        return deck
      }),
    )

    // Clear due cards cache for this deck
    setDueCardsCache({
      ...dueCardsCache,
      [deckId]: undefined,
    })

    return updatedCard
  }

  const deleteCard = async (deckId: number, cardId: number): Promise<boolean> => {
    const success = await dataService.deleteCard(deckId, cardId)

    if (!success) {
      throw new Error("Failed to delete card")
    }

    // Update the local state
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = deck.cards.filter((card) => card.id !== cardId)
          return {
            ...deck,
            cards: updatedCards,
            cardCount: updatedCards.length,
          }
        }
        return deck
      }),
    )

    // Clear due cards cache for this deck
    setDueCardsCache({
      ...dueCardsCache,
      [deckId]: undefined,
    })

    return true
  }

  const getDeck = (id: number) => {
    return decks.find((deck) => deck.id === id)
  }

  const updateCardProgress = async (deckId: number, cardId: number, progress: CardProgress): Promise<boolean> => {
    try {
      const success = await dataService.updateCardProgress(deckId, cardId, progress)

      if (!success) {
        throw new Error("Failed to update card progress")
      }

      // Update the local state
      setDecks(
        decks.map((deck) => {
          if (deck.id === deckId) {
            const updatedCards = deck.cards.map((card) => {
              if (card.id === cardId) {
                return { ...card, progress }
              }
              return card
            })
            return {
              ...deck,
              cards: updatedCards,
              lastStudied: new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            }
          }
          return deck
        }),
      )

      // Clear due cards cache for this deck
      setDueCardsCache({
        ...dueCardsCache,
        [deckId]: undefined,
      })

      return true
    } catch (error) {
      console.error("Error updating card progress:", error)
      return false
    }
  }

  const getDueCards = (deckId: number): Card[] => {
    // Check if we have cached due cards for this deck
    if (dueCardsCache[deckId]) {
      return dueCardsCache[deckId]
    }

    const deck = getDeck(deckId)
    if (!deck) return []

    const now = new Date()

    const dueCards = deck.cards.filter((card) => {
      if (!card.progress) return true // If no progress, it's due
      const dueDate = new Date(card.progress.dueDate)
      return now >= dueDate
    })

    // Cache the result
    setDueCardsCache({
      ...dueCardsCache,
      [deckId]: dueCards,
    })

    return dueCards
  }

  return (
    <DeckContext.Provider
      value={{
        decks,
        loading,
        addDeck,
        updateDeck,
        deleteDeck,
        addCard,
        updateCard,
        deleteCard,
        getDeck,
        refreshDecks,
        updateCardProgress,
        getDueCards,
      }}
    >
      {children}
    </DeckContext.Provider>
  )
}

export function useDecks() {
  const context = useContext(DeckContext)
  if (context === undefined) {
    throw new Error("useDecks must be used within a DeckProvider")
  }
  return context
}
