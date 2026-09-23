-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 12 - PART 11 QR INVITES & PURGE ENGINE EXPANSION
-- 1. Create public.group_invitations table with cryptographic token hashing.
-- 2. RLS policies restricting creation and revocation to group admins.
-- 3. Atomic preview, creation, revocation, and join RPCs.
-- 4. Update execute_group_database_purge to scrub invitations upon group dissolution.
-- ==============================================================================

-- 1. Create group_invitations table
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INT DEFAULT NULL,
    uses_count INT NOT NULL DEFAULT 0,
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT chk_uses_count CHECK (uses_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_group_invitations_token_hash ON public.group_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON public.group_invitations (group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_active ON public.group_invitations (group_id, expires_at) WHERE revoked_at IS NULL;

-- 2. Enable RLS
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view active group invites" ON public.group_invitations;
CREATE POLICY "Group members can view active group invites"
    ON public.group_invitations
    FOR SELECT
    TO authenticated
    USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

DROP POLICY IF EXISTS "Group admins can insert group invites" ON public.group_invitations;
CREATE POLICY "Group admins can insert group invites"
    ON public.group_invitations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_group_admin(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND created_by = (SELECT auth.uid())
    );

DROP POLICY IF EXISTS "Group admins can revoke group invites" ON public.group_invitations;
CREATE POLICY "Group admins can revoke group invites"
    ON public.group_invitations
    FOR UPDATE
    TO authenticated
    USING (
        public.is_group_admin(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_admin(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

-- 3. RPC: Create Group Invitation
CREATE OR REPLACE FUNCTION public.create_group_invite(
    p_group_id UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_max_uses INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_group RECORD;
    v_effective_expiry TIMESTAMPTZ;
    v_invite_id UUID;
BEGIN
    v_user_id := (SELECT auth.uid());
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, name, expires_at, lifecycle_state INTO v_group
    FROM public.groups
    WHERE id = p_group_id;

    IF v_group.id IS NULL OR v_group.lifecycle_state != 'ACTIVE' OR now() >= v_group.expires_at THEN
        RAISE EXCEPTION 'Group is inactive or expired.';
    END IF;

    IF NOT public.is_group_admin(p_group_id, v_user_id) THEN
        RAISE EXCEPTION 'Security violation: Only group Owner or Admins can generate invites.';
    END IF;

    -- Expiration cannot exceed group expiration
    v_effective_expiry := least(p_expires_at, v_group.expires_at);

    INSERT INTO public.group_invitations (
        group_id,
        created_by,
        token_hash,
        expires_at,
        max_uses
    )
    VALUES (
        p_group_id,
        v_user_id,
        p_token_hash,
        v_effective_expiry,
        p_max_uses
    )
    RETURNING id INTO v_invite_id;

    RETURN jsonb_build_object(
        'id', v_invite_id,
        'group_id', p_group_id,
        'expires_at', v_effective_expiry,
        'max_uses', p_max_uses
    );
END;
$$;

-- 4. RPC: Preview Group Invitation
CREATE OR REPLACE FUNCTION public.preview_group_invite(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invite RECORD;
    v_group RECORD;
    v_inviter RECORD;
    v_member_count INT;
    v_caller_id UUID;
    v_is_member BOOLEAN := false;
BEGIN
    v_caller_id := (SELECT auth.uid());

    SELECT * INTO v_invite
    FROM public.group_invitations
    WHERE token_hash = p_token_hash;

    IF v_invite.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'INVITE_NOT_FOUND');
    END IF;

    IF v_invite.revoked_at IS NOT NULL THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'INVITE_REVOKED');
    END IF;

    IF now() >= v_invite.expires_at THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'INVITE_EXPIRED');
    END IF;

    IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'MAX_USES_REACHED');
    END IF;

    SELECT id, name, purpose, owner_id, expires_at, starts_at, lifecycle_state INTO v_group
    FROM public.groups
    WHERE id = v_invite.group_id;

    IF v_group.id IS NULL OR v_group.lifecycle_state != 'ACTIVE' OR now() >= v_group.expires_at THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'GROUP_EXPIRED');
    END IF;

    SELECT display_name, username, avatar_path INTO v_inviter
    FROM public.profiles
    WHERE user_id = v_invite.created_by;

    SELECT count(*) INTO v_member_count
    FROM public.group_members
    WHERE group_id = v_group.id AND left_at IS NULL;

    IF v_caller_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = v_group.id AND user_id = v_caller_id AND left_at IS NULL
        ) INTO v_is_member;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'group_id', v_group.id,
        'group_name', v_group.name,
        'purpose', v_group.purpose,
        'expires_at', v_group.expires_at,
        'member_count', v_member_count,
        'inviter_name', coalesce(v_inviter.display_name, v_inviter.username, 'Admin'),
        'inviter_avatar', v_inviter.avatar_path,
        'is_already_member', v_is_member
    );
END;
$$;

-- 5. RPC: Join Group via Invitation
CREATE OR REPLACE FUNCTION public.join_group_via_invite(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_invite RECORD;
    v_group RECORD;
    v_is_already_member BOOLEAN;
BEGIN
    v_user_id := (SELECT auth.uid());
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to join group.';
    END IF;

    -- Concurrency-safe row locking
    SELECT * INTO v_invite
    FROM public.group_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Invalid invitation token.';
    END IF;

    IF v_invite.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'This invitation has been revoked.';
    END IF;

    IF now() >= v_invite.expires_at THEN
        RAISE EXCEPTION 'This invitation has expired.';
    END IF;

    IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
        RAISE EXCEPTION 'This invitation has reached its maximum usage limit.';
    END IF;

    SELECT id, name, owner_id, expires_at, lifecycle_state INTO v_group
    FROM public.groups
    WHERE id = v_invite.group_id;

    IF v_group.id IS NULL OR v_group.lifecycle_state != 'ACTIVE' OR now() >= v_group.expires_at THEN
        RAISE EXCEPTION 'Cannot join an inactive or expired group.';
    END IF;

    -- Verify block isolation
    IF public.is_blocked(v_invite.created_by, v_user_id) OR public.is_blocked(v_group.owner_id, v_user_id) THEN
        RAISE EXCEPTION 'Security violation: Cannot join space with blocking restrictions.';
    END IF;

    -- Check if already an active member
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_group.id AND user_id = v_user_id AND left_at IS NULL
    ) INTO v_is_already_member;

    IF v_is_already_member THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_member', true,
            'group_id', v_group.id,
            'group_name', v_group.name
        );
    END IF;

    -- Increment usage atomically
    UPDATE public.group_invitations
    SET uses_count = uses_count + 1
    WHERE id = v_invite.id;

    -- Add membership
    INSERT INTO public.group_members (
        group_id,
        user_id,
        role,
        joined_at
    )
    VALUES (
        v_group.id,
        v_user_id,
        'MEMBER',
        now()
    )
    ON CONFLICT (group_id, user_id) 
    DO UPDATE SET left_at = NULL, role = 'MEMBER', joined_at = now();

    -- Record audit log
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata_json)
    VALUES (
        v_user_id,
        'GROUP_JOINED_VIA_QR',
        'GROUP',
        v_group.id,
        jsonb_build_object(
            'group_id', v_group.id,
            'invite_id', v_invite.id,
            'joined_at', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_member', false,
        'group_id', v_group.id,
        'group_name', v_group.name
    );
END;
$$;

-- 6. RPC: Revoke Group Invitation
CREATE OR REPLACE FUNCTION public.revoke_group_invite(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_invite RECORD;
BEGIN
    v_user_id := (SELECT auth.uid());
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, group_id, created_by INTO v_invite
    FROM public.group_invitations
    WHERE id = p_invite_id;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found.';
    END IF;

    IF NOT (v_invite.created_by = v_user_id OR public.is_group_admin(v_invite.group_id, v_user_id)) THEN
        RAISE EXCEPTION 'Security violation: Only creator or group admin can revoke invitations.';
    END IF;

    UPDATE public.group_invitations
    SET revoked_at = now()
    WHERE id = p_invite_id;

    RETURN TRUE;
END;
$$;

-- Permissions: revoke anon, grant authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.create_group_invite(UUID, TEXT, TIMESTAMPTZ, INT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_invite(UUID, TEXT, TIMESTAMPTZ, INT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.preview_group_invite(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_group_invite(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.join_group_via_invite(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_via_invite(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_group_invite(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_group_invite(UUID) TO authenticated, service_role;

-- 7. Update execute_group_database_purge to scrub invitations
CREATE OR REPLACE FUNCTION public.execute_group_database_purge(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_group RECORD;
BEGIN
    SELECT id, name, owner_id INTO v_group
    FROM public.groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RAISE EXCEPTION 'Group % not found for database purge.', p_group_id;
    END IF;

    -- Dependency-Ordered Deletions:
    -- 1. Ephemeral Location Telemetry
    DELETE FROM public.current_locations 
    WHERE session_id IN (SELECT id FROM public.location_sessions WHERE group_id = p_group_id);

    DELETE FROM public.location_session_participants 
    WHERE session_id IN (SELECT id FROM public.location_sessions WHERE group_id = p_group_id);

    DELETE FROM public.location_sessions 
    WHERE group_id = p_group_id;

    -- 2. Polls, Options & Votes
    DELETE FROM public.poll_votes 
    WHERE poll_id IN (SELECT id FROM public.polls WHERE group_id = p_group_id);

    DELETE FROM public.poll_options 
    WHERE poll_id IN (SELECT id FROM public.polls WHERE group_id = p_group_id);

    DELETE FROM public.polls 
    WHERE group_id = p_group_id;

    -- 3. Tasks & Assignees
    DELETE FROM public.task_assignees 
    WHERE task_id IN (SELECT id FROM public.tasks WHERE group_id = p_group_id);

    DELETE FROM public.tasks 
    WHERE group_id = p_group_id;

    -- 4. Events & Itinerary
    DELETE FROM public.events 
    WHERE group_id = p_group_id;

    -- 5. Messages & Attachments
    DELETE FROM public.message_attachments 
    WHERE message_id IN (SELECT id FROM public.messages WHERE group_id = p_group_id);

    DELETE FROM public.messages 
    WHERE group_id = p_group_id;

    -- 6. Files Metadata (Photos & Voice notes)
    DELETE FROM public.files 
    WHERE group_id = p_group_id;

    -- 7. Group Invitations (Part 11)
    DELETE FROM public.group_invitations 
    WHERE group_id = p_group_id;

    -- 8. Notifications scoped to this group
    DELETE FROM public.notifications 
    WHERE group_id = p_group_id;

    -- 9. Group Features & Members
    DELETE FROM public.group_features 
    WHERE group_id = p_group_id;

    DELETE FROM public.group_members 
    WHERE group_id = p_group_id;

    -- Transition group container to final PURGED state
    UPDATE public.groups
    SET lifecycle_state = 'PURGED',
        cleanup_status = 'COMPLETED',
        cleanup_error = NULL,
        cleaned_at = now(),
        updated_at = now()
    WHERE id = p_group_id;

    -- Immutable audit log entry
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
