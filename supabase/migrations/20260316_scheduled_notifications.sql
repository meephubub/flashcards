-- Create scheduled_notifications table for storing scheduled push notifications
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT,
    url TEXT DEFAULT '/',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduled notifications (using service role key)
-- For now, we'll allow the service role to access all rows
CREATE POLICY "Service role can manage all scheduled notifications"
    ON public.scheduled_notifications
    USING (true)
    WITH CHECK (true);

-- Index for efficient querying of pending notifications
CREATE INDEX IF NOT EXISTS scheduled_notifications_pending_idx 
    ON public.scheduled_notifications(scheduled_for, status) 
    WHERE status = 'pending';

-- Index for user-specific queries
CREATE INDEX IF NOT EXISTS scheduled_notifications_user_id_idx 
    ON public.scheduled_notifications(user_id);

-- Create a view to get users with their push subscription status
CREATE OR REPLACE VIEW public.users_with_push_status AS
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name,
    u.created_at,
    u.last_sign_in_at,
    CASE WHEN ps.id IS NOT NULL THEN true ELSE false END as has_push_subscription,
    COUNT(ps.id) as subscription_count
FROM auth.users u
LEFT JOIN public.push_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at, ps.id;
