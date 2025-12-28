-- Create maths_responses table for storing maths practice history
CREATE TABLE IF NOT EXISTS public.maths_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    question TEXT NOT NULL,
    max_marks INTEGER NOT NULL DEFAULT 1,
    answer TEXT NOT NULL,
    marks_awarded INTEGER,
    feedback JSONB,
    is_draft BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maths_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can create their own maths responses"
    ON public.maths_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own maths responses"
    ON public.maths_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own maths responses"
    ON public.maths_responses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maths responses"
    ON public.maths_responses FOR DELETE
    USING (auth.uid() = user_id);

-- Create a trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_maths_responses_updated_at
    BEFORE UPDATE ON public.maths_responses
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_maths_responses_user_id ON public.maths_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_maths_responses_created_at ON public.maths_responses(created_at);
