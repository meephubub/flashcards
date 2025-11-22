-- Backfill card_progress for cards that don't have it
-- This ensures all cards (that are not excluded from SRS) have an initial progress entry.

INSERT INTO card_progress (
    user_id,
    card_id,
    ease_factor,
    interval,
    repetitions,
    due_date,
    last_reviewed,
    created_at,
    updated_at
)
SELECT
    c.user_id,
    c.id,
    2.5, -- Default ease factor
    0,   -- Default interval
    0,   -- Default repetitions
    NOW(), -- Due now
    NOW(), -- Last reviewed now
    NOW(),
    NOW()
FROM cards c
LEFT JOIN card_progress cp ON c.id = cp.card_id
WHERE cp.id IS NULL
  AND c.exclude_from_srs = FALSE;
