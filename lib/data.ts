// data-storage.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deck, Card, CardProgressInput, CardProgress as SupabaseCardProgress, ParsedDeckImport } from "./supabase"
import type { CardProgress } from "./spaced-repetition"
import { generateFlashcards } from "./groq"

// Initialize data storage - no-op since we're using Supabase
export function initializeDataStorage() {
  // No initialization needed as we're using Supabase
  return
}

// Get all decks with their cards

// Merge selected decks into a new deck
export async function mergeDecks(
  supabase: SupabaseClient,
  deckIdsToMerge: string[],
  newDeckName: string,
  newDeckDescription: string = "",
  newDeckTag: string = "merged"
): Promise<Deck | null> {
  console.log("Starting merge with deck IDs:", deckIdsToMerge);
  try {
    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for mergeDecks:", authError);
      return null;
    }
    // 1. Create the new deck
    // Ensure the passed 'supabase' client is used here, which it will be if the function signature is updated.
    const { data: newDeckData, error: newDeckError } = await supabase
      .from("decks")
      .insert([
        {
          name: newDeckName,
          description: newDeckDescription,
          tag: newDeckTag,
          user_id: user.id, // Set the user_id field to the current user's ID
          // card_count will be updated later or handled by a trigger
        },
      ])
      .select()
      .single() // Assuming we want to get the new deck's details back

    if (newDeckError || !newDeckData) {
      console.error("Error creating new deck for merge:", newDeckError)
      return null
    }

    const newDeckId = newDeckData.id

    // 2. Move cards from old decks to the new deck
    // We can do this by updating the deck_id of the cards in a loop or a single batch update if possible
    // For Supabase, it's often more efficient to do it in a single call if the API supports it, or loop if not.
    // Here, we'll update cards for each old deck.

    let totalCardsMoved = 0

    for (const oldDeckId of deckIdsToMerge) {
      // Log for debugging
      console.log(`Processing deck ID: ${oldDeckId}, type: ${typeof oldDeckId}`)
      
      const { data: cardsToMove, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", oldDeckId)

      if (cardsError) {
        console.error(`Error fetching cards for deck ${oldDeckId}:`, cardsError)
        // Decide if we should continue or rollback/error out
        continue // For now, skip this deck and try others
      }

      if (cardsToMove && cardsToMove.length > 0) {
        console.log(`Found ${cardsToMove.length} cards to move from deck ${oldDeckId}`)
        
        const cardIdsToUpdate = cardsToMove.map((card) => card.id)
        console.log("Card IDs to update:", cardIdsToUpdate)
        
        const { error: updateError } = await supabase
          .from("cards")
          .update({ deck_id: newDeckId })
          .in("id", cardIdsToUpdate)

        if (updateError) {
          console.error(
            `Error moving cards from deck ${oldDeckId} to new deck ${newDeckId}:`,
            updateError
          )
          // Potentially rollback deck creation or handle partial merge
        } else {
          totalCardsMoved += cardIdsToUpdate.length
        }
      }
    }

    // 3. Optionally, update the card_count of the new deck
    // This could also be handled by a database trigger for accuracy
    const { error: updateCountError } = await supabase
      .from("decks")
      .update({ card_count: totalCardsMoved })
      .eq("id", newDeckId)

    if (updateCountError) {
      console.error("Error updating card count for new deck:", updateCountError)
    }

    // 4. Delete the old decks after merging
    console.log(`Deleting source decks after successful merge: ${deckIdsToMerge.join(", ")}`)
    const { error: deleteError } = await supabase
      .from('decks')
      .delete()
      .in('id', deckIdsToMerge)
    
    if (deleteError) {
      console.error("Error deleting source decks:", deleteError)
    } else {
      console.log(`Successfully deleted ${deckIdsToMerge.length} source decks`)
    }

    console.log(
      `Successfully merged decks [${deckIdsToMerge.join(", ")}] into new deck '${newDeckName}' (ID: ${newDeckId}). Total cards moved: ${totalCardsMoved}.`
    )
    // Fetch the newly created deck with its cards to ensure we have accurate data
    const { data: freshDeckData, error: freshDeckError } = await supabase
      .from("decks")
      .select("*")
      .eq("id", newDeckId)
      .single()
      
    if (freshDeckError) {
      console.error("Error fetching fresh deck data:", freshDeckError)
      return { ...newDeckData, card_count: totalCardsMoved, cards: [] }
    }
    
    // Fetch cards for the new deck
    const { data: newDeckCards, error: newDeckCardsError } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", newDeckId)
    
    if (newDeckCardsError) {
      console.error("Error fetching cards for new deck:", newDeckCardsError)
      return { ...freshDeckData, card_count: totalCardsMoved, cards: [] }
    }
    
    console.log(`New deck has ${newDeckCards.length} cards after merge`)
    
    // Update the card count in the database to ensure it's accurate
    await supabase
      .from("decks")
      .update({ card_count: newDeckCards.length })
      .eq("id", newDeckId)
    
    // Return the complete deck object with all required properties
    return {
      ...freshDeckData,  // This includes id, name, created_at, updated_at, etc.
      card_count: newDeckCards.length  // Override with accurate count
    }

  } catch (error) {
    console.error("An unexpected error occurred during mergeDecks:", error)
    return null
  }
}

export async function getDecks(supabase: SupabaseClient, userId: string): Promise<Deck[]> {
  try {
    if (!supabase) {
      console.error("Supabase client is not properly initialized in getDecks");
      return [];
    }
    if (!userId) {
      console.error("No user ID provided to getDecks");
      return [];
    }

    const { data: decksData, error: decksError } = await supabase
      .from("decks")
      .select("*") // This will select all columns from the 'decks' table
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (decksError) {
      console.error("Error fetching decks:", decksError)
      return []
    }

    // The data from Supabase, when selected with '*', should directly conform to the Deck type
    // if the table schema matches the Deck type definition.
    // Ensure that decksData is not null before returning.
    return decksData || []
  } catch (error) {
    console.error("Unexpected error in getDecks:", error)
    return []
  }
}

// Get a single deck by ID
export async function getDeck(supabase: SupabaseClient, deckId: number, userId: string): Promise<Deck | undefined> {
  try {
    if (!supabase) {
      console.error("Supabase client is not properly initialized in getDeck");
      return undefined;
    }
    if (!userId) {
      console.error("No user ID provided to getDeck");
      return undefined;
    }

    // Check if deckId is valid
    if (!deckId || isNaN(Number(deckId))) {
      console.error(`Invalid deck ID provided: ${deckId}`)
      return undefined
    }

    const { data: deck, error: deckError } = await supabase
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .single()

    if (deckError) {
      console.error(`Error fetching deck ${deckId}:`, deckError)
      return undefined
    }

    if (!deck) {
      console.error(`Deck with ID ${deckId} not found`)
      return undefined
    }

    // Verify that the fetched deck belongs to the authenticated user
    if (deck.user_id !== userId) {
      console.warn(`User ${userId} attempted to access deck ${deckId} owned by ${deck.user_id}. Access denied.`)
      return undefined
    }

    // Initialize cards array
    deck.cards = []

    try {
      // Fetch cards for this deck - without the progress relation first
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        // .eq("user_id", userId) // Temporarily removed user_id filter as per user request, RLS should handle this

      if (cardsError) {
        console.error(`Error fetching cards for deck ${deckId} (user ${userId}):`, cardsError)
        // We'll still return the deck, just with empty cards array
      } else {
        console.log(`For deck ${deckId} (user ${userId}), received ${cards?.length || 0} cards from DB query:`, cards);
        // Attach cards to the deck
        deck.cards = cards || []

        // Optionally try to fetch progress data separately if needed
        // This is commented out until we confirm the progress table is properly set up
        /*
        if (cards && cards.length > 0) {
          try {
            // For each card, try to fetch its progress
            for (const card of cards) {
              const { data: progressData } = await supabase
                .from("progress")
                .select("*")
                .eq("card_id", card.id)
                .maybeSingle()
              
              if (progressData) {
                // @ts-ignore - Add progress data to the card
                card.progress = progressData
              }
            }
          } catch (progressError) {
            console.warn(`Could not fetch progress data for some cards in deck ${deckId}:`, progressError)
            // Continue without progress data
          }
        }
        */
      }
    } catch (cardsError) {
      console.error(`Unexpected error fetching cards for deck ${deckId}:`, cardsError)
      // We still return the deck with empty cards array
    }

    return deck
  } catch (error) {
    console.error(`Unexpected error in getDeck(${deckId}):`, error)
    return undefined
  }
}
// Create a new deck
export async function createDeck(supabase: SupabaseClient, name: string, description: string | null, tag: string | null = null): Promise<Deck | undefined> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user or user not logged in:", userError);
      // Optionally, throw an error or return a specific indicator
      // For now, returning undefined as per original error handling for deck creation
      return undefined; 
    }

    const { data: deck, error } = await supabase
      .from("decks")
      .insert([
        {
          name,
          description,
          tag,
          user_id: user.id, // Add the user_id here
          card_count: 0, // Initialize card count for a new deck
          // last_studied can be null or omitted if DB allows/handles it
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating deck:", error)
      return undefined
    }

    return deck; // Return the deck object directly from Supabase
  } catch (error) {
    console.error("Error in createDeck:", error)
    return undefined
  }
}

// Update an existing deck
export async function updateDeck(
  supabase: SupabaseClient,
  payload: { id: number; name?: string; description?: string | null; tag?: string | null }
): Promise<Deck | undefined> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for updateDeck:", authError);
      return undefined;
    }

    // 1. Fetch the existing deck to verify ownership
    const { data: existingDeck, error: fetchError } = await supabase
      .from("decks")
      .select("id, user_id") // Only need user_id for verification
      .eq("id", payload.id)
      .single();

    if (fetchError) {
      console.error(`Error fetching deck ${payload.id} for update:`, fetchError);
      return undefined;
    }

    if (!existingDeck) {
      console.error(`Deck ${payload.id} not found for update.`);
      return undefined;
    }

    // 2. Verify ownership
    if (existingDeck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to update deck ${payload.id} owned by ${existingDeck.user_id}. Access denied.`
      );
      return undefined;
    }

    // 3. Prepare the update object with only allowed fields
    const updateData: {
      name?: string;
      description?: string | null;
      tag?: string | null;
      updated_at?: string;
    } = {};

    let hasChanges = false;
    if (payload.name !== undefined) {
      updateData.name = payload.name;
      hasChanges = true;
    }
    if (payload.description !== undefined) { // Allows setting description to null or a new string
      updateData.description = payload.description;
      hasChanges = true;
    }
    if (payload.tag !== undefined) { // Allows setting tag to null or a new string
      updateData.tag = payload.tag;
      hasChanges = true;
    }
    
    if (!hasChanges) {
        console.log(`No actual changes provided for deck ${payload.id}. Returning current deck data.`);
        // Re-fetch the full deck to ensure the return type is complete and data is fresh.
        const { data: currentDeckData, error: currentDeckError } = await supabase
            .from("decks")
            .select("*")
            .eq("id", payload.id)
            .single();
        if (currentDeckError) {
            console.error(`Error re-fetching deck ${payload.id} after no-op update:`, currentDeckError);
            return undefined;
        }
        return currentDeckData;
    }
    
    // Add updated_at timestamp for any actual change
    updateData.updated_at = new Date().toISOString();

    // 4. Perform the update
    const { data: updatedDbDeck, error: updateError } = await supabase
      .from("decks")
      .update(updateData)
      .eq("id", payload.id)
      .select() // Select all columns of the updated deck
      .single();

    if (updateError) {
      console.error(`Error updating deck ${payload.id}:`, updateError);
      return undefined;
    }

    return updatedDbDeck; // This is the full Deck object from the DB
  } catch (error) {
    console.error(`Unexpected error in updateDeck for ID ${payload?.id}:`, error);
    return undefined;
  }
}

// Delete a deck
export async function deleteDeck(supabase: SupabaseClient, deckId: number): Promise<boolean> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for deleteDeck:", authError);
      return false;
    }

    // 1. Fetch the existing deck to verify ownership
    const { data: existingDeck, error: fetchError } = await supabase
      .from("decks")
      .select("id, user_id") // Only need user_id for verification
      .eq("id", deckId)
      .single();

    if (fetchError) {
      // If error is due to deck not found, it's not a system error but a valid case for delete to fail.
      if (fetchError.code === 'PGRST116') { // PGRST116: Row to be deleted was not found
        console.log(`Deck ${deckId} not found for deletion.`);
      } else {
        console.error(`Error fetching deck ${deckId} for deletion:`, fetchError);
      }
      return false;
    }

    if (!existingDeck) { // Should be caught by PGRST116, but as a safeguard
      console.log(`Deck ${deckId} not found for deletion.`);
      return false;
    }

    // 2. Verify ownership
    if (existingDeck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to delete deck ${deckId} owned by ${existingDeck.user_id}. Access denied.`
      );
      return false;
    }

    // 3. Perform the deletion if owned
    const { error: deleteError } = await supabase
      .from("decks")
      .delete()
      .eq("id", deckId);

    if (deleteError) {
      console.error(`Error deleting deck ${deckId}:`, deleteError);
      return false;
    }

    console.log(`Deck ${deckId} deleted successfully by user ${user.id}.`);
    return true;
  } catch (error) {
    console.error(`Unexpected error in deleteDeck(${deckId}):`, error);
    return false;
  }
}

// Add a card to a deck
export async function addCard(supabase: SupabaseClient, deckId: number, front: string, back: string, img_url?: string | null): Promise<Card | undefined> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for addCard:", authError);
      return undefined;
    }

    // 1. Verify deck ownership
    const { data: deck, error: deckFetchError } = await supabase
      .from("decks")
      .select("id, user_id, card_count")
      .eq("id", deckId)
      .single();

    if (deckFetchError) {
      console.error(`Error fetching deck ${deckId} for addCard:`, deckFetchError);
      return undefined;
    }

    if (!deck) {
      console.error(`Deck ${deckId} not found for addCard.`);
      return undefined;
    }

    if (deck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to add card to deck ${deckId} owned by ${deck.user_id}. Access denied.`
      );
      return undefined;
    }

    // 2. Insert the new card
    const { data: newCard, error: cardInsertError } = await supabase
      .from("cards")
      .insert([
        {
          deck_id: deckId,
          front,
          back,
          img_url: img_url || null, // Ensure null is passed if undefined
        },
      ])
      .select() // Select all columns of the new card
      .single();

    if (cardInsertError) {
      console.error(`Error adding card to deck ${deckId}:`, cardInsertError);
      return undefined;
    }

    if (!newCard) {
        console.error(`Failed to retrieve new card details after insert into deck ${deckId}.`);
        return undefined;
    }

    // 3. Update the card count in the deck
    const newCardCount = (deck.card_count || 0) + 1;
    const { error: deckUpdateError } = await supabase
      .from("decks")
      .update({
        card_count: newCardCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId);

    if (deckUpdateError) {
      console.error(`Error updating card count for deck ${deckId} after adding card:`, deckUpdateError);
      // Non-critical error for the card creation itself, but log it.
      // The card was created, so we still return it.
    }

    return newCard; // This is the full Card object from the DB
  } catch (error) {
    console.error(`Unexpected error in addCard (deckId: ${deckId}):`, error);
    return undefined;
  }
}

// Update a card
export async function updateCard(
  supabase: SupabaseClient,
  deckId: number, // Retained for explicit association, though cardId is primary for update
  cardId: number,
  front: string,
  back: string,
  img_url?: string | null,
): Promise<Card | undefined> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for updateCard:", authError);
      return undefined;
    }

    // 1. Verify deck ownership
    const { data: deck, error: deckFetchError } = await supabase
      .from("decks")
      .select("id, user_id")
      .eq("id", deckId)
      .single();

    if (deckFetchError) {
      console.error(`Error fetching deck ${deckId} for updateCard:`, deckFetchError);
      return undefined;
    }
    if (!deck) {
      console.error(`Deck ${deckId} not found for updateCard.`);
      return undefined;
    }
    if (deck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to update card in deck ${deckId} not owned by them. Access denied.`
      );
      return undefined;
    }

    // 2. Verify card exists and belongs to the specified deck (redundant if RLS is perfect, but good for app-level check)
    const { data: existingCard, error: cardFetchError } = await supabase
      .from("cards")
      .select("id, deck_id")
      .eq("id", cardId)
      .single();

    if (cardFetchError) {
      console.error(`Error fetching card ${cardId} for update:`, cardFetchError);
      return undefined;
    }
    if (!existingCard) {
      console.error(`Card ${cardId} not found for update.`);
      return undefined;
    }
    if (existingCard.deck_id !== deckId) {
      console.warn(
        `Card ${cardId} does not belong to deck ${deckId}. Update denied.`
      );
      return undefined;
    }

    // 3. Perform the update
    const updatePayload: { front: string; back: string; img_url?: string | null; updated_at: string } = {
      front,
      back,
      updated_at: new Date().toISOString(),
    };
    if (img_url !== undefined) { // Only include img_url if provided, allows setting to null
      updatePayload.img_url = img_url;
    }

    const { data: updatedDbCard, error: updateError } = await supabase
      .from("cards")
      .update(updatePayload)
      .eq("id", cardId) // Primary key for update
      .select() // Select all columns of the updated card
      .single();

    if (updateError) {
      console.error(`Error updating card ${cardId} in deck ${deckId}:`, updateError);
      return undefined;
    }

    return updatedDbCard; // This is the full Card object from the DB
  } catch (error) {
    console.error(`Unexpected error in updateCard (deckId: ${deckId}, cardId: ${cardId}):`, error);
    return undefined;
  }
}

// Delete a card
export async function deleteCard(supabase: SupabaseClient, deckId: number, cardId: number): Promise<boolean> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for deleteCard:", authError);
      return false;
    }

    // 1. Verify deck ownership and get current card_count
    const { data: deck, error: deckFetchError } = await supabase
      .from("decks")
      .select("id, user_id, card_count")
      .eq("id", deckId)
      .single();

    if (deckFetchError) {
      console.error(`Error fetching deck ${deckId} for deleteCard:`, deckFetchError);
      return false;
    }
    if (!deck) {
      console.error(`Deck ${deckId} not found for deleteCard.`);
      return false;
    }
    if (deck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to delete card from deck ${deckId} not owned by them. Access denied.`
      );
      return false;
    }

    // 2. Verify card exists and belongs to the specified deck
    const { data: existingCard, error: cardFetchError } = await supabase
      .from("cards")
      .select("id, deck_id")
      .eq("id", cardId)
      .single();

    if (cardFetchError) {
      console.error(`Error fetching card ${cardId} for delete:`, cardFetchError);
      // This could also mean card not found, which is fine for a delete operation if we proceed directly to delete.
      // However, checking deck_id is crucial if card is found.
    }
    if (existingCard && existingCard.deck_id !== deckId) {
      console.warn(
        `Card ${cardId} does not belong to deck ${deckId}. Delete operation denied.`
      );
      return false;
    }
    // If existingCard is null and cardFetchError is null, it means the card doesn't exist. 
    // Depending on desired behavior, one might return true (idempotency) or false.
    // For now, we proceed to attempt deletion; Supabase will handle non-existent deletes gracefully (no error, 0 count).

    // 3. Delete the card
    // The .eq("deck_id", deckId) here is a safeguard, primary check was above.
    const { error: cardDeleteError, count: deleteCount } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId)
      .eq("deck_id", deckId); // Ensures we only delete if it's in the correct deck as a final check

    if (cardDeleteError) {
      console.error(`Error deleting card ${cardId} from deck ${deckId}:`, cardDeleteError);
      return false;
    }

    // If deleteCount is 0, the card might not have existed or didn't match both conditions.
    // We only update card_count if a card was actually deleted from this deck.
    if (deleteCount === null || deleteCount === 0) {
        // This can happen if the card was already deleted or didn't belong to the deck (despite earlier checks)
        // Consider if this scenario should return true (as card is gone) or false (as no action by this call)
        // For now, if no error, and card is gone, consider it a success for the client.
        // However, we should not decrement card_count if nothing was deleted.
        console.warn(`Card ${cardId} not found in deck ${deckId} for deletion, or already deleted. No count update.`);
        return true; // Card is not there, so operation is 'successful' in that sense.
    }

    // 4. Update the card count in the deck
    const newCardCount = Math.max(0, (deck.card_count || 0) - 1);
    const { error: deckUpdateError } = await supabase
      .from("decks")
      .update({
        card_count: newCardCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId);

    if (deckUpdateError) {
      console.error(
        `Error updating card count for deck ${deckId} after deleting card ${cardId}:`, 
        deckUpdateError
      );
      // Non-critical for the card deletion itself, but log it.
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error in deleteCard (deckId: ${deckId}, cardId: ${cardId}):`, error);
    return false;
  }
}

// Update card progress
export async function updateCardProgress(
  supabase: SupabaseClient,
  deckId: number, 
  cardId: number, 
  progressInput: CardProgressInput
): Promise<boolean> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for updateCardProgress:", authError);
      return false;
    }

    // 1. Verify deck ownership
    const { data: deck, error: deckFetchError } = await supabase
      .from("decks")
      .select("id, user_id")
      .eq("id", deckId)
      .single();

    if (deckFetchError) {
      console.error(`Error fetching deck ${deckId} for updateCardProgress:`, deckFetchError);
      return false;
    }
    if (!deck) {
      console.error(`Deck ${deckId} not found for updateCardProgress.`);
      return false;
    }
    if (deck.user_id !== user.id) {
      console.warn(
        `User ${user.id} attempted to update progress for card in deck ${deckId} not owned by them. Access denied.`
      );
      return false;
    }

    // 2. Verify card exists and belongs to the specified deck
    const { data: existingCard, error: cardFetchError } = await supabase
      .from("cards")
      .select("id, deck_id")
      .eq("id", cardId)
      .single();

    if (cardFetchError) {
      console.error(`Error fetching card ${cardId} for updateCardProgress:`, cardFetchError);
      return false;
    }
    if (!existingCard) {
      console.error(`Card ${cardId} not found for updateCardProgress.`);
      return false;
    }
    if (existingCard.deck_id !== deckId) {
      console.warn(
        `Card ${cardId} does not belong to deck ${deckId}. Update progress denied.`
      );
      return false;
    }

    // 3. Upsert card progress
    // Assumes a unique constraint on (card_id, user_id) in card_progress table for correct upsert behavior.
    // If not, this will insert a new row or update based on primary key 'id' if it's part of progressInput (which it shouldn't be for upsert).
    const upsertData = {
      card_id: cardId,
      user_id: user.id, // Crucial for user-specific progress
      ...progressInput, // Spreads ease_factor, interval, repetitions, due_date, last_reviewed
      updated_at: new Date().toISOString(), // Ensure updated_at is always set
    };

    const { error: progressError } = await supabase
      .from("card_progress")
      .upsert(upsertData, { 
        onConflict: 'card_id,user_id', // Specify conflict target for true upsert on these keys
        // if your primary key is 'id' and it's auto-generated, and you don't have a card_id,user_id unique constraint,
        // then upsert might not behave as expected without an explicit 'id' in upsertData for updates.
        // Consider adding the unique constraint to the DB: ALTER TABLE card_progress ADD CONSTRAINT card_progress_card_id_user_id_key UNIQUE (card_id, user_id);
      });

    if (progressError) {
      console.error(`Error upserting progress for card ${cardId} (user ${user.id}):`, progressError);
      return false;
    }

    // 4. Update the last studied date and updated_at in the deck
    const now = new Date().toISOString();
    const { error: deckUpdateError } = await supabase
      .from("decks")
      .update({
        last_studied: now, // Store as ISO string
        updated_at: now,
      })
      .eq("id", deckId);

    if (deckUpdateError) {
      console.error(`Error updating last_studied for deck ${deckId}:`, deckUpdateError);
      // Non-critical for the progress update itself, but log it.
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error in updateCardProgress (deckId: ${deckId}, cardId: ${cardId}):`, error);
    return false;
  }
}

// Get due cards for a deck
export async function getDueCards(supabase: SupabaseClient, deckId: number): Promise<Card[]> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for getDueCards:", authError);
      return [];
    }

    // 1. Fetch the deck (getDeck already verifies ownership for the current user)
    const deck = await getDeck(supabase, deckId, user.id);
    if (!deck) {
      // getDeck logs errors if any, or if deck not found/not owned
      return [];
    }

    // 2. Fetch all cards for this deck
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId);

    if (cardsError) {
      console.error(`Error fetching cards for deck ${deckId}:`, cardsError);
      return [];
    }
    if (!cards || cards.length === 0) {
      return []; // No cards in the deck
    }

    // 3. Fetch progress for these cards for the current user
    const cardIds = cards.map((card) => card.id);
    const { data: progressRecords, error: progressError } = await supabase
      .from("card_progress")
      .select("*")
      .eq("user_id", user.id)
      .in("card_id", cardIds);

    if (progressError) {
      console.error(`Error fetching card progress for user ${user.id} and deck ${deckId}:`, progressError);
      // Proceed with cards, assuming no progress means they are due
    }

    const progressMap = new Map<number, SupabaseCardProgress>();
    if (progressRecords) {
      for (const record of progressRecords) {
        if (record.card_id === null || record.card_id === undefined) {
          console.warn("Skipping progress record with null card_id:", record);
          continue;
        }
        // Ensure all fields expected by SupabaseCardProgress are present and correctly typed.
        // Supabase returns snake_case, which matches SupabaseCardProgress.
        progressMap.set(record.card_id, {
          id: record.id, 
          user_id: record.user_id, 
          card_id: record.card_id, 
          ease_factor: record.ease_factor,
          interval: record.interval,
          repetitions: record.repetitions,
          due_date: record.due_date,
          last_reviewed: record.last_reviewed,
          created_at: record.created_at,
          updated_at: record.updated_at,
        } as SupabaseCardProgress); 
      }
    }

    const now = new Date();
    const dueCards: Card[] = [];

    for (const card of cards) {
      const typedCard = card as Card; 
      const progress = progressMap.get(typedCard.id); // progress is now SupabaseCardProgress | undefined

      if (!progress) {
        dueCards.push(typedCard); 
        continue;
      }

      // progress.due_date should now correctly resolve to the snake_case property
      const dueDate = new Date(progress.due_date);
      if (now >= dueDate) {
        dueCards.push(typedCard);
      }
    }

    return dueCards;
  } catch (error) {
    console.error(`Unexpected error in getDueCards for deck ${deckId}:`, error);
    return [];
  }
}

// Import cards from markdown - this now directly adds to the database
export async function importCardsFromMarkdown(supabase: SupabaseClient, parsedDeck: ParsedDeckImport): Promise<Deck | undefined> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for importCardsFromMarkdown:", authError);
      throw new Error("User authentication failed");
    }

    // Create a new deck
    const deckName = parsedDeck.name;
    // Ensure deckName is a non-empty string
    if (typeof deckName !== 'string' || !deckName.trim()) {
      console.error("Deck name is missing, null, undefined, or empty in parsedDeck. Cannot import.");
      throw new Error("Deck import failed: Deck name is required and must be a non-empty string.");
    }
    
    const deckDescription = parsedDeck.description ?? null;

    // Create a new deck
    const newDeck = await createDeck(supabase, deckName.trim(), deckDescription);
    if (!newDeck) {
      throw new Error("Failed to create deck")
    }

    // Add cards to the deck
    for (const card of parsedDeck.cards) {
      const frontContent = typeof card.front === 'string' ? card.front.trim() : '';
      const backContent = typeof card.back === 'string' ? card.back.trim() : '';

      if (!frontContent || !backContent) {
        console.warn(`Skipping card due to empty front or back content: {front: "${String(card.front || '').substring(0,20)}...", back: "${String(card.back || '').substring(0,20)}..."} for deck ${newDeck.id}`);
        continue; // Skip this card if front or back is empty
      }

      // addCard has been refactored and returns a Card object or undefined
      const addedCard = await addCard(supabase, newDeck.id, frontContent, backContent, card.img_url || null);
      if (!addedCard) {
        // Potentially log an error or collect failures if some cards couldn't be added
        console.warn(`Failed to add card: {front: "${frontContent.substring(0,20)}..."} to deck ${newDeck.id}`);
        // Depending on desired behavior, you might want to throw an error here or continue
      }
    }

    // Return the updated deck
    return getDeck(supabase, newDeck.id, user.id)
  } catch (error) {
    console.error("Error importing cards from markdown:", error)
    return undefined
  }
}

// Generate AI flashcards
export async function generateAIFlashcards(
  supabase: SupabaseClient,
  topic: string, 
  numberOfCards: number, 
  deckId?: number, 
  noteContent?: string
): Promise<{ success: boolean; message: string; deckId?: number; cardsAdded: number; newDeck?: Deck; error?: string }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for generateAIFlashcards:", authError);
      return {
        success: false,
        message: "User not authenticated",
        cardsAdded: 0,
        error: authError?.message || "Authentication failed",
      };
    }

    let targetDeckId = deckId;
    let existingDeckVerified = false;

    if (targetDeckId) {
      const { data: deckData, error: deckFetchError } = await supabase
        .from("decks")
        .select("id, user_id")
        .eq("id", targetDeckId)
        .single();

      if (deckFetchError || !deckData) {
        console.error(`Error fetching target deck ${targetDeckId} or deck not found:`, deckFetchError);
        return {
          success: false,
          message: `Target deck ${targetDeckId} not found.`,
          cardsAdded: 0,
          deckId: targetDeckId,
          error: deckFetchError?.message || "Deck fetch failed",
        };
      }
      if (deckData.user_id !== user.id) {
        console.warn(`User ${user.id} attempted to generate AI cards for deck ${targetDeckId} not owned by them.`);
        return {
          success: false,
          message: "Access denied to target deck.",
          cardsAdded: 0,
          deckId: targetDeckId,
          error: "Ownership verification failed",
        };
      }
      existingDeckVerified = true;
    }

    // Generate flashcards using Groq
    let generatedResult;
    try {
      generatedResult = await generateFlashcards(topic, numberOfCards, noteContent);
      if (!generatedResult || !generatedResult.cards || !Array.isArray(generatedResult.cards)) {
        console.error("Invalid response from flashcard generation service:", generatedResult);
        throw new Error('Invalid response structure from flashcard generation service');
      }
    } catch (genError: any) {
      console.error("Error from generateFlashcards service:", genError);
      return {
        success: false,
        message: "Failed to generate flashcards from AI service.",
        cardsAdded: 0,
        deckId: targetDeckId,
        error: genError.message || genError.toString(),
      };
    }

    let cardsSuccessfullyAdded = 0;
    let finalDeck: Deck | undefined = undefined;

    if (targetDeckId && existingDeckVerified) {
      // Add cards to existing deck
      for (const card of generatedResult.cards) {
        const added = await addCard(supabase, targetDeckId, card.question, card.answer, null); // Map question/answer to front/back
        if (added) cardsSuccessfullyAdded++;
      }
      return {
        success: true,
        message: `Added ${cardsSuccessfullyAdded} of ${generatedResult.cards.length} cards to deck ${targetDeckId}.`,
        deckId: targetDeckId,
        cardsAdded: cardsSuccessfullyAdded,
      };
    } else {
      // Create a new deck
      const newDeckData = await createDeck(supabase, topic, `AI-generated flashcards about ${topic}`);
      if (!newDeckData) {
        return {
          success: false,
          message: "Failed to create a new deck for AI flashcards.",
          cardsAdded: 0,
          error: "Deck creation failed after AI generation.",
        };
      }
      targetDeckId = newDeckData.id; // Assign the new deck's ID
      // Add cards to the new deck
      for (const card of generatedResult.cards) {
        const added = await addCard(supabase, targetDeckId, card.question, card.answer, null); // Map question/answer to front/back
        if (added) cardsSuccessfullyAdded++;
      }
      finalDeck = await getDeck(supabase, targetDeckId, user.id); 
      return {
        success: true,
        message: `Created new deck '${topic}' with ${cardsSuccessfullyAdded} of ${generatedResult.cards.length} AI-generated cards.`,
        deckId: targetDeckId,
        cardsAdded: cardsSuccessfullyAdded,
        newDeck: finalDeck,
      };
    }
  } catch (error: any) {
    console.error("Error in generateAIFlashcards:", error);
    return {
      success: false,
      message: error.message || "An unknown error occurred during AI flashcard generation.",
      cardsAdded: 0,
      error: error.toString(),
    };
  }
}
