-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 08 - LOCATION SESSION ARCHITECTURE & PARTICIPANTS
-- ==============================================================================
-- 1. Enhances public.location_sessions with lifecycle, metadata & single-active-session invariant.
-- 2. Creates public.location_session_participants for explicit opt-in sharing.
-- 3. Reconfigures public.current_locations composite primary key (session_id, user_id).
-- 4. Installs automatic coordinate purge triggers upon session end & participant leave.
-- 5. Implements zero-trust Row Level Security (RLS) preventing IDOR and unauthorized tracking.
-- 6. Adds location_sessions and location_session_participants to supabase_realtime.

-- 1. Enhance location_sessions
ALTER TABLE public.location_sessions
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Group Outing',
    ADD COLUMN IF NOT EXISTS destination_name TEXT,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.location_sessions
SET created_by = user_id
WHERE created_by IS NULL;

-- Enforce at most ONE active location session per group
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_location_session_per_group
    ON public.location_sessions (group_id)
    WHERE status = 'ACTIVE';

-- 2. Create location_session_participants
CREATE TABLE IF NOT EXISTS public.location_session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.location_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CONSTRAINT chk_participant_status CHECK (status IN ('ACTIVE', 'LEFT', 'ARRIVED')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    CONSTRAINT uq_session_participant UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.location_session_participants (session_id, status);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON public.location_session_participants (user_id);

-- 3. Reconfigure current_locations with composite primary key (session_id, user_id)
ALTER TABLE public.current_locations DROP CONSTRAINT IF EXISTS current_locations_pkey;
ALTER TABLE public.current_locations ADD CONSTRAINT current_locations_pkey PRIMARY KEY (session_id, user_id);

ALTER TABLE public.current_locations DROP CONSTRAINT IF EXISTS chk_loc_acc;
ALTER TABLE public.current_locations ADD CONSTRAINT chk_loc_acc CHECK (accuracy >= 0);

-- 4. Ephemeral Coordinate Purge Triggers
-- A. Trigger when session ends: delete current locations and mark participants left
CREATE OR REPLACE FUNCTION public.cleanup_locations_on_session_ended()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'ENDED' AND OLD.status != 'ENDED' THEN
        DELETE FROM public.current_locations WHERE session_id = NEW.id;
        UPDATE public.location_session_participants
        SET status = 'LEFT', left_at = now()
        WHERE session_id = NEW.id AND status = 'ACTIVE';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_locations_on_session_ended ON public.location_sessions;
CREATE TRIGGER trg_cleanup_locations_on_session_ended
    AFTER UPDATE OF status ON public.location_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_locations_on_session_ended();

-- B. Trigger when participant leaves: delete their current location immediately
CREATE OR REPLACE FUNCTION public.cleanup_location_on_participant_leave()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'LEFT' AND OLD.status != 'LEFT') THEN
        DELETE FROM public.current_locations
        WHERE session_id = NEW.session_id AND user_id = NEW.user_id;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public.current_locations
        WHERE session_id = OLD.session_id AND user_id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_location_on_participant_leave ON public.location_session_participants;
CREATE TRIGGER trg_cleanup_location_on_participant_leave
    AFTER UPDATE OF status OR DELETE ON public.location_session_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_location_on_participant_leave();

-- 5. Row Level Security Policies
ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_locations ENABLE ROW LEVEL SECURITY;

-- Drop obsolete policies
DROP POLICY IF EXISTS "Members can view active location sessions in their groups" ON public.location_sessions;
DROP POLICY IF EXISTS "Members can start location sessions for themselves in active gr" ON public.location_sessions;
DROP POLICY IF EXISTS "Users can update their own location session" ON public.location_sessions;
DROP POLICY IF EXISTS "Members can view location sessions in their groups" ON public.location_sessions;
DROP POLICY IF EXISTS "Members can start location sessions in active groups with feature enabled" ON public.location_sessions;
DROP POLICY IF EXISTS "Session creator or group admin can update location session" ON public.location_sessions;

DROP POLICY IF EXISTS "Active group members can view live location of active sessions" ON public.current_locations;
DROP POLICY IF EXISTS "Users can update their own current location during active sessi" ON public.current_locations;
DROP POLICY IF EXISTS "Users can modify their own current location during active sessi" ON public.current_locations;
DROP POLICY IF EXISTS "Users can delete their own current location on session end" ON public.current_locations;
DROP POLICY IF EXISTS "Active group members can view live location fixes" ON public.current_locations;
DROP POLICY IF EXISTS "Active participants can insert their own location fix" ON public.current_locations;
DROP POLICY IF EXISTS "Active participants can update their own location fix" ON public.current_locations;
DROP POLICY IF EXISTS "Users can delete their own location fix" ON public.current_locations;

DROP POLICY IF EXISTS "Group members can view session participants" ON public.location_session_participants;
DROP POLICY IF EXISTS "Users can join active location session in active group" ON public.location_session_participants;
DROP POLICY IF EXISTS "Users or admins can update participation status" ON public.location_session_participants;
DROP POLICY IF EXISTS "Users can delete their own participation record" ON public.location_session_participants;

-- A. location_sessions policies
CREATE POLICY "Members can view location sessions in their groups"
    ON public.location_sessions
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can start location sessions in active groups with feature enabled"
    ON public.location_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        ((SELECT auth.uid()) = coalesce(created_by, user_id))
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'LOCATION')
    );

CREATE POLICY "Session creator or group admin can update location session"
    ON public.location_sessions
    FOR UPDATE
    TO authenticated
    USING (
        (coalesce(created_by, user_id) = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        (coalesce(created_by, user_id) = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );

-- B. location_session_participants policies
CREATE POLICY "Group members can view session participants"
    ON public.location_session_participants
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = location_session_participants.session_id
              AND public.is_group_member(ls.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Users can join active location session in active group"
    ON public.location_session_participants
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = location_session_participants.session_id
              AND ls.status = 'ACTIVE'
              AND public.is_group_active(ls.group_id)
              AND public.is_group_member(ls.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Users or admins can update participation status"
    ON public.location_session_participants
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = location_session_participants.session_id
              AND public.is_group_admin(ls.group_id, (SELECT auth.uid()))
        )
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = location_session_participants.session_id
              AND public.is_group_admin(ls.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Users can delete their own participation record"
    ON public.location_session_participants
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- C. current_locations policies
CREATE POLICY "Active group members can view live location fixes"
    ON public.current_locations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND ls.status = 'ACTIVE'
              AND public.is_group_member(ls.group_id, (SELECT auth.uid()))
              AND public.is_group_active(ls.group_id)
        )
    );

CREATE POLICY "Active participants can insert their own location fix"
    ON public.current_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.location_session_participants p
            JOIN public.location_sessions ls ON ls.id = p.session_id
            WHERE p.session_id = current_locations.session_id
              AND p.user_id = (SELECT auth.uid())
              AND p.status = 'ACTIVE'
              AND ls.status = 'ACTIVE'
              AND public.is_group_active(ls.group_id)
        )
    );

CREATE POLICY "Active participants can update their own location fix"
    ON public.current_locations
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.location_session_participants p
            JOIN public.location_sessions ls ON ls.id = p.session_id
            WHERE p.session_id = current_locations.session_id
              AND p.user_id = (SELECT auth.uid())
              AND p.status = 'ACTIVE'
              AND ls.status = 'ACTIVE'
              AND public.is_group_active(ls.group_id)
        )
    )
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.location_session_participants p
            JOIN public.location_sessions ls ON ls.id = p.session_id
            WHERE p.session_id = current_locations.session_id
              AND p.user_id = (SELECT auth.uid())
              AND p.status = 'ACTIVE'
              AND ls.status = 'ACTIVE'
              AND public.is_group_active(ls.group_id)
        )
    );

CREATE POLICY "Users can delete their own location fix"
    ON public.current_locations
    FOR DELETE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND (coalesce(ls.created_by, ls.user_id) = (SELECT auth.uid()) OR public.is_group_admin(ls.group_id, (SELECT auth.uid())))
        )
    );

-- 6. Add to Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'location_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.location_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'location_session_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.location_session_participants;
    END IF;
END $$;
