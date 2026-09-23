-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 20260923000007 - MEDIA VAULT & ATTACHMENT ENHANCEMENTS
-- Enables Supabase Realtime for public.files, creates performance indexes,
-- adds FILE_UPLOADED notification type, and automates vault upload notifications.
-- ==============================================================================

-- 1. Add FILE_UPLOADED enum value to notification_type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'FILE_UPLOADED';

-- 2. Dedicated performance indexes for Media Vault listing & filtering
CREATE INDEX IF NOT EXISTS idx_files_group_created ON public.files (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_group_mime ON public.files (group_id, mime_type);

-- 3. Enable Supabase Realtime for public.files table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'files'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
    END IF;
END $$;

-- 4. Automated Notification on File Upload to Group Vault
CREATE OR REPLACE FUNCTION public.handle_file_uploaded_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_member RECORD;
    v_actor_id UUID;
BEGIN
    v_actor_id := coalesce(NEW.owner_id, auth.uid());

    FOR v_member IN
        SELECT user_id FROM public.group_members
        WHERE group_id = NEW.group_id AND left_at IS NULL
    LOOP
        IF v_actor_id IS NULL OR v_member.user_id != v_actor_id THEN
            INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
            SELECT v_member.user_id, 'FILE_UPLOADED'::public.notification_type, v_actor_id, NEW.group_id,
                   jsonb_build_object(
                       'file_id', NEW.id,
                       'filename', NEW.filename,
                       'mime_type', NEW.mime_type,
                       'size_bytes', NEW.size_bytes
                   )
            WHERE NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = v_member.user_id
                  AND type = 'FILE_UPLOADED'
                  AND (payload_json->>'file_id')::uuid = NEW.id
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_file_uploaded_notifications ON public.files;
CREATE TRIGGER trg_file_uploaded_notifications
    AFTER INSERT ON public.files
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_file_uploaded_notification();
