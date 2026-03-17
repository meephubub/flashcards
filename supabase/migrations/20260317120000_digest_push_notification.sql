-- Sends a push notification whenever a new daily digest is inserted.
-- The push delivery worker reads from scheduled_notifications.

create or replace function public.enqueue_digest_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_body text;
begin
  v_title := 'Daily digest ready';
  v_body := case
    when NEW.email_count is null then 'Your inbox digest is available.'
    when NEW.email_count = 1 then 'Your inbox digest is available (1 email).'
    else format('Your inbox digest is available (%s emails).', NEW.email_count)
  end;

  insert into public.scheduled_notifications (
    title,
    body,
    url,
    scheduled_at,
    status
  )
  values (
    v_title,
    v_body,
    '/summaries',
    now(),
    'pending'
  );

  return NEW;
end;
$$;

drop trigger if exists trg_daily_digests_enqueue_notification on public.daily_digests;

create trigger trg_daily_digests_enqueue_notification
after insert on public.daily_digests
for each row
execute function public.enqueue_digest_notification();

