-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 20260923000006 - EVENT ENHANCEMENTS & ITINERARY ENGINE
-- Renames starts_at -> target_time and location_text -> location_name,
-- adds creator_id and is_milestone, registers Realtime publication,
-- updates RLS policies, and automates event in-app notifications.
-- ==============================================================================

-- 1. Rename columns if legacy names exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'starts_at'
    ) THEN
        ALTER TABLE public.events RENAME COLUMN starts_at TO target_time;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'location_text'
    ) THEN
        ALTER TABLE public.events RENAME COLUMN location_text TO location_name;
    END IF;
END $$;

-- 2. Add creator_id and is_milestone columns
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES public.profiles(user_id) ON DELETE RESTRICT DEFAULT auth.uid(),
    ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;

-- 3. Dedicated indexes for itinerary ordering and milestone filtering
CREATE INDEX IF NOT EXISTS idx_events_group_target_time ON public.events (group_id, target_time);
CREATE INDEX IF NOT EXISTS idx_events_group_milestones ON public.events (group_id, is_milestone, target_time);

-- 4. Enable Supabase Realtime for public.events table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    END IF;
END $$;

-- 5. Update RLS Policies: Creator or Admin can delete events in active groups
DROP POLICY IF EXISTS "Admins can delete events in active groups" ON public.events;
DROP POLICY IF EXISTS "Creator or Admin can delete events in active groups" ON public.events;

CREATE POLICY "Creator or Admin can delete events in active groups"
    ON public.events
    FOR DELETE
    TO authenticated
    USING (
        (creator_id = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );

-- 6. Automated Notification on Event Creation
CREATE OR REPLACE FUNCTION public.handle_event_created_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_member RECORD;
    v_actor_id UUID;
BEGIN
    v_actor_id := coalesce(NEW.creator_id, auth.uid());

    FOR v_member IN
        SELECT user_id FROM public.group_members
        WHERE group_id = NEW.group_id AND left_at IS NULL
    LOOP
        IF v_actor_id IS NULL OR v_member.user_id != v_actor_id THEN
            INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
            SELECT v_member.user_id, 'EVENT_REMINDER'::public.notification_type, v_actor_id, NEW.group_id,
                   jsonb_build_object(
                       'event_id', NEW.id,
                       'event_title', NEW.title,
                       'target_time', NEW.target_time,
                       'is_milestone', NEW.is_milestone
                   )
            WHERE NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = v_member.user_id
                  AND type = 'EVENT_REMINDER'
                  AND (payload_json->>'event_id')::uuid = NEW.id
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_created_notifications ON public.events;
CREATE TRIGGER trg_event_created_notifications
    AFTER INSERT ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_event_created_notification();
