-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 10 - NOTIFICATION TRIGGERS
-- Automates in-app notification records for friend requests and group invitations.
-- ==============================================================================

-- 1. Friend Request Notification Trigger Function
CREATE OR REPLACE FUNCTION public.handle_friend_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Case A: New pending friend request
    IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
        INSERT INTO public.notifications (user_id, type, actor_id, payload_json)
        SELECT NEW.receiver_id, 'FRIEND_REQUEST'::public.notification_type, NEW.sender_id,
               jsonb_build_object('request_id', NEW.id, 'sender_id', NEW.sender_id)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = NEW.receiver_id
              AND type = 'FRIEND_REQUEST'
              AND actor_id = NEW.sender_id
              AND (payload_json->>'request_id')::uuid = NEW.id
        );
    END IF;

    -- Case B: Friend request accepted
    IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
        INSERT INTO public.notifications (user_id, type, actor_id, payload_json)
        SELECT NEW.sender_id, 'FRIEND_ACCEPTED'::public.notification_type, NEW.receiver_id,
               jsonb_build_object('request_id', NEW.id, 'receiver_id', NEW.receiver_id)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = NEW.sender_id
              AND type = 'FRIEND_ACCEPTED'
              AND actor_id = NEW.receiver_id
              AND (payload_json->>'request_id')::uuid = NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_request_notifications ON public.friend_requests;
CREATE TRIGGER trg_friend_request_notifications
    AFTER INSERT OR UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friend_request_notification();

-- 2. Group Invitation Notification Trigger Function
CREATE OR REPLACE FUNCTION public.handle_group_invite_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_owner_id UUID;
    v_group_name TEXT;
BEGIN
    -- Only trigger for newly added members who are not the group owner
    IF NEW.role <> 'OWNER' THEN
        SELECT owner_id, name INTO v_owner_id, v_group_name
        FROM public.groups
        WHERE id = NEW.group_id;

        IF v_owner_id IS NOT NULL AND v_owner_id <> NEW.user_id THEN
            INSERT INTO public.notifications (user_id, type, actor_id, group_id, payload_json)
            SELECT NEW.user_id, 'GROUP_INVITE'::public.notification_type, v_owner_id, NEW.group_id,
                   jsonb_build_object('group_id', NEW.group_id, 'group_name', v_group_name)
            WHERE NOT EXISTS (
                SELECT 1 FROM public.notifications
                WHERE user_id = NEW.user_id
                  AND group_id = NEW.group_id
                  AND type = 'GROUP_INVITE'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_invite_notifications ON public.group_members;
CREATE TRIGGER trg_group_invite_notifications
    AFTER INSERT ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_group_invite_notification();
