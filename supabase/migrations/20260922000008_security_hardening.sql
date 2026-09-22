-- Migration: 20260922000008_security_hardening.sql
-- Description: Revoke public/anon execute privileges on SECURITY DEFINER functions,
-- restrict trigger functions from RPC exposure, and grant least-privilege execute to authenticated.

-- 1. Revoke default PUBLIC and anon execution on all custom functions
REVOKE EXECUTE ON FUNCTION public.trigger_set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_exact_username(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalize_friendship_pair() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_feature_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_group_creation_defaults() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_friendship_before_group_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_task_assignee_membership() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_location_session_preconditions() FROM PUBLIC, anon;

-- 2. Revoke execute on trigger functions from authenticated (they should never be called via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;

-- 3. Grant execute to authenticated users on legitimate RPCs and RLS helpers
GRANT EXECUTE ON FUNCTION public.search_exact_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_feature_enabled(uuid, text) TO authenticated;
