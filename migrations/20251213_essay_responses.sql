-- Migration: Add essay_responses table for GCSE practice
-- Date: 2025-12-13
-- Description: Creates table for storing essay practice responses with AI grading

-- Create essay_responses table
CREATE TABLE IF NOT EXISTS essay_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  marks_awarded INTEGER,
  feedback TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_essay_responses_user_id ON essay_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_essay_responses_subject ON essay_responses(subject);
CREATE INDEX IF NOT EXISTS idx_essay_responses_is_draft ON essay_responses(is_draft);
CREATE INDEX IF NOT EXISTS idx_essay_responses_created_at ON essay_responses(created_at DESC);

-- Enable RLS
ALTER TABLE essay_responses ENABLE ROW LEVEL SECURITY;

-- Create policy for user access (users can only see their own responses)
CREATE POLICY "Users can manage their own essay responses" 
ON essay_responses FOR ALL 
USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE essay_responses IS 'Stores GCSE essay practice responses with AI grading feedback';
