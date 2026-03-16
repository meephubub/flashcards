-- Create scheduled_notifications table for storing scheduled push notifications
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT,
    url TEXT DEFAULT '/',
    user_ids UUID[] DEFAULT NULL, -- Array of user IDs, NULL means send to all
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
CREATE POLICY "Service role can manage all scheduled notifications"
    ON public.scheduled_notifications
    USING (true)
    WITH CHECK (true);

-- Index for efficient querying of pending notifications
CREATE INDEX IF NOT EXISTS scheduled_notifications_pending_idx 
    ON public.scheduled_notifications(scheduled_for, status) 
    WHERE status = 'pending';

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

-- Enable pg_cron and pg_net extensions (needed for Supabase cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to process scheduled notifications by calling our API endpoint
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification RECORD;
    app_url TEXT;
    cron_secret TEXT;
BEGIN
    -- Get settings from Supabase vault or use defaults
    app_url := COALESCE(current_setting('app.settings.site_url', true), '');
    cron_secret := COALESCE(current_setting('app.settings.cron_secret', true), '');
    
    -- Get pending notifications that are due
    FOR notification IN
        SELECT * FROM public.scheduled_notifications
        WHERE status = 'pending'
        AND scheduled_for <= NOW()
        ORDER BY scheduled_for ASC
        LIMIT 10
    LOOP
        BEGIN
            -- Mark as processing to prevent duplicate sends
            UPDATE public.scheduled_notifications
            SET status = 'sent', sent_at = NOW(), updated_at = NOW()
            WHERE id = notification.id;

            -- Call the external API endpoint to actually send the push
            -- This uses pg_net to make HTTP requests
            PERFORM net.http_post(
                url := app_url || '/api/cron/push',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || cron_secret
                ),
                body := jsonb_build_object(
                    'notification_id', notification.id::text,
                    'title', notification.title,
                    'body', notification.body,
                    'url', notification.url,
                    'user_ids', notification.user_ids
                )
            );

        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed if there's an error
            UPDATE public.scheduled_notifications
            SET status = 'failed', 
                error_message = SQLERRM,
                updated_at = NOW()
            WHERE id = notification.id;
        END;
    END LOOP;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
    'process-scheduled-notifications',
    '*/5 * * * *',
    'SELECT process_scheduled_notifications();'
);
