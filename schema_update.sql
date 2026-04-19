-- Add media and occlusion fields to the cards table
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS occlusion_data JSONB DEFAULT NULL;

-- Ensure card_progress can store FSRS parameters per review if needed
-- (Optional, as calculateNextReview currently uses global settings)
ALTER TABLE card_progress
ADD COLUMN IF NOT EXISTS fsrs_params JSONB DEFAULT NULL;
