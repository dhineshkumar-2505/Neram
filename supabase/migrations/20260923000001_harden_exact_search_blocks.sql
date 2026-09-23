-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 09 - HARDEN EXACT USERNAME SEARCH (BLOCK ISOLATION)
-- ==============================================================================

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
      AND ((SELECT auth.uid()) IS NULL OR NOT public.is_blocked((SELECT auth.uid()), p.user_id))
    LIMIT 1;
$$;
