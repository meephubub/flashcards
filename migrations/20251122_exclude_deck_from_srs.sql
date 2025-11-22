-- Add exclude_from_srs column to decks table
ALTER TABLE decks ADD COLUMN IF NOT EXISTS exclude_from_srs BOOLEAN DEFAULT FALSE;
