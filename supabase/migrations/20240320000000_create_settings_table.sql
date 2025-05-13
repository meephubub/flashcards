-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme TEXT NOT NULL DEFAULT 'system',
  enable_animations BOOLEAN NOT NULL DEFAULT true,
  enable_sounds BOOLEAN NOT NULL DEFAULT false,
  study_settings JSONB NOT NULL DEFAULT '{
    "cardsPerSession": 20,
    "showProgressBar": true,
    "enableSpacedRepetition": false,
    "autoFlip": false,
    "autoFlipDelay": 5
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO settings (id, theme, enable_animations, enable_sounds, study_settings)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system',
  true,
  false,
  '{
    "cardsPerSession": 20,
    "showProgressBar": true,
    "enableSpacedRepetition": false,
    "autoFlip": false,
    "autoFlipDelay": 5
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING; 