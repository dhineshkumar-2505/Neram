-- ============================================================================
-- Neram Database Security & Integrity Test Suite
-- ============================================================================
-- This test suite validates all 16 security-critical requirements defined in
-- STEP 3 and SECURITY_PLAN.md:
--
--  1. Anonymous access rejected
--  2. User cannot access another user's private data
--  3. Non-friend cannot be added to a group (Trigger/RLS)
--  4. Member cannot invite users (Trigger/RLS)
--  5. Admin can invite accepted friend (Allowed)
--  6. Owner can invite accepted friend (Allowed)
--  7. Expired group rejects writes (RLS)
--  8. Non-member cannot read group messages (RLS)
--  9. Non-member cannot read group location (RLS)
-- 10. User cannot modify another user's notifications (RLS)
-- 11. Duplicate friendship rejected (Unique Constraint)
-- 12. Duplicate group membership rejected (Unique Constraint)
-- 13. Duplicate task assignment rejected (Unique Constraint)
-- 14. Duplicate single-vote poll vote rejected (Unique Index)
-- 15. Invalid expiry rejected (Check Constraint)
-- 16. Blocked relationships cannot bypass authorization
-- ============================================================================

DO $$
DECLARE
  v_test_owner_id UUID := '11111111-1111-1111-1111-111111111111';
  v_test_admin_id UUID := '22222222-2222-2222-2222-222222222222';
  v_test_member_id UUID := '33333333-3333-3333-3333-333333333333';
  v_test_friend_id UUID := '44444444-4444-4444-4444-444444444444';
  v_test_stranger_id UUID := '55555555-5555-5555-5555-555555555555';
  v_test_blocked_id UUID := '66666666-6666-6666-6666-666666666666';

  v_active_group_id UUID;
  v_expired_group_id UUID;
  v_task_id UUID;
  v_poll_id UUID;
  v_option_1_id UUID;
  v_option_2_id UUID;
  v_session_id UUID;
  v_notif_id UUID;

  v_count INT;
  v_count_2 INT;
  v_err_caught BOOLEAN;
  v_low UUID;
  v_high UUID;
BEGIN
  -- Create temporary table to record test outcomes
  CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_num INT,
    test_name TEXT,
    status TEXT,
    details TEXT
  ) ON COMMIT DROP;

  GRANT ALL ON test_results TO authenticated, anon, public;

  -- --------------------------------------------------------------------------
  -- SETUP FIXTURES (Running as administrative postgres role)
  -- --------------------------------------------------------------------------
  DELETE FROM auth.users WHERE id IN (
    v_test_owner_id, v_test_admin_id, v_test_member_id,
    v_test_friend_id, v_test_stranger_id, v_test_blocked_id
  );

  -- 1. Create auth users (triggers will auto-create profiles)
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (v_test_owner_id, 'owner@neram.test', jsonb_build_object('username', 'owner_user', 'display_name', 'Group Owner')),
    (v_test_admin_id, 'admin@neram.test', jsonb_build_object('username', 'admin_user', 'display_name', 'Group Admin')),
    (v_test_member_id, 'member@neram.test', jsonb_build_object('username', 'member_user', 'display_name', 'Group Member')),
    (v_test_friend_id, 'friend@neram.test', jsonb_build_object('username', 'friend_user', 'display_name', 'Accepted Friend')),
    (v_test_stranger_id, 'stranger@neram.test', jsonb_build_object('username', 'stranger_user', 'display_name', 'Stranger User')),
    (v_test_blocked_id, 'blocked@neram.test', jsonb_build_object('username', 'blocked_user', 'display_name', 'Blocked User'));

  -- 2. Establish Friendship: Owner <-> Friend
  IF v_test_owner_id < v_test_friend_id THEN
    v_low := v_test_owner_id; v_high := v_test_friend_id;
  ELSE
    v_low := v_test_friend_id; v_high := v_test_owner_id;
  END IF;
  INSERT INTO public.friendships (user_low_id, user_high_id) VALUES (v_low, v_high);

  -- 3. Establish Friendship: Admin <-> Friend
  IF v_test_admin_id < v_test_friend_id THEN
    v_low := v_test_admin_id; v_high := v_test_friend_id;
  ELSE
    v_low := v_test_friend_id; v_high := v_test_admin_id;
  END IF;
  INSERT INTO public.friendships (user_low_id, user_high_id) VALUES (v_low, v_high);

  -- 4. Establish Block: Owner blocks Blocked User
  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (v_test_owner_id, v_test_blocked_id);

  -- 5. Create Active Group (Owner is creator, auto-added as OWNER by trigger)
  INSERT INTO public.groups (owner_id, name, purpose, starts_at, expires_at, lifecycle_state)
  VALUES (v_test_owner_id, 'Active Trip Group', 'TRIP', now() - interval '1 hour', now() + interval '5 hours', 'ACTIVE')
  RETURNING id INTO v_active_group_id;

  -- Add Admin and Member directly for testing fixture setup (running as postgres without JWT)
  INSERT INTO public.group_members (group_id, user_id, role) VALUES
    (v_active_group_id, v_test_admin_id, 'ADMIN'),
    (v_active_group_id, v_test_member_id, 'MEMBER');

  -- 6. Create Expired Group
  INSERT INTO public.groups (owner_id, name, purpose, starts_at, expires_at, lifecycle_state)
  VALUES (v_test_owner_id, 'Expired Hackathon', 'HACKATHON', now() - interval '10 hours', now() - interval '1 hour', 'EXPIRED')
  RETURNING id INTO v_expired_group_id;

  -- 7. Create a task in active group
  INSERT INTO public.tasks (group_id, creator_id, title, priority, status)
  VALUES (v_active_group_id, v_test_owner_id, 'Test Packing', 'HIGH', 'IN_PROGRESS')
  RETURNING id INTO v_task_id;

  -- 8. Create a poll in active group
  INSERT INTO public.polls (group_id, creator_id, question)
  VALUES (v_active_group_id, v_test_owner_id, 'Dinner choice?')
  RETURNING id INTO v_poll_id;

  INSERT INTO public.poll_options (poll_id, option_text, sort_order) VALUES
    (v_poll_id, 'Pizza', 1) RETURNING id INTO v_option_1_id;
  INSERT INTO public.poll_options (poll_id, option_text, sort_order) VALUES
    (v_poll_id, 'Sushi', 2) RETURNING id INTO v_option_2_id;

  -- 9. Create a location session
  INSERT INTO public.location_sessions (group_id, user_id, destination_lat, destination_lng, starts_at, ends_at, status)
  VALUES (v_active_group_id, v_test_owner_id, 13.0827, 80.2707, now(), now() + interval '1 hour', 'ACTIVE')
  RETURNING id INTO v_session_id;

  INSERT INTO public.current_locations (session_id, user_id, latitude, longitude, accuracy)
  VALUES (v_session_id, v_test_owner_id, 13.0827, 80.2707, 5.0);

  -- 10. Create a private notification for Owner
  INSERT INTO public.notifications (user_id, type, payload_json)
  VALUES (v_test_owner_id, 'GROUP_INVITE', '{"msg": "secret"}'::jsonb)
  RETURNING id INTO v_notif_id;

  -- Add device for Owner
  INSERT INTO public.user_devices (user_id, device_id, platform, push_token)
  VALUES (v_test_owner_id, 'device_owner_abc', 'IOS', 'token_123');

  -- ==========================================================================
  -- TEST 1: Anonymous access rejected
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    INSERT INTO public.messages (group_id, sender_id, body)
    VALUES (v_active_group_id, v_test_stranger_id, 'Hacked message');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (1, 'Anonymous access rejected', 'PASSED', 'Unauthenticated write properly rejected');
  ELSE
    INSERT INTO test_results VALUES (1, 'Anonymous access rejected', 'FAILED', 'Anon write was unexpectedly permitted');
  END IF;

  -- ==========================================================================
  -- TEST 2: User cannot access another user private data
  -- ==========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_stranger_id::text, true);
  
  SELECT COUNT(*) INTO v_count FROM public.user_devices WHERE user_id = v_test_owner_id;
  SELECT COUNT(*) INTO v_count_2 FROM public.notifications WHERE user_id = v_test_owner_id;
  RESET ROLE;

  IF v_count = 0 AND v_count_2 = 0 THEN
    INSERT INTO test_results VALUES (2, 'User cannot access another user private data', 'PASSED', '0 private rows visible to stranger');
  ELSE
    INSERT INTO test_results VALUES (2, 'User cannot access another user private data', 'FAILED', 'Private data leaked across users');
  END IF;

  -- ==========================================================================
  -- TEST 3: Non-friend cannot be added to a group (by Owner)
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_owner_id::text, true);
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_stranger_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (3, 'Non-friend cannot be added to a group', 'PASSED', 'Trigger/RLS rejected non-friend invitation');
  ELSE
    INSERT INTO test_results VALUES (3, 'Non-friend cannot be added to a group', 'FAILED', 'Non-friend was illegally added to group');
  END IF;

  -- ==========================================================================
  -- TEST 4: Member cannot invite users
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_member_id::text, true);
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_friend_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (4, 'Member cannot invite users', 'PASSED', 'Standard MEMBER blocked from adding members');
  ELSE
    INSERT INTO test_results VALUES (4, 'Member cannot invite users', 'FAILED', 'Standard MEMBER illegally added a member');
  END IF;

  -- ==========================================================================
  -- TEST 5: Admin can invite accepted friend
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_admin_id::text, true);
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_friend_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF NOT v_err_caught THEN
    INSERT INTO test_results VALUES (5, 'Admin can invite accepted friend', 'PASSED', 'ADMIN successfully invited accepted friend');
    DELETE FROM public.group_members WHERE group_id = v_active_group_id AND user_id = v_test_friend_id;
  ELSE
    INSERT INTO test_results VALUES (5, 'Admin can invite accepted friend', 'FAILED', 'ADMIN friend invitation failed unexpectedly');
  END IF;

  -- ==========================================================================
  -- TEST 6: Owner can invite accepted friend
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_owner_id::text, true);
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_friend_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF NOT v_err_caught THEN
    INSERT INTO test_results VALUES (6, 'Owner can invite accepted friend', 'PASSED', 'OWNER successfully invited accepted friend');
  ELSE
    INSERT INTO test_results VALUES (6, 'Owner can invite accepted friend', 'FAILED', 'OWNER friend invitation failed unexpectedly');
  END IF;

  -- ==========================================================================
  -- TEST 7: Expired group rejects writes
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_owner_id::text, true);
    INSERT INTO public.messages (group_id, sender_id, body)
    VALUES (v_expired_group_id, v_test_owner_id, 'Post-expiry message');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (7, 'Expired group rejects writes', 'PASSED', 'Message write to EXPIRED group blocked by RLS');
  ELSE
    INSERT INTO test_results VALUES (7, 'Expired group rejects writes', 'FAILED', 'Message write to EXPIRED group was permitted');
  END IF;

  -- ==========================================================================
  -- TEST 8: Non-member cannot read group messages
  -- ==========================================================================
  INSERT INTO public.messages (group_id, sender_id, body)
  VALUES (v_active_group_id, v_test_owner_id, 'Secret group message');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_stranger_id::text, true);
  SELECT COUNT(*) INTO v_count FROM public.messages WHERE group_id = v_active_group_id;
  RESET ROLE;
  IF v_count = 0 THEN
    INSERT INTO test_results VALUES (8, 'Non-member cannot read group messages', 'PASSED', 'Stranger sees 0 messages in private group');
  ELSE
    INSERT INTO test_results VALUES (8, 'Non-member cannot read group messages', 'FAILED', 'Group messages leaked to non-member');
  END IF;

  -- ==========================================================================
  -- TEST 9: Non-member cannot read group location
  -- ==========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_stranger_id::text, true);
  SELECT COUNT(*) INTO v_count FROM public.current_locations WHERE session_id = v_session_id;
  RESET ROLE;
  IF v_count = 0 THEN
    INSERT INTO test_results VALUES (9, 'Non-member cannot read group location', 'PASSED', 'Current location hidden from non-members');
  ELSE
    INSERT INTO test_results VALUES (9, 'Non-member cannot read group location', 'FAILED', 'Current location leaked to non-member');
  END IF;

  -- ==========================================================================
  -- TEST 10: User cannot modify another user notifications
  -- ==========================================================================
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_stranger_id::text, true);
  UPDATE public.notifications SET read_at = now() WHERE id = v_notif_id;
  RESET ROLE;
  SELECT COUNT(*) INTO v_count FROM public.notifications WHERE id = v_notif_id AND read_at IS NOT NULL;
  IF v_count = 0 THEN
    INSERT INTO test_results VALUES (10, 'User cannot modify another user notifications', 'PASSED', 'Unauthorized notification update ignored');
  ELSE
    INSERT INTO test_results VALUES (10, 'User cannot modify another user notifications', 'FAILED', 'Stranger updated another user notification');
  END IF;

  -- ==========================================================================
  -- TEST 11: Duplicate friendship rejected
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    IF v_test_owner_id < v_test_friend_id THEN
      v_low := v_test_owner_id; v_high := v_test_friend_id;
    ELSE
      v_low := v_test_friend_id; v_high := v_test_owner_id;
    END IF;
    INSERT INTO public.friendships (user_low_id, user_high_id) VALUES (v_low, v_high);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (11, 'Duplicate friendship rejected', 'PASSED', 'Unique canonical friendship constraint enforced');
  ELSE
    INSERT INTO test_results VALUES (11, 'Duplicate friendship rejected', 'FAILED', 'Duplicate friendship was inserted');
  END IF;

  -- ==========================================================================
  -- TEST 12: Duplicate group membership rejected
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_owner_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (12, 'Duplicate group membership rejected', 'PASSED', 'Primary key prevents duplicate membership');
  ELSE
    INSERT INTO test_results VALUES (12, 'Duplicate group membership rejected', 'FAILED', 'Duplicate membership was allowed');
  END IF;

  -- ==========================================================================
  -- TEST 13: Duplicate task assignment rejected
  -- ==========================================================================
  INSERT INTO public.task_assignees (task_id, user_id) VALUES (v_task_id, v_test_member_id);
  v_err_caught := false;
  BEGIN
    INSERT INTO public.task_assignees (task_id, user_id) VALUES (v_task_id, v_test_member_id);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (13, 'Duplicate task assignment rejected', 'PASSED', 'Primary key prevents duplicate task assignees');
  ELSE
    INSERT INTO test_results VALUES (13, 'Duplicate task assignment rejected', 'FAILED', 'Duplicate assignment allowed');
  END IF;

  -- ==========================================================================
  -- TEST 14: Duplicate single-vote poll vote rejected
  -- ==========================================================================
  INSERT INTO public.poll_votes (poll_id, option_id, user_id) VALUES (v_poll_id, v_option_1_id, v_test_member_id);
  v_err_caught := false;
  BEGIN
    INSERT INTO public.poll_votes (poll_id, option_id, user_id) VALUES (v_poll_id, v_option_2_id, v_test_member_id);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (14, 'Duplicate single-vote poll vote rejected', 'PASSED', 'Unique poll-user vote index enforced single vote');
  ELSE
    INSERT INTO test_results VALUES (14, 'Duplicate single-vote poll vote rejected', 'FAILED', 'User was able to vote twice in single-vote poll');
  END IF;

  -- ==========================================================================
  -- TEST 15: Invalid expiry rejected
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    INSERT INTO public.groups (owner_id, name, purpose, starts_at, expires_at)
    VALUES (v_test_owner_id, 'Time Paradox Group', 'OUTING', now(), now() - interval '1 hour');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF v_err_caught THEN
    INSERT INTO test_results VALUES (15, 'Invalid expiry rejected', 'PASSED', 'Check constraint chk_groups_valid_lifetime enforced');
  ELSE
    INSERT INTO test_results VALUES (15, 'Invalid expiry rejected', 'FAILED', 'expires_at < starts_at was permitted');
  END IF;

  -- ==========================================================================
  -- TEST 16: Blocked relationships cannot bypass authorization
  -- ==========================================================================
  v_err_caught := false;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_test_owner_id::text, true);
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_active_group_id, v_test_blocked_id, 'MEMBER');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  RESET ROLE;
  IF v_err_caught AND public.is_blocked(v_test_owner_id, v_test_blocked_id) THEN
    INSERT INTO test_results VALUES (16, 'Blocked relationships cannot bypass authorization', 'PASSED', 'Blocked relationship recognized & group add blocked');
  ELSE
    INSERT INTO test_results VALUES (16, 'Blocked relationships cannot bypass authorization', 'FAILED', 'Blocked relationship was bypassed');
  END IF;

  -- Clean up test fixtures
  DELETE FROM public.groups WHERE id IN (v_active_group_id, v_expired_group_id);
  DELETE FROM auth.users WHERE id IN (
    v_test_owner_id, v_test_admin_id, v_test_member_id,
    v_test_friend_id, v_test_stranger_id, v_test_blocked_id
  );
END $$;

SELECT test_num, test_name, status, details FROM test_results ORDER BY test_num;
