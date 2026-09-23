-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 11 - TASK BOARD ENHANCEMENTS
-- Adds position column for task reordering, enables Realtime for task_assignees,
-- and automates in-app Activity notification on task assignment.
-- ==============================================================================

-- 1. Add position column for persistent manual task ordering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_group_position ON public.tasks (group_id, position);

-- 2. Enable Supabase Realtime for task_assignees table
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;

-- 3. Automated Notification for Task Assignment
CREATE OR REPLACE FUNCTION public.handle_task_assignment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task_title TEXT;
    v_task_group UUID;
    v_actor_id UUID;
BEGIN
    SELECT title, group_id INTO v_task_title, v_task_group
    FROM public.tasks WHERE id = NEW.task_id;

    v_actor_id := auth.uid();

    -- Only notify if assigned by someone else (or automated process with valid actor)
    IF v_task_group IS NOT NULL AND (v_actor_id IS NULL OR NEW.user_id != v_actor_id) THEN
        INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
        SELECT NEW.user_id, 'TASK_ASSIGNED'::public.notification_type, v_actor_id, v_task_group,
               jsonb_build_object('task_id', NEW.task_id, 'task_title', v_task_title)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = NEW.user_id
              AND type = 'TASK_ASSIGNED'
              AND (payload_json->>'task_id')::uuid = NEW.task_id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assignment_notifications ON public.task_assignees;
CREATE TRIGGER trg_task_assignment_notifications
    AFTER INSERT ON public.task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_assignment_notification();
