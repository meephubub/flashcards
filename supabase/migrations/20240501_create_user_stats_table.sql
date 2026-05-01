-- Create user_stats table for storing user statistics including XP
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add comment to describe the table
COMMENT ON TABLE user_stats IS 'User statistics including XP and other metrics';

-- Add comment to describe the XP column
COMMENT ON COLUMN user_stats.xp IS 'Total experience points earned by the user through study sessions';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Create function to safely increment user XP
CREATE OR REPLACE FUNCTION increment_user_xp(user_id UUID, increment_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Ensure increment_amount is positive
  IF increment_amount <= 0 THEN
    RAISE EXCEPTION 'Increment amount must be positive';
  END IF;
  
  -- Insert user_stats row if it doesn't exist, then update XP
  INSERT INTO user_stats (user_id, xp)
  VALUES (user_id, increment_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    xp = user_stats.xp + increment_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION increment_user_xp TO authenticated;

-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to manage their own stats
CREATE POLICY "Users can manage own stats" ON user_stats
  FOR ALL USING (auth.uid() = user_id);
