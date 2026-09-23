-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 11 - PUSH NOTIFICATION ASYNC DISPATCH TRIGGER
-- Non-blocking asynchronous dispatch of notification events to the
-- push-dispatcher Edge Function via pg_net upon public.notifications INSERTs.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_notification_push_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Non-blocking asynchronous HTTP POST to Edge Function via pg_net
    PERFORM net.http_post(
        url := 'https://ymosldahferqwtpwlsfu.supabase.co/functions/v1/push-dispatcher',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'type', NEW.type,
            'actor_id', NEW.actor_id,
            'group_id', NEW.group_id,
            'payload_json', NEW.payload_json
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Resilient fallback: Never fail or block the primary transaction if network call fails
    RAISE WARNING '[push_dispatch_trigger] HTTP dispatch failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Revoke direct execution from public and anon (internal trigger context only)
REVOKE EXECUTE ON FUNCTION public.handle_notification_push_dispatch() FROM PUBLIC, anon, authenticated;

-- Bind trigger to public.notifications
DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;
CREATE TRIGGER trg_dispatch_push_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_notification_push_dispatch();
