-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 10 - SECURITY HARDENING & AUTO-PURGE ENGINE
-- ==============================================================================
-- 1. Revoke public/authenticated execution on administrative lifecycle functions.
-- 2. Harden messages DELETE policy to enforce group active check.
-- 3. Add cleanup lifecycle columns to public.groups with partial indexes.
-- 4. Implement concurrency-safe group claiming for dissolution (SKIP LOCKED).
-- 5. Implement authoritative, dependency-ordered database purge procedure.
-- 6. Implement failure recording and audit logging for cleanup operations.
-- ==============================================================================

-- 1. Administrative Function Execution Revocation (Least Privilege)
REVOKE EXECUTE ON FUNCTION public.process_group_lifecycle_transitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_group_lifecycle_transitions() TO service_role;

-- 2. Harden Messages DELETE Policy: Ensure expired groups reject message deletes
DROP POLICY IF EXISTS "Sender or Admin can soft delete message" ON public.messages;
DROP POLICY IF EXISTS "Sender or Admin can soft delete message in active groups" ON public.messages;

CREATE POLICY "Sender or Admin can soft delete message in active groups"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        ((SELECT auth.uid()) = sender_id OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );

-- 3. Add Cleanup Lifecycle Columns to public.groups
ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS cleanup_status TEXT NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_group_cleanup_status CHECK (cleanup_status IN ('PENDING', 'DISSOLVING', 'COMPLETED', 'FAILED')),
    ADD COLUMN IF NOT EXISTS cleanup_attempted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleanup_error TEXT,
    ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_groups_cleanup_queue
    ON public.groups (lifecycle_state, cleanup_status, expires_at)
    WHERE cleanup_status != 'COMPLETED';

-- 4. Concurrency-Safe Group Claim Procedure (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_groups_for_dissolution(p_limit INT DEFAULT 5)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    owner_id UUID,
    file_storage_paths TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claimed_ids UUID[];
BEGIN
    -- Atomically claim candidate groups that need media & data dissolution
    -- Matches:
    -- 1. Groups explicitly in 'PURGED' state but cleanup not yet completed.
    -- 2. Groups in 'EXPIRED' or 'ARCHIVED' state whose retention threshold has passed.
    -- 3. Groups in 'FAILED' status where at least 1 hour has elapsed since last retry.
    WITH candidate_groups AS (
        SELECT g.id
        FROM public.groups g
        WHERE (
            (g.lifecycle_state = 'PURGED' AND g.cleanup_status != 'COMPLETED')
            OR (g.lifecycle_state = 'EXPIRED' AND now() >= g.expires_at + interval '7 days' AND g.cleanup_status != 'COMPLETED')
            OR (g.cleanup_status = 'FAILED' AND (g.cleanup_attempted_at IS NULL OR g.cleanup_attempted_at < now() - interval '1 hour'))
        )
        AND g.cleanup_status != 'DISSOLVING'
        ORDER BY g.expires_at ASC
        LIMIT coalesce(p_limit, 5)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.groups
    SET cleanup_status = 'DISSOLVING',
        cleanup_attempted_at = now(),
        updated_at = now()
    WHERE id IN (SELECT id FROM candidate_groups)
    RETURNING id INTO v_claimed_ids;

    IF v_claimed_ids IS NULL OR array_length(v_claimed_ids, 1) = 0 THEN
        RETURN;
    END IF;

    -- Return claimed group metadata along with any stored file references
    RETURN QUERY
    SELECT 
        g.id AS group_id,
        g.name AS group_name,
        g.owner_id AS owner_id,
        coalesce(array_agg(f.storage_path) FILTER (WHERE f.storage_path IS NOT NULL), ARRAY[]::TEXT[]) AS file_storage_paths
    FROM public.groups g
    LEFT JOIN public.files f ON f.group_id = g.id
    WHERE g.id = ANY(v_claimed_ids)
    GROUP BY g.id, g.name, g.owner_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_groups_for_dissolution(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_groups_for_dissolution(INT) TO service_role;

-- 5. Authoritative Dependency-Ordered Database Purge Procedure
CREATE OR REPLACE FUNCTION public.execute_group_database_purge(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_group RECORD;
BEGIN
    -- Verify group existence and lock row
    SELECT id, name, owner_id INTO v_group
    FROM public.groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RAISE EXCEPTION 'Group % not found for database purge.', p_group_id;
    END IF;

    -- Strict Dependency-Ordered Deletions:
    -- A. Ephemeral Location Telemetry
    DELETE FROM public.current_locations 
    WHERE session_id IN (SELECT id FROM public.location_sessions WHERE group_id = p_group_id);

    DELETE FROM public.location_session_participants 
    WHERE session_id IN (SELECT id FROM public.location_sessions WHERE group_id = p_group_id);

    DELETE FROM public.location_sessions 
    WHERE group_id = p_group_id;

    -- B. Polls, Options & Votes
    DELETE FROM public.poll_votes 
    WHERE poll_id IN (SELECT id FROM public.polls WHERE group_id = p_group_id);

    DELETE FROM public.poll_options 
    WHERE poll_id IN (SELECT id FROM public.polls WHERE group_id = p_group_id);

    DELETE FROM public.polls 
    WHERE group_id = p_group_id;

    -- C. Tasks & Assignees
    DELETE FROM public.task_assignees 
    WHERE task_id IN (SELECT id FROM public.tasks WHERE group_id = p_group_id);

    DELETE FROM public.tasks 
    WHERE group_id = p_group_id;

    -- D. Events & Itinerary
    DELETE FROM public.events 
    WHERE group_id = p_group_id;

    -- E. Messages & Attachments
    DELETE FROM public.message_attachments 
    WHERE message_id IN (SELECT id FROM public.messages WHERE group_id = p_group_id);

    DELETE FROM public.messages 
    WHERE group_id = p_group_id;

    -- F. Files Metadata
    DELETE FROM public.files 
    WHERE group_id = p_group_id;

    -- G. Notifications scoped to this group
    DELETE FROM public.notifications 
    WHERE group_id = p_group_id;

    -- H. Group Features & Members
    DELETE FROM public.group_features 
    WHERE group_id = p_group_id;

    DELETE FROM public.group_members 
    WHERE group_id = p_group_id;

    -- Transition group container to final PURGED state with completed cleanup
    UPDATE public.groups
    SET lifecycle_state = 'PURGED',
        cleanup_status = 'COMPLETED',
        cleanup_error = NULL,
        cleaned_at = now(),
        updated_at = now()
    WHERE id = p_group_id;

    -- Record in audit logs (zero personal data retained)
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata_json)
    VALUES (
        NULL,
        'GROUP_DATA_PURGED',
        'GROUP',
        p_group_id,
        jsonb_build_object(
            'group_id', p_group_id,
            'purged_at', now(),
            'lifecycle_state', 'PURGED',
            'cleanup_status', 'COMPLETED'
        )
    );

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_group_database_purge(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_group_database_purge(UUID) TO service_role;

-- 6. Failure Recording Procedure
CREATE OR REPLACE FUNCTION public.record_group_cleanup_failure(p_group_id UUID, p_error_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.groups
    SET cleanup_status = 'FAILED',
        cleanup_error = p_error_message,
        updated_at = now()
    WHERE id = p_group_id;

    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata_json)
    VALUES (
        NULL,
        'GROUP_CLEANUP_FAILED',
        'GROUP',
        p_group_id,
        jsonb_build_object(
            'group_id', p_group_id,
            'error', p_error_message,
            'attempted_at', now()
        )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_group_cleanup_failure(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_group_cleanup_failure(UUID, TEXT) TO service_role;
