-- Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  card_count INTEGER DEFAULT 0,
  last_studied TEXT DEFAULT 'Never',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create card_progress table for spaced repetition
CREATE TABLE IF NOT EXISTS card_progress (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_reviewed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_card_id ON card_progress(card_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_due_date ON card_progress(due_date);

-- Add RLS policies
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you may want to restrict this in a real app)
CREATE POLICY "Allow public access to decks" ON decks FOR ALL USING (true);
CREATE POLICY "Allow public access to cards" ON cards FOR ALL USING (true);
CREATE POLICY "Allow public access to card_progress" ON card_progress FOR ALL USING (true);
