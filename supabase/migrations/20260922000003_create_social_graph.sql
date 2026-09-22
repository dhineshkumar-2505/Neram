-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 03 - SOCIAL GRAPH (FRIENDSHIPS & BLOCKS)
-- ==============================================================================

-- 1. Blocks Table (Defined first so helper functions can reference it)
CREATE TABLE public.blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id),
    CONSTRAINT uq_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker_blocked ON public.blocks (blocker_id, blocked_id);
CREATE INDEX idx_blocks_blocked_id ON public.blocks (blocked_id);

-- 2. Blocking Check Helper Function
CREATE OR REPLACE FUNCTION public.is_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
           OR (blocker_id = p_user_b AND blocked_id = p_user_a)
    );
$$;

-- 3. Friendships Table (Unordered Pair Canonical Storage)
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_low_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    user_high_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_canonical_ordering CHECK (user_low_id < user_high_id),
    CONSTRAINT uq_canonical_friendship UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX idx_friendships_user_low ON public.friendships (user_low_id);
CREATE INDEX idx_friendships_user_high ON public.friendships (user_high_id);

-- Trigger to Automatically Sort Canonical Pair
CREATE OR REPLACE FUNCTION public.normalize_friendship_pair()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    temp_id UUID;
BEGIN
    IF NEW.user_low_id = NEW.user_high_id THEN
        RAISE EXCEPTION 'A user cannot be friends with themselves.';
    END IF;

    IF NEW.user_low_id > NEW.user_high_id THEN
        temp_id := NEW.user_low_id;
        NEW.user_low_id := NEW.user_high_id;
        NEW.user_high_id := temp_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_friendship
    BEFORE INSERT OR UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_friendship_pair();

-- 4. Canonical are_friends(user_a, user_b) Helper Function
CREATE OR REPLACE FUNCTION public.are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE 
        WHEN p_user_a IS NULL OR p_user_b IS NULL THEN false
        WHEN p_user_a = p_user_b THEN false
        WHEN public.is_blocked(p_user_a, p_user_b) THEN false
        ELSE EXISTS (
            SELECT 1 FROM public.friendships
            WHERE user_low_id = LEAST(p_user_a, p_user_b)
              AND user_high_id = GREATEST(p_user_a, p_user_b)
        )
    END;
$$;

-- 5. Friend Requests Table
CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status public.friend_request_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT chk_no_self_friend_request CHECK (sender_id <> receiver_id)
);

-- Partial index ensuring only one active pending request per direction
CREATE UNIQUE INDEX idx_unique_pending_friend_request 
    ON public.friend_requests (sender_id, receiver_id) 
    WHERE status = 'PENDING';

CREATE INDEX idx_friend_requests_receiver_status ON public.friend_requests (receiver_id, status);
CREATE INDEX idx_friend_requests_sender_status ON public.friend_requests (sender_id, status);

-- Function to handle responding to friend requests and creating friendship atomically
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(p_request_id UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request RECORD;
BEGIN
    SELECT * INTO v_request 
    FROM public.friend_requests 
    WHERE id = p_request_id AND status = 'PENDING'
    FOR UPDATE;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Friend request not found or not in pending state.';
    END IF;

    -- Only receiver can accept or decline; sender can only cancel
    IF (SELECT auth.uid()) <> v_request.receiver_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the recipient can accept or decline this friend request.';
    END IF;

    IF p_accept THEN
        -- Check if blocked
        IF public.is_blocked(v_request.sender_id, v_request.receiver_id) THEN
            RAISE EXCEPTION 'Cannot accept friend request due to active block.';
        END IF;

        -- Update request status
        UPDATE public.friend_requests 
        SET status = 'ACCEPTED', responded_at = now()
        WHERE id = p_request_id;

        -- Insert friendship row (trg_normalize_friendship will sort user_low and user_high)
        INSERT INTO public.friendships (user_low_id, user_high_id)
        VALUES (v_request.sender_id, v_request.receiver_id)
        ON CONFLICT (user_low_id, user_high_id) DO NOTHING;
    ELSE
        UPDATE public.friend_requests 
        SET status = 'DECLINED', responded_at = now()
        WHERE id = p_request_id;
    END IF;
END;
$$;

-- 6. Enable Row Level Security
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Blocks
CREATE POLICY "Users can view blocks they initiated"
    ON public.blocks
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = blocker_id);

CREATE POLICY "Users can block other users"
    ON public.blocks
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = blocker_id);

CREATE POLICY "Users can unblock users"
    ON public.blocks
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = blocker_id);

-- 8. RLS Policies: Friendships
CREATE POLICY "Users can view their own friendships"
    ON public.friendships
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) IN (user_low_id, user_high_id));

CREATE POLICY "Users can delete their own friendship"
    ON public.friendships
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) IN (user_low_id, user_high_id));

-- Direct insertion into friendships is restricted to trusted functions
CREATE POLICY "Friendships created via authorized flow"
    ON public.friendships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) IN (user_low_id, user_high_id)
        AND NOT public.is_blocked(user_low_id, user_high_id)
        AND EXISTS (
            SELECT 1 FROM public.friend_requests
            WHERE status = 'ACCEPTED'
              AND ((sender_id = user_low_id AND receiver_id = user_high_id)
                OR (sender_id = user_high_id AND receiver_id = user_low_id))
        )
    );

-- 9. RLS Policies: Friend Requests
CREATE POLICY "Users can view requests they sent or received"
    ON public.friend_requests
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) IN (sender_id, receiver_id));

CREATE POLICY "Users can send friend requests"
    ON public.friend_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = sender_id
        AND sender_id <> receiver_id
        AND NOT public.is_blocked(sender_id, receiver_id)
        AND NOT public.are_friends(sender_id, receiver_id)
    );

CREATE POLICY "Recipients can respond and senders can cancel requests"
    ON public.friend_requests
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) IN (sender_id, receiver_id))
    WITH CHECK (
        ((SELECT auth.uid()) = receiver_id AND status IN ('ACCEPTED', 'DECLINED'))
        OR ((SELECT auth.uid()) = sender_id AND status = 'CANCELLED')
    );
