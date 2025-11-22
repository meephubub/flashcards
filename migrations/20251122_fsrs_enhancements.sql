-- Migration: Add FSRS enhancements and card opt-out feature
-- Date: 2025-11-22
-- Description: Adds exclude_from_srs column to cards table and unique constraint to card_progress

-- Add exclude_from_srs column to cards table
-- This allows users to opt individual cards out of spaced repetition scheduling
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS exclude_from_srs BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint to card_progress table
-- This ensures one progress record per card per user and enables proper upsert behavior
ALTER TABLE card_progress 
ADD CONSTRAINT card_progress_card_user_unique UNIQUE (card_id, user_id);

-- Add index for better query performance when filtering excluded cards
CREATE INDEX IF NOT EXISTS idx_cards_exclude_from_srs 
ON cards(exclude_from_srs) 
WHERE exclude_from_srs = true;

-- Add comment for documentation
COMMENT ON COLUMN cards.exclude_from_srs IS 'When true, this card is excluded from spaced repetition scheduling';
