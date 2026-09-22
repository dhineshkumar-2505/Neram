-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 06 - LOCATION, NOTIFICATIONS & AUDIT LOGS
-- ==============================================================================

-- 1. Location Sessions Table
CREATE TABLE public.location_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL CONSTRAINT chk_session_dest_lat CHECK (destination_lat BETWEEN -90 AND 90),
    destination_lng DOUBLE PRECISION NOT NULL CONSTRAINT chk_session_dest_lng CHECK (destination_lng BETWEEN -180 AND 180),
    status public.location_session_status NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT chk_session_window CHECK (ends_at > starts_at)
);

CREATE INDEX idx_location_sessions_group_status ON public.location_sessions (group_id, status);
CREATE INDEX idx_location_sessions_user_status ON public.location_sessions (user_id, status);

-- Trigger: Validate Location Session Preconditions
CREATE OR REPLACE FUNCTION public.validate_location_session_preconditions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_group_active(NEW.group_id) THEN
        RAISE EXCEPTION 'Security violation: Cannot create a location session for an inactive or expired group.';
    END IF;

    IF NOT public.is_group_feature_enabled(NEW.group_id, 'LOCATION') THEN
        RAISE EXCEPTION 'Security violation: LOCATION feature is not enabled for this group.';
    END IF;

    IF NOT public.is_group_member(NEW.group_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Security violation: User is not an active member of this group.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_location_session
    BEFORE INSERT ON public.location_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_location_session_preconditions();

-- 2. Current Locations Table (EPHEMERAL - Strictly 1 Fix per Active Session)
-- CRITICAL PRIVACY: Never store GPS breadcrumbs or raw location history
CREATE TABLE public.current_locations (
    session_id UUID PRIMARY KEY REFERENCES public.location_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CONSTRAINT chk_loc_lat CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CONSTRAINT chk_loc_lng CHECK (longitude BETWEEN -180 AND 180),
    accuracy REAL NOT NULL,
    speed REAL,
    heading REAL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_current_locations_user_id ON public.current_locations (user_id);
CREATE INDEX idx_current_locations_recorded_at ON public.current_locations (recorded_at DESC);

-- 3. Notifications Table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    actor_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_read_created ON public.notifications (user_id, read_at, created_at DESC);

-- 4. Audit Logs Table (Security & Administrative Event Trail)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

-- 5. Enable Row Level Security
ALTER TABLE public.location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Location Sessions
CREATE POLICY "Members can view active location sessions in their groups"
    ON public.location_sessions
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can start location sessions for themselves in active groups"
    ON public.location_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'LOCATION')
    );

CREATE POLICY "Users can update their own location session"
    ON public.location_sessions
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 7. RLS Policies: Current Locations (Strict Privacy Enforcement)
CREATE POLICY "Active group members can view live location of active sessions"
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

CREATE POLICY "Users can update their own current location during active session"
    ON public.current_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND ls.user_id = (SELECT auth.uid())
              AND ls.status = 'ACTIVE'
              AND now() < ls.ends_at
              AND public.is_group_active(ls.group_id)
        )
    );

CREATE POLICY "Users can modify their own current location during active session"
    ON public.current_locations
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND ls.user_id = (SELECT auth.uid())
              AND ls.status = 'ACTIVE'
              AND now() < ls.ends_at
              AND public.is_group_active(ls.group_id)
        )
    )
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND ls.user_id = (SELECT auth.uid())
              AND ls.status = 'ACTIVE'
              AND now() < ls.ends_at
              AND public.is_group_active(ls.group_id)
        )
    );

CREATE POLICY "Users can delete their own current location on session end"
    ON public.current_locations
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- 8. RLS Policies: Notifications
CREATE POLICY "Users can only view their own notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can only update read status on their own notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- 9. RLS Policies: Audit Logs
CREATE POLICY "Group owners and admins can view audit logs for their groups"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        (actor_id = (SELECT auth.uid()))
        OR (
            resource_type = 'groups' 
            AND public.is_group_admin(resource_id, (SELECT auth.uid()))
        )
    );

-- 10. Enable Supabase Realtime for Active Collaboration Tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
