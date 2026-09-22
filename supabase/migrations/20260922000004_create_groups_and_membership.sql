-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 04 - GROUPS, MEMBERSHIP & FRIEND ENFORCEMENT
-- ==============================================================================

-- 1. Groups Table
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    purpose public.group_purpose NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    lifecycle_state public.lifecycle_state NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_group_name_length CHECK (
        char_length(trim(name)) >= 1 
        AND char_length(name) <= 80
    ),
    CONSTRAINT chk_group_desc_length CHECK (
        description IS NULL OR char_length(description) <= 500
    ),
    CONSTRAINT chk_group_expiry_ordering CHECK (expires_at > starts_at)
);

CREATE INDEX idx_groups_owner_id ON public.groups (owner_id);
CREATE INDEX idx_groups_lifecycle_expires ON public.groups (lifecycle_state, expires_at);
CREATE INDEX idx_groups_starts_at ON public.groups (starts_at DESC);

-- Updated_at Trigger for Groups
CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

-- 2. Group Members Table
CREATE TABLE public.group_members (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role public.group_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user_active ON public.group_members (user_id) WHERE left_at IS NULL;
CREATE INDEX idx_group_members_group_active ON public.group_members (group_id) WHERE left_at IS NULL;

-- 3. Group Features Table (Module Toggles)
CREATE TABLE public.group_features (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    enabled_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    PRIMARY KEY (group_id, feature_key)
);

CREATE INDEX idx_group_features_group_key ON public.group_features (group_id, feature_key);

-- 4. Core Security & Membership Helper Functions
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id 
          AND user_id = p_user_id 
          AND left_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id 
          AND user_id = p_user_id 
          AND role IN ('OWNER', 'ADMIN')
          AND left_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = p_group_id AND owner_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_active(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = p_group_id
          AND lifecycle_state IN ('CREATED', 'ACTIVE', 'EXPIRING')
          AND now() < expires_at
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_feature_enabled(p_group_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_features
        WHERE group_id = p_group_id AND feature_key = upper(trim(p_feature))
    );
$$;

-- 5. CRITICAL: Friend-Only Group Membership Validation Trigger
CREATE OR REPLACE FUNCTION public.validate_friendship_before_group_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inviter UUID;
    v_owner UUID;
    v_is_admin BOOLEAN;
    v_group_is_active BOOLEAN;
BEGIN
    v_inviter := (SELECT auth.uid());

    -- Retrieve group owner and status
    SELECT owner_id INTO v_owner FROM public.groups WHERE id = NEW.group_id;

    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Group not found.';
    END IF;

    -- Allow superuser / database maintenance when running directly as administrative role without user JWT
    IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND v_inviter IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if group is active
    SELECT public.is_group_active(NEW.group_id) INTO v_group_is_active;
    IF NOT v_group_is_active THEN
        RAISE EXCEPTION 'Security violation: Cannot add members to an expired or inactive group.';
    END IF;

    -- If this is the owner adding themselves (e.g. during group creation or initial trigger), allow
    IF NEW.user_id = v_owner AND (v_inviter IS NULL OR v_inviter = v_owner) THEN
        NEW.role := 'OWNER';
        RETURN NEW;
    END IF;

    -- Must have an authenticated inviter
    IF v_inviter IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Unauthenticated request cannot add group members.';
    END IF;

    -- Inviter MUST be OWNER or ADMIN
    SELECT public.is_group_admin(NEW.group_id, v_inviter) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Security violation: Only group Owner or Admins can invite new members.';
    END IF;

    -- Cannot add self if already member
    IF NEW.user_id = v_inviter THEN
        RAISE EXCEPTION 'User is already the inviter.';
    END IF;

    -- Check active block between inviter and invitee
    IF public.is_blocked(v_inviter, NEW.user_id) THEN
        RAISE EXCEPTION 'Security violation: Cannot invite a blocked user or user who has blocked you.';
    END IF;

    -- CRITICAL LAW: Invitee MUST be an accepted mutual friend of the inviter
    IF NOT public.are_friends(v_inviter, NEW.user_id) THEN
        RAISE EXCEPTION 'Security violation: Group membership requires an existing accepted mutual friendship with the inviter.';
    END IF;

    -- Regular members cannot be inserted with role 'OWNER'
    IF NEW.role = 'OWNER' THEN
        NEW.role := 'MEMBER';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_friend_only_membership
    BEFORE INSERT ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_friendship_before_group_insert();

-- 6. Trigger: Automatic Owner Membership and Default Features on Group Creation
CREATE OR REPLACE FUNCTION public.handle_group_creation_defaults()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- 1. Insert Owner as member with role 'OWNER'
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'OWNER')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'OWNER', left_at = NULL;

    -- 2. Enable default features based on purpose
    INSERT INTO public.group_features (group_id, feature_key, enabled_by)
    VALUES 
        (NEW.id, 'CHAT', NEW.owner_id),
        (NEW.id, 'TASKS', NEW.owner_id),
        (NEW.id, 'FILES', NEW.owner_id),
        (NEW.id, 'EVENTS', NEW.owner_id),
        (NEW.id, 'POLLS', NEW.owner_id),
        (NEW.id, 'LOCATION', NEW.owner_id)
    ON CONFLICT (group_id, feature_key) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_group_creation_defaults
    AFTER INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_group_creation_defaults();

-- 7. Enable Row Level Security
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_features ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies: Groups
-- Members can view groups they belong to, or owners can view groups they created
CREATE POLICY "Members can view their groups"
    ON public.groups
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) = owner_id 
        OR public.is_group_member(id, (SELECT auth.uid()))
    );

-- Any authenticated user can create a group as owner
CREATE POLICY "Authenticated users can create groups"
    ON public.groups
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_id);

-- Only owner can update group configuration (name, description, image, purpose) in active groups
CREATE POLICY "Owner can update active group"
    ON public.groups
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.uid()) = owner_id 
        AND public.is_group_active(id)
    )
    WITH CHECK (
        (SELECT auth.uid()) = owner_id 
        AND public.is_group_active(id)
    );

-- Only owner can delete a group
CREATE POLICY "Owner can delete group"
    ON public.groups
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id);

-- 9. RLS Policies: Group Members
-- Active group members can view the member roster of their group
CREATE POLICY "Members can view group roster"
    ON public.group_members
    FOR SELECT
    TO authenticated
    USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
        OR public.is_group_owner(group_id, (SELECT auth.uid()))
    );

-- Insertion into group_members is guarded by friend check + admin permission
CREATE POLICY "Admins can add accepted friends to active groups"
    ON public.group_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Group must be active
        public.is_group_active(group_id)
        AND (
            -- Case A: Owner adding self
            (user_id = (SELECT auth.uid()) AND public.is_group_owner(group_id, (SELECT auth.uid())))
            OR
            -- Case B: Admin adding mutual friend
            (
                public.is_group_admin(group_id, (SELECT auth.uid()))
                AND public.are_friends((SELECT auth.uid()), user_id)
            )
        )
    );

-- Role updates: Only Owner can promote/demote admins or members
CREATE POLICY "Owner can update member roles"
    ON public.group_members
    FOR UPDATE
    TO authenticated
    USING (
        public.is_group_owner(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_owner(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

-- Removal: Member can leave (soft delete), Owner can remove any member, Admin can remove normal members
CREATE POLICY "Authorized removal or self departure"
    ON public.group_members
    FOR DELETE
    TO authenticated
    USING (
        -- Self departure (leave group)
        (user_id = (SELECT auth.uid()) AND role <> 'OWNER')
        OR
        -- Owner removing someone
        (public.is_group_owner(group_id, (SELECT auth.uid())) AND user_id <> (SELECT auth.uid()))
        OR
        -- Admin removing standard member
        (public.is_group_admin(group_id, (SELECT auth.uid())) AND role = 'MEMBER')
    );

-- 10. RLS Policies: Group Features
CREATE POLICY "Members can view enabled features"
    ON public.group_features
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Owner can toggle group features in active groups"
    ON public.group_features
    FOR ALL
    TO authenticated
    USING (
        public.is_group_owner(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_owner(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );
