-- Enable required extensions (run in Supabase SQL Editor if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule a cron job to process pending notifications every minute
-- IMPORTANT: Replace YOUR_APP_URL and YOUR_CRON_SECRET with actual values
-- Run this in the Supabase SQL Editor after deployment:

/*
SELECT cron.schedule(
    'process-scheduled-notifications',  -- job name
    '* * * * *',                         -- every minute
    $$
    SELECT net.http_post(
        url := 'https://YOUR_APP_URL/api/push/process-scheduled',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', 'YOUR_CRON_SECRET'
        ),
        body := '{}'::jsonb
    );
    $$
);
*/

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove the job:
-- SELECT cron.unschedule('process-scheduled-notifications');
