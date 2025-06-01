"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { SupabaseClient, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import * as dataService from '../lib/data'
import type { Card, CardProgressInput } from '../lib/supabase'
import type { CardProgress as LocalCardProgress } from '../lib/spaced-repetition'

export interface Deck {
  id: number
  user_id: string | null; // Added to associate deck with a user
  name: string
  description: string
  tag: string | null
  card_count: number
  last_studied: string
  cards: Card[]
  created_at?: string
  updated_at?: string
}

interface DeckContextType {
  decks: Deck[]
  loading: boolean
  user: User | null;
  addDeck: (name: string, description: string, tag?: string | null) => Promise<Deck>
  updateDeck: (deck: Deck) => Promise<Deck>
  deleteDeck: (id: number) => Promise<boolean>
  addCard: (deckId: number, front: string, back: string, img_url?: string | null) => Promise<Card>
  updateCard: (deckId: number, cardId: number, front: string, back: string, img_url?: string | null) => Promise<Card>
  deleteCard: (deckId: number, cardId: number) => Promise<boolean>
  getDeck: (id: number) => Deck | undefined
  refreshDecks: () => Promise<void>
  updateCardProgress: (deckId: number, cardId: number, progress: LocalCardProgress) => Promise<boolean>
  getDueCards: (deckId: number) => Promise<Card[]>
}

const DeckContext = createContext<DeckContextType | undefined>(undefined)

export function DeckProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dueCardsCache, setDueCardsCache] = useState<Record<number, Card[]>>({})

  useEffect(() => {
    console.log("DeckProvider: Setting up onAuthStateChange listener");
    // Supabase v2 returns a subscription directly
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`DeckProvider: onAuthStateChange event: ${event}, user ID: ${session?.user?.id}`);
      setUser(session?.user ?? null);
      setSessionChecked(true); // Indicate that initial auth check has been performed

      if (event === "SIGNED_OUT" || !session?.user) {
        console.log("DeckProvider: User signed out or no session, clearing decks.");
        setDecks([]);
        setLoading(false);
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // User is signed in or initial session loaded, refreshDecks will be triggered by the other useEffect
        console.log(`DeckProvider: User signed in or initial session for ${session?.user?.id}. Waiting for refreshDecks trigger.`);
      }
    });

    // Check initial session state, onAuthStateChange with INITIAL_SESSION should handle this
    // but a manual check can be a fallback if needed for very first load.
    // For now, relying on onAuthStateChange for simplicity and to avoid race conditions.
    // async function checkInitialUser() {
    //   const { data: { session } } = await supabase.auth.getSession();
    //   if (session && !user) {
    //     console.log("DeckProvider: Setting initial user from getSession", session.user.id);
    //     setUser(session.user);
    //   }
    //   if (!sessionChecked) {
    //      setSessionChecked(true);
    //   }
    // }
    // checkInitialUser();

    return () => {
      console.log("DeckProvider: Unsubscribing from onAuthStateChange");
      authListener.subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  useEffect(() => {
    if (sessionChecked && user) {
      refreshDecks();
    } else if (sessionChecked && !user) {
      setDecks([]);
      setLoading(false);
    }
  }, [user, sessionChecked]);

  const refreshDecks = useCallback(async () => {
    if (!user) {
      setDecks([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true)
      console.log("Fetching decks for user:", user.id)
      const fetchedSupabaseDecks = await dataService.getDecks(supabase, user.id) // Pass user.id
      console.log("Fetched decks count:", fetchedSupabaseDecks.length)
      
      // First create deck objects with empty card arrays to show something to the user quickly
      const initialDecks: Deck[] = fetchedSupabaseDecks.map(supabaseDeck => {
        // Ensure the deck has valid user_id, which it should if RLS is working correctly
        if (!supabaseDeck.user_id) {
          console.warn(`Deck ${supabaseDeck.id} has no user_id, skipping. This might indicate an issue with data or RLS.`)
          return null;
        }
        
        // The check for supabaseDeck.user_id !== user.id is now redundant 
        // as the dataService.getDecks should only return decks for the current user.
        // We keep the null check for user_id as a basic data integrity check.

        return {
          ...supabaseDeck,
          user_id: supabaseDeck.user_id,
          cards: [], // Initialize with empty cards array
          last_studied: supabaseDeck.last_studied || 'Never',
          description: supabaseDeck.description || "",
          card_count: supabaseDeck.card_count || 0,
          created_at: supabaseDeck.created_at ?? undefined,
          updated_at: supabaseDeck.updated_at ?? undefined,
        };
      }).filter(Boolean) as Deck[];
      
      // Set initial decks to show something quickly
      setDecks(initialDecks)
      console.log("Set initial decks:", initialDecks.length)
      
      // Then fetch cards separately for each deck
      // This avoids issues with the progress relationship
      const completedDecks = await Promise.all(
        initialDecks.map(async (deck) => {
          try {
            console.log(`Fetching full deck data for deck ${deck.id}`)
            const fullDeck = await dataService.getDeck(supabase, deck.id, user.id);
            
            if (fullDeck) {
              // Use optional chaining with type assertion since we know the structure
              console.log(`Successfully fetched deck ${deck.id} with ${(fullDeck as any).cards?.length || 0} cards`)
              return fullDeck;
            } else {
              console.warn(`Could not fetch full deck ${deck.id}, falling back to basic deck info`)
              return deck; // Fall back to deck without cards if fetch fails
            }
          } catch (error) {
            console.error(`Error fetching cards for deck ${deck.id}:`, error);
            // Maintain the initial deck object with its id and metadata,
            // but ensure it has an empty cards array to prevent rendering errors
            return {
              ...deck,
              cards: [] // Ensure there's always a cards array even on error
            };
          }
        })
      );
      
      // Filter out any null results and update state with completed decks
      const validCompletedDecks = completedDecks.filter(Boolean) as Deck[];
      console.log("Setting completed decks:", validCompletedDecks.length)
      
      // Update with complete deck data including cards
      setDecks(validCompletedDecks)
      setDueCardsCache({})
    } catch (error) {
      console.error("Error refreshing decks:", error);
      setDecks([]);
    } finally {
      setLoading(false)
    }
  }, [user, supabase]);

  const addDeck = async (name: string, description: string, tag: string | null = null): Promise<Deck> => {
    if (!user) throw new Error("User not authenticated");
    const newSupabaseDeck = await dataService.createDeck(supabase, name, description, tag)
    if (!newSupabaseDeck || !newSupabaseDeck.user_id) {
      throw new Error("Failed to create deck or user_id missing")
    }
    const newAppContextDeck: Deck = {
      ...newSupabaseDeck,
      user_id: newSupabaseDeck.user_id,
      cards: [],
      last_studied: newSupabaseDeck.last_studied || 'Never',
      description: newSupabaseDeck.description || "",
      card_count: newSupabaseDeck.card_count || 0,
      created_at: newSupabaseDeck.created_at ?? undefined,
      updated_at: newSupabaseDeck.updated_at ?? undefined,
    };
    setDecks((prevDecks) => [...prevDecks, newAppContextDeck])
    return newAppContextDeck
  }

  const updateDeck = async (updatedDeck: Deck): Promise<Deck> => {
    if (!user) throw new Error("User not authenticated");
    if (updatedDeck.user_id !== user.id) throw new Error("User not authorized to update this deck");
    const returnedSupabaseDeck = await dataService.updateDeck(supabase, {
        id: updatedDeck.id,
        name: updatedDeck.name,
        description: updatedDeck.description,
        tag: updatedDeck.tag
    });
    if (!returnedSupabaseDeck || !returnedSupabaseDeck.user_id) {
      throw new Error("Failed to update deck or user_id missing")
    }
    const newAppContextDeck: Deck = {
        ...returnedSupabaseDeck,
        user_id: returnedSupabaseDeck.user_id,
        cards: updatedDeck.cards,
        last_studied: returnedSupabaseDeck.last_studied || updatedDeck.last_studied || 'Never',
        description: returnedSupabaseDeck.description || "",
        card_count: returnedSupabaseDeck.card_count || updatedDeck.card_count || 0,
        created_at: returnedSupabaseDeck.created_at ?? updatedDeck.created_at ?? undefined,
        updated_at: returnedSupabaseDeck.updated_at ?? undefined,
    };
    setDecks(
      decks.map((deck) => (deck.id === newAppContextDeck.id ? newAppContextDeck : deck)),
    )
    return newAppContextDeck
  }

  const deleteDeck = async (id: number): Promise<boolean> => {
    if (!user) throw new Error("User not authenticated");
    const success = await dataService.deleteDeck(supabase, id)
    if (success) {
      setDecks(decks.filter((deck) => deck.id !== id))
    }
    return success
  }

  const addCard = async (deckId: number, front: string, back: string, img_url?: string | null): Promise<Card> => {
    if (!user) throw new Error("User not authenticated");
    const newCard = await dataService.addCard(supabase, deckId, front, back, img_url)
    if (!newCard) {
      throw new Error("Failed to add card")
    }
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = [...deck.cards, newCard]
          return {
            ...deck,
            cards: updatedCards,
            card_count: updatedCards.length,
          }
        }
        return deck
      }),
    )
    const newDueCardsCache = { ...dueCardsCache };
    delete newDueCardsCache[deckId];
    setDueCardsCache(newDueCardsCache);
    return newCard
  }

  const updateCard = async (deckId: number, cardId: number, front: string, back: string, img_url?: string | null): Promise<Card> => {
    if (!user) throw new Error("User not authenticated");
    const updatedCard = await dataService.updateCard(supabase, deckId, cardId, front, back, img_url)
    if (!updatedCard) {
      throw new Error("Failed to update card")
    }
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = deck.cards.map((card) =>
            card.id === cardId ? updatedCard : card,
          )
          return { ...deck, cards: updatedCards }
        }
        return deck
      }),
    )
    const newDueCardsCache = { ...dueCardsCache };
    delete newDueCardsCache[deckId];
    setDueCardsCache(newDueCardsCache);
    return updatedCard
  }

  const deleteCard = async (deckId: number, cardId: number): Promise<boolean> => {
    if (!user) throw new Error("User not authenticated");
    const success = await dataService.deleteCard(supabase, deckId, cardId)
    if (!success) {
      throw new Error("Failed to delete card")
    }
    setDecks(
      decks.map((deck) => {
        if (deck.id === deckId) {
          const updatedCards = deck.cards.filter((card) => card.id !== cardId)
          return {
            ...deck,
            cards: updatedCards,
            card_count: updatedCards.length,
          }
        }
        return deck
      }),
    )
    const newDueCardsCache = { ...dueCardsCache };
    delete newDueCardsCache[deckId];
    setDueCardsCache(newDueCardsCache);
    return true
  }

  const getDeck = (id: number) => {
    return decks.find((deck) => deck.id === id)
  }

  const updateCardProgress = async (deckId: number, cardId: number, progress: LocalCardProgress): Promise<boolean> => {
    if (!user) throw new Error("User not authenticated");
    try {
      const cardProgressInput: CardProgressInput = {
        interval: progress.interval,
        repetitions: progress.repetitions,
        ease_factor: progress.easeFactor,
        due_date: new Date(progress.dueDate).toISOString(),
        last_reviewed: new Date(progress.lastReviewed).toISOString(),
      };
      const success = await dataService.updateCardProgress(supabase, deckId, cardId, cardProgressInput);
      if (!success) {
        throw new Error("Failed to update card progress")
      }
      setDecks(
        decks.map((deck) => {
          if (deck.id === deckId) {
            return {
              ...deck,
              last_studied: new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            };
          }
          return deck;
        }),
      );
      const newCache = { ...dueCardsCache };
      delete newCache[deckId];
      setDueCardsCache(newCache);
      return true
    } catch (error) {
      return false
    }
  }

  const getDueCards = useCallback(async (deckId: number): Promise<Card[]> => {
    if (!user) return [];
    if (dueCardsCache[deckId]) {
      return dueCardsCache[deckId];
    }
    try {
      const fetchedDueCards = await dataService.getDueCards(supabase, deckId);
      setDueCardsCache(prevCache => ({ ...prevCache, [deckId]: fetchedDueCards }));
      return fetchedDueCards;
    } catch (error) {
      return [];
    }
  }, [user, dueCardsCache, supabase]);

  return (
    <DeckContext.Provider
      value={{
        decks,
        loading,
        user,
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
