-- Core tables for email ingestion + digest notifications.
-- This migration is intentionally minimal and matches usage in:
-- - docker/main.py (email_summaries, daily_digests)
-- - app/api/push/process-scheduled (scheduled_notifications)

create extension if not exists "uuid-ossp";

-- Stores per-email summaries created by the ingestion job.
create table if not exists public.email_summaries (
  id bigserial primary key,
  sender text,
  subject text,
  received_at text,
  body text,
  summary text,
  priority text,
  priority_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_summaries_received_at on public.email_summaries (received_at);

-- Stores one digest per day.
create table if not exists public.daily_digests (
  id bigserial primary key,
  date text not null,
  email_count integer,
  digest text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_daily_digests_date_unique on public.daily_digests (date);

-- Queue of push notifications to deliver.
create table if not exists public.scheduled_notifications (
  id bigserial primary key,
  title text not null,
  body text,
  url text,
  target_user_ids uuid[],
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending',
  result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_notifications_status_scheduled_at
  on public.scheduled_notifications (status, scheduled_at);

