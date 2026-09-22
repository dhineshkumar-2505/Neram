-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 02 - PROFILES & USER DEVICES
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_path TEXT,
    dob DATE,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_username_format CHECK (
        char_length(username) >= 3 
        AND char_length(username) <= 20 
        AND username ~ '^[a-z0-9_]+$'
    ),
    CONSTRAINT chk_display_name_length CHECK (
        char_length(trim(display_name)) >= 1 
        AND char_length(display_name) <= 50
    ),
    CONSTRAINT chk_bio_length CHECK (
        bio IS NULL OR char_length(bio) <= 160
    )
);

-- Indexes on Profiles
CREATE UNIQUE INDEX idx_profiles_lower_username ON public.profiles (lower(username));
CREATE INDEX idx_profiles_created_at ON public.profiles (created_at DESC);

-- Updated_at Trigger for Profiles
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

-- 2. Automatic Profile Creation Function & Trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_base_username TEXT;
    v_unique_username TEXT;
    v_display_name TEXT;
    v_counter INT := 0;
BEGIN
    -- Extract display name from metadata or default to Member
    v_display_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
        'Member'
    );

    -- Generate a clean base username from metadata, email prefix, or user UUID
    v_base_username := lower(regexp_replace(
        COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data->>'preferred_username'), ''),
            NULLIF(split_part(NEW.email, '@', 1), ''),
            'user'
        ),
        '[^a-z0-9_]',
        '',
        'g'
    ));

    -- Enforce minimum length constraint
    IF char_length(v_base_username) < 3 THEN
        v_base_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
    ELSIF char_length(v_base_username) > 15 THEN
        v_base_username := substr(v_base_username, 1, 15);
    END IF;

    v_unique_username := v_base_username;

    -- Ensure username uniqueness
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_unique_username)) LOOP
        v_counter := v_counter + 1;
        v_unique_username := substr(v_base_username, 1, 14) || '_' || v_counter::text;
    END LOOP;

    -- Insert new profile row
    INSERT INTO public.profiles (user_id, username, display_name, avatar_path)
    VALUES (
        NEW.id,
        v_unique_username,
        v_display_name,
        NEW.raw_user_meta_data->>'avatar_url'
    );

    RETURN NEW;
END;
$$;

-- Bind Trigger to auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Exact Username Search RPC (No Fuzzy Matching)
CREATE OR REPLACE FUNCTION public.search_exact_username(p_username TEXT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_path TEXT,
    bio TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT 
        p.user_id,
        p.username,
        p.display_name,
        p.avatar_path,
        p.bio
    FROM public.profiles p
    WHERE lower(p.username) = lower(trim(regexp_replace(p_username, '^@', '')))
    LIMIT 1;
$$;

-- 4. User Devices Table
CREATE TABLE public.user_devices (
    device_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('IOS', 'ANDROID')),
    push_token TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on User Devices
CREATE INDEX idx_user_devices_user_id ON public.user_devices (user_id);

-- 5. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Profiles
-- Any authenticated user can read public profile cards
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 7. RLS Policies: User Devices
-- Users can only view their own registered devices
CREATE POLICY "Users can view own devices"
    ON public.user_devices
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Users can register or update their own devices
CREATE POLICY "Users can insert own devices"
    ON public.user_devices
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own devices"
    ON public.user_devices
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own devices"
    ON public.user_devices
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
