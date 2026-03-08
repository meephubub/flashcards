CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  activity_type text NOT NULL,
  subject_id text,
  start_time timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  last_heartbeat timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_activity_pkey PRIMARY KEY (id)
);

-- Index for faster querying by user and date
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON public.user_activity (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_user_activity_session ON public.user_activity (session_id);
