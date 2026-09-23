-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 09 - GROUP LIFECYCLE STATE MACHINE & AUTO-DISSOLUTION
-- ==============================================================================

-- Stored procedure executing canonical server-side lifecycle transitions:
-- ACTIVE -> EXPIRING -> EXPIRED -> ARCHIVED -> PURGED
-- 1. Evaluates server now() against starts_at and expires_at.
-- 2. Closes active location sessions upon expiration.
-- 3. Emits in-app notification records for group members.
-- 4. Returns JSON metrics summary of all transitions performed.

CREATE OR REPLACE FUNCTION public.process_group_lifecycle_transitions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_transitioned_expiring INT := 0;
    v_transitioned_expired INT := 0;
    v_transitioned_archived INT := 0;
    v_transitioned_purged INT := 0;
    v_closed_location_sessions INT := 0;
    v_group RECORD;
    v_member RECORD;
BEGIN
    -- 1. Transition ACTIVE -> EXPIRING (within 1 hour or >= 85% elapsed)
    FOR v_group IN
        SELECT id, name, owner_id, starts_at, expires_at
        FROM public.groups
        WHERE lifecycle_state = 'ACTIVE'
          AND (
              (expires_at - v_now) <= interval '1 hour'
              OR (extract(epoch from (v_now - starts_at)) / nullif(extract(epoch from (expires_at - starts_at)), 0)) >= 0.85
          )
          AND v_now < expires_at
    LOOP
        UPDATE public.groups
        SET lifecycle_state = 'EXPIRING',
            updated_at = v_now
        WHERE id = v_group.id;

        v_transitioned_expiring := v_transitioned_expiring + 1;

        -- Dispatch notification to active members if not already notified
        FOR v_member IN
            SELECT user_id FROM public.group_members
            WHERE group_id = v_group.id AND left_at IS NULL
        LOOP
            INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
            SELECT v_member.user_id, 'GROUP_EXPIRING'::public.notification_type, v_group.owner_id, v_group.id,
                   jsonb_build_object('group_name', v_group.name, 'expires_at', v_group.expires_at)
            WHERE NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = v_member.user_id
                  AND group_id = v_group.id
                  AND type = 'GROUP_EXPIRING'
            );
        END LOOP;
    END LOOP;

    -- 2. Transition ACTIVE / EXPIRING / CREATED -> EXPIRED (when v_now >= expires_at)
    FOR v_group IN
        SELECT id, name, owner_id, expires_at
        FROM public.groups
        WHERE lifecycle_state IN ('ACTIVE', 'EXPIRING', 'CREATED')
          AND v_now >= expires_at
    LOOP
        UPDATE public.groups
        SET lifecycle_state = 'EXPIRED',
            updated_at = v_now
        WHERE id = v_group.id;

        v_transitioned_expired := v_transitioned_expired + 1;

        -- Automatically close ongoing active location sessions
        WITH closed_sessions AS (
            UPDATE public.location_sessions
            SET status = 'ENDED',
                ended_at = v_now
            WHERE group_id = v_group.id
              AND status IN ('ACTIVE', 'PAUSED')
            RETURNING id
        )
        SELECT count(*) + v_closed_location_sessions INTO v_closed_location_sessions FROM closed_sessions;

        -- Dispatch notification to active members if not already notified
        FOR v_member IN
            SELECT user_id FROM public.group_members
            WHERE group_id = v_group.id AND left_at IS NULL
        LOOP
            INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
            SELECT v_member.user_id, 'GROUP_EXPIRED'::public.notification_type, v_group.owner_id, v_group.id,
                   jsonb_build_object('group_name', v_group.name, 'expired_at', v_now)
            WHERE NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = v_member.user_id
                  AND group_id = v_group.id
                  AND type = 'GROUP_EXPIRED'
            );
        END LOOP;
    END LOOP;

    -- 3. Transition EXPIRED -> ARCHIVED (7 days post-expiry)
    WITH archived_groups AS (
        UPDATE public.groups
        SET lifecycle_state = 'ARCHIVED',
            updated_at = v_now
        WHERE lifecycle_state = 'EXPIRED'
          AND v_now >= expires_at + interval '7 days'
        RETURNING id
    )
    SELECT count(*) INTO v_transitioned_archived FROM archived_groups;

    -- 4. Transition ARCHIVED -> PURGED (30 days post-expiry)
    WITH purged_groups AS (
        UPDATE public.groups
        SET lifecycle_state = 'PURGED',
            updated_at = v_now
        WHERE lifecycle_state = 'ARCHIVED'
          AND v_now >= expires_at + interval '30 days'
        RETURNING id
    )
    SELECT count(*) INTO v_transitioned_purged FROM purged_groups;

    RETURN jsonb_build_object(
        'transitioned_expiring', v_transitioned_expiring,
        'transitioned_expired', v_transitioned_expired,
        'transitioned_archived', v_transitioned_archived,
        'transitioned_purged', v_transitioned_purged,
        'closed_location_sessions', v_closed_location_sessions,
        'executed_at', v_now
    );
END;
$$;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.process_group_lifecycle_transitions() TO authenticated, service_role;
