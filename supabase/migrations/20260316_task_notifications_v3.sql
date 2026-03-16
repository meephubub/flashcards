-- 1. Ensure columns exist in scheduled_notifications
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- 2. Ensure reminder_minutes exists in homework
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 0;

-- 3. Create index for faster sync
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_ref 
ON public.scheduled_notifications(reference_id, reference_type);

-- 4. Robust Trigger Function
CREATE OR REPLACE FUNCTION public.handle_homework_notification()
RETURNS TRIGGER AS $$
DECLARE
    notif_id UUID;
    v_scheduled_at TIMESTAMP WITH TIME ZONE;
    v_subject TEXT;
BEGIN
    -- For INSERT or UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_subject := COALESCE(NEW.subject, 'Untitled Task');
        
        -- If task is done or has no due date, cancel any existing pending notification
        IF (COALESCE(NEW.done, false) = true OR NEW.due_date IS NULL) THEN
            UPDATE public.scheduled_notifications
            SET status = 'cancelled'
            WHERE reference_id = NEW.id::text 
              AND reference_type = 'task'
              AND status = 'pending';
        
        -- If task is not done and has a due date, upsert the notification
        ELSE
            -- Calculate scheduled time: due_date - offset
            v_scheduled_at := NEW.due_date - (COALESCE(NEW.reminder_minutes, 0) * interval '1 minute');
            
            -- Check if we already have a pending one to update
            SELECT id INTO notif_id 
            FROM public.scheduled_notifications
            WHERE reference_id = NEW.id::text 
              AND reference_type = 'task'
              AND status = 'pending'
            LIMIT 1;

            IF notif_id IS NOT NULL THEN
                UPDATE public.scheduled_notifications
                SET 
                    title = 'Task Reminder: ' || v_subject,
                    body = 'Your task "' || v_subject || '" is due soon.',
                    scheduled_at = v_scheduled_at,
                    updated_at = now()
                WHERE id = notif_id;
            ELSE
                -- Create new one using security definer context
                INSERT INTO public.scheduled_notifications (
                    title,
                    body,
                    url,
                    target_user_ids,
                    scheduled_at,
                    status,
                    reference_id,
                    reference_type
                ) VALUES (
                    'Task Reminder: ' || v_subject,
                    'Your task "' || v_subject || '" is due soon.',
                    '/tasks',
                    ARRAY[NEW.user_id]::uuid[],
                    v_scheduled_at,
                    'pending',
                    NEW.id::text,
                    'task'
                );
            END IF;
        END IF;
        RETURN NEW;
    
    -- For DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled'
        WHERE reference_id = OLD.id::text 
          AND reference_type = 'task'
          AND status = 'pending';
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-apply trigger
DROP TRIGGER IF EXISTS on_homework_notification_sync ON public.homework;
CREATE TRIGGER on_homework_notification_sync
AFTER INSERT OR UPDATE OR DELETE ON public.homework
FOR EACH ROW EXECUTE FUNCTION public.handle_homework_notification();

-- 6. MANUAL RE-SYNC (Optional: run separately if you want to fix existing tasks)
-- INSERT INTO public.scheduled_notifications (title, body, url, target_user_ids, scheduled_at, status, reference_id, reference_type)
-- SELECT 
--     'Task Reminder: ' || COALESCE(subject, 'Untitled Task'),
--     'Your task "' || COALESCE(subject, 'Untitled Task') || '" is due soon.',
--     '/tasks',
--     ARRAY[user_id]::uuid[],
--     due_date - (COALESCE(reminder_minutes, 0) * interval '1 minute'),
--     'pending',
--     id::text,
--     'task'
-- FROM public.homework
-- WHERE COALESCE(done, false) = false 
--   AND due_date IS NOT NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM public.scheduled_notifications 
--       WHERE reference_id = public.homework.id::text 
--         AND reference_type = 'task' 
--         AND status = 'pending'
--   );
