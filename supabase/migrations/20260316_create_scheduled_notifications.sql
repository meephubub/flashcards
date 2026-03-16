-- Create scheduled_notifications table for cron-based push scheduling
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT,
    url TEXT DEFAULT '/',
    target_user_ids UUID[],  -- NULL means send to all users
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    result JSONB,  -- stores sent/failed counts after processing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Index for cron job queries (find pending notifications due for sending)
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
    ON public.scheduled_notifications (scheduled_at)
    WHERE status = 'pending';

-- RLS: only service role / cron should access this table
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no restrictive user policies)
-- Admin access is handled at the API layer via ALLOWED_EMAIL / CRON_SECRET checks
