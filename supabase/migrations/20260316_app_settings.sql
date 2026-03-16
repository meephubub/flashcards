-- App Settings Migration
-- This sets up the configuration needed for Supabase cron to call your API

-- Create a table to store app settings (more reliable than ALTER SYSTEM for Supabase)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access settings
CREATE POLICY "Service role can manage app settings"
    ON public.app_settings
    USING (true)
    WITH CHECK (true);

-- Insert your app settings
-- IMPORTANT: Replace these values with your actual values!
INSERT INTO public.app_settings (key, value) VALUES
    ('site_url', 'https://your-app-url.vercel.app'),  -- Replace with your actual deployed URL
    ('cron_secret', 'your-secure-cron-secret-here')   -- Replace with a secure random string
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());

-- Update the process_scheduled_notifications function to read from the settings table
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
    -- Get settings from app_settings table
    SELECT value INTO app_url FROM public.app_settings WHERE key = 'site_url';
    SELECT value INTO cron_secret FROM public.app_settings WHERE key = 'cron_secret';
    
    -- Exit if settings are not configured
    IF app_url IS NULL OR app_url = 'https://your-app-url.vercel.app' THEN
        RAISE NOTICE 'App settings not configured. Please update site_url in app_settings table.';
        RETURN;
    END IF;
    
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
            PERFORM net.http_post(
                url := app_url || '/api/cron/push',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
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

-- Helper function to update settings easily
CREATE OR REPLACE FUNCTION update_app_setting(setting_key TEXT, setting_value TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.app_settings (key, value)
    VALUES (setting_key, setting_value)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = timezone('utc'::text, now());
END;
$$;

-- USAGE: After running this migration, update your settings by running:
-- SELECT update_app_setting('site_url', 'https://your-actual-app.vercel.app');
-- SELECT update_app_setting('cron_secret', 'your-actual-secret');
