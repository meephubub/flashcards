-- Migration: Add notifications table and trigger for email summaries
-- Run this migration to enable notifications when daily digests are created

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries on user_id and read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create a function that creates a notification when a daily digest is inserted
CREATE OR REPLACE FUNCTION create_digest_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification for the new daily digest
  -- Since daily_digests doesn't have user_id, we create a global notification (user_id = NULL)
  -- Or you could query for all users and create one per user
  INSERT INTO notifications (type, title, message, link, read)
  VALUES (
    'email_digest',
    'New Email Digest Available',
    'Your daily email summary for ' || NEW.date || ' is ready. ' || NEW.email_count || ' emails processed.',
    '/summaries?date=' || NEW.date,
    false
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create notification on daily_digest insert
DROP TRIGGER IF EXISTS trigger_digest_notification ON daily_digests;
CREATE TRIGGER trigger_digest_notification
  AFTER INSERT ON daily_digests
  FOR EACH ROW
  EXECUTE FUNCTION create_digest_notification();

-- Enable Row Level Security on notifications (optional but recommended)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own notifications or global notifications (user_id IS NULL)
CREATE POLICY "Users can view own or global notifications" ON notifications
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

-- Policy: Users can update (mark as read) their own notifications or global notifications
CREATE POLICY "Users can update own or global notifications" ON notifications
  FOR UPDATE
  USING (user_id IS NULL OR user_id = auth.uid());

-- Policy: Allow inserts from authenticated users or service role
CREATE POLICY "Allow notification inserts" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can delete their own notifications or global notifications
CREATE POLICY "Users can delete own or global notifications" ON notifications
  FOR DELETE
  USING (user_id IS NULL OR user_id = auth.uid());
