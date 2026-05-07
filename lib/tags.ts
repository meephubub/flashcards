// tags.ts - Tag management functions for multi-tag support
import type { SupabaseClient } from '@supabase/supabase-js';

// Get all tags for a user
export async function getUserTags(supabase: SupabaseClient, userId: string): Promise<string[]> {
  try {
    const { data: tags, error } = await supabase
      .from("tags")
      .select("name")
      .eq("user_id", userId)
      .order("name");

    if (error) {
      console.error(`Error fetching tags for user ${userId}:`, error);
      return [];
    }

    return tags?.map(tag => tag.name) || [];
  } catch (error) {
    console.error(`Unexpected error in getUserTags for user ${userId}:`, error);
    return [];
  }
}

// Create a new tag if it doesn't exist
export async function createTag(supabase: SupabaseClient, userId: string, tagName: string): Promise<number | null> {
  try {
    // Check if tag already exists
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tagName)
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error(`Error checking existing tag ${tagName}:`, fetchError);
      return null;
    }

    if (existingTag) {
      return existingTag.id;
    }

    // Create new tag
    const { data: newTag, error: insertError } = await supabase
      .from("tags")
      .insert({
        name: tagName,
        user_id: userId
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`Error creating tag ${tagName}:`, insertError);
      return null;
    }

    return newTag?.id || null;
  } catch (error) {
    console.error(`Unexpected error in createTag for tag ${tagName}:`, error);
    return null;
  }
}

// Get tag IDs for tag names (creating new tags if needed)
export async function getOrCreateTagIds(supabase: SupabaseClient, userId: string, tagNames: string[]): Promise<number[]> {
  const tagIds: number[] = [];
  
  for (const tagName of tagNames) {
    const tagId = await createTag(supabase, userId, tagName);
    if (tagId) {
      tagIds.push(tagId);
    }
  }
  
  return tagIds;
}

// Get tags for a specific card
export async function getCardTags(supabase: SupabaseClient, cardId: number): Promise<string[]> {
  try {
    const { data: cardTags, error } = await supabase
      .from("card_tags")
      .select(`
        tags (
          name
        )
      `)
      .eq("card_id", cardId);

    if (error) {
      console.error(`Error fetching tags for card ${cardId}:`, error);
      return [];
    }

    return cardTags?.map((ct: any) => ct.tags?.name).filter(Boolean) || [];
  } catch (error) {
    console.error(`Unexpected error in getCardTags for card ${cardId}:`, error);
    return [];
  }
}

// Update card tags (replaces all existing tags)
export async function updateCardTags(supabase: SupabaseClient, cardId: number, tagNames: string[]): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for updateCardTags:", authError);
      return false;
    }

    // Verify card ownership
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("user_id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.error(`Error fetching card ${cardId} for tag update:`, cardError);
      return false;
    }

    if (card.user_id !== user.id) {
      console.warn(`User ${user.id} attempted to update tags for card ${cardId} owned by ${card.user_id}. Access denied.`);
      return false;
    }

    // Delete existing card-tag relationships
    const { error: deleteError } = await supabase
      .from("card_tags")
      .delete()
      .eq("card_id", cardId);

    if (deleteError) {
      console.error(`Error deleting existing tags for card ${cardId}:`, deleteError);
      return false;
    }

    // If no new tags, we're done
    if (tagNames.length === 0) {
      return true;
    }

    // Get or create tag IDs
    const tagIds = await getOrCreateTagIds(supabase, user.id, tagNames);
    
    if (tagIds.length === 0) {
      console.error(`Failed to get or create tag IDs for card ${cardId}`);
      return false;
    }

    // Create new card-tag relationships
    const cardTagInserts = tagIds.map(tagId => ({
      card_id: cardId,
      tag_id: tagId
    }));

    const { error: insertError } = await supabase
      .from("card_tags")
      .insert(cardTagInserts);

    if (insertError) {
      console.error(`Error inserting new tags for card ${cardId}:`, insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error in updateCardTags for card ${cardId}:`, error);
    return false;
  }
}

// Add a single tag to a card
export async function addTagToCard(supabase: SupabaseClient, cardId: number, tagName: string): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for addTagToCard:", authError);
      return false;
    }

    // Verify card ownership
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("user_id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      console.error(`Error fetching card ${cardId} for tag addition:`, cardError);
      return false;
    }

    if (card.user_id !== user.id) {
      console.warn(`User ${user.id} attempted to add tag to card ${cardId} owned by ${card.user_id}. Access denied.`);
      return false;
    }

    // Get or create tag ID
    const tagId = await createTag(supabase, user.id, tagName);
    
    if (!tagId) {
      console.error(`Failed to get or create tag ID for tag ${tagName}`);
      return false;
    }

    // Check if relationship already exists
    const { data: existingRelation, error: checkError } = await supabase
      .from("card_tags")
      .select("id")
      .eq("card_id", cardId)
      .eq("tag_id", tagId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error(`Error checking existing card-tag relation:`, checkError);
      return false;
    }

    if (existingRelation) {
      return true; // Already exists
    }

    // Create new card-tag relationship
    const { error: insertError } = await supabase
      .from("card_tags")
      .insert({
        card_id: cardId,
        tag_id: tagId
      });

    if (insertError) {
      console.error(`Error adding tag ${tagName} to card ${cardId}:`, insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error in addTagToCard for card ${cardId}, tag ${tagName}:`, error);
    return false;
  }
}

// Remove a tag from a card
export async function removeTagFromCard(supabase: SupabaseClient, cardId: number, tagName: string): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Error fetching user or no user logged in for removeTagFromCard:", authError);
      return false;
    }

    // Get tag ID
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tagName)
      .eq("user_id", user.id)
      .single();

    if (tagError || !tag) {
      console.error(`Error finding tag ${tagName}:`, tagError);
      return false;
    }

    // Delete card-tag relationship
    const { error: deleteError } = await supabase
      .from("card_tags")
      .delete()
      .eq("card_id", cardId)
      .eq("tag_id", tag.id);

    if (deleteError) {
      console.error(`Error removing tag ${tagName} from card ${cardId}:`, deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Unexpected error in removeTagFromCard for card ${cardId}, tag ${tagName}:`, error);
    return false;
  }
}

// Search cards by tags (AND logic - cards with all specified tags)
export async function searchCardsByTags(supabase: SupabaseClient, userId: string, tagNames: string[]): Promise<number[]> {
  if (!tagNames || tagNames.length === 0) return [];
  
  try {
    // Get tag IDs for the provided tag names
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .in("name", tagNames);

    if (tagsError || !tags || tags.length === 0) {
      return [];
    }

    // For AND logic, we need cards that have ALL the specified tags
    // This is more complex, so we'll use a subquery approach
    const tagIds = tags.map(t => t.id);
    
    // Get cards that have ALL the specified tags
    const { data: cardTags, error: cardTagsError } = await supabase
      .from("card_tags")
      .select("card_id, tag_id")
      .in("tag_id", tagIds);

    if (cardTagsError || !cardTags) {
      return [];
    }

    // Count how many tags each card has from our target set
    const cardTagCounts = new Map<number, number>();
    cardTags.forEach(ct => {
      const current = cardTagCounts.get(ct.card_id) || 0;
      cardTagCounts.set(ct.card_id, current + 1);
    });

    // Filter cards that have ALL the required tags
    const result = Array.from(cardTagCounts.entries())
      .filter(([cardId, count]) => count === tagIds.length)
      .map(([cardId]) => cardId);

    return result;
  } catch (error) {
    console.error(`Unexpected error in searchCardsByTags for tags ${tagNames.join(', ')}:`, error);
    return [];
  }
}
