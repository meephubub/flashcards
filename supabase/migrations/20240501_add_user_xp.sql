-- Add XP column to auth.users table
ALTER TABLE auth.users 
ADD COLUMN xp INTEGER DEFAULT 0 NOT NULL;

-- Add comment to describe the XP column
COMMENT ON COLUMN auth.users.xp IS 'Total experience points earned by the user through study sessions';

-- Create function to safely increment user XP
CREATE OR REPLACE FUNCTION increment_user_xp(user_id UUID, increment_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Ensure increment_amount is positive
  IF increment_amount <= 0 THEN
    RAISE EXCEPTION 'Increment amount must be positive';
  END IF;
  
  -- Update user XP
  UPDATE auth.users 
  SET xp = xp + increment_amount 
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_user_xp TO authenticated;
