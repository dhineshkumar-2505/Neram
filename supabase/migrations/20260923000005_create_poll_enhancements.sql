-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 20260923000005 - POLL ENHANCEMENTS & VOTE INTEGRITY
-- ==============================================================================

-- 1. Add missing fields to public.polls
ALTER TABLE public.polls
    ADD COLUMN IF NOT EXISTS is_multiple_choice BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 2. Add vote_count column to public.poll_options
ALTER TABLE public.poll_options
    ADD COLUMN IF NOT EXISTS vote_count INT NOT NULL DEFAULT 0;

-- 3. Adjust primary key on public.poll_votes to support multiple choice options
-- Drop existing primary key (poll_id, user_id)
ALTER TABLE public.poll_votes
    DROP CONSTRAINT IF EXISTS poll_votes_pkey;

-- Re-add primary key as (poll_id, option_id, user_id)
ALTER TABLE public.poll_votes
    ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (poll_id, option_id, user_id);

-- 4. Atomic vote counter trigger on public.poll_votes
CREATE OR REPLACE FUNCTION public.sync_poll_option_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.poll_options
        SET vote_count = vote_count + 1
        WHERE id = NEW.option_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.poll_options
        SET vote_count = GREATEST(0, vote_count - 1)
        WHERE id = OLD.option_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_poll_option_vote_count ON public.poll_votes;
CREATE TRIGGER trg_sync_poll_option_vote_count
    AFTER INSERT OR DELETE ON public.poll_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_poll_option_vote_count();

-- 5. Atomic vote casting RPC function (handles single-choice replace/retract & multi-choice toggle)
CREATE OR REPLACE FUNCTION public.cast_poll_vote(
    p_poll_id UUID,
    p_option_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_poll RECORD;
    v_option RECORD;
    v_existing_vote RECORD;
    v_result TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to vote.';
    END IF;

    -- Fetch poll and validate state
    SELECT id, group_id, is_multiple_choice, is_closed, expires_at
    INTO v_poll
    FROM public.polls
    WHERE id = p_poll_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll not found.';
    END IF;

    IF v_poll.is_closed THEN
        RAISE EXCEPTION 'This poll has been closed.';
    END IF;

    IF v_poll.expires_at IS NOT NULL AND now() >= v_poll.expires_at THEN
        RAISE EXCEPTION 'This poll has expired.';
    END IF;

    IF NOT public.is_group_active(v_poll.group_id) THEN
        RAISE EXCEPTION 'Cannot vote in an expired or inactive group.';
    END IF;

    IF NOT public.is_group_member(v_poll.group_id, v_user_id) THEN
        RAISE EXCEPTION 'Only active group members can vote.';
    END IF;

    -- Validate option belongs to poll
    SELECT id, poll_id
    INTO v_option
    FROM public.poll_options
    WHERE id = p_option_id AND poll_id = p_poll_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid option for this poll.';
    END IF;

    -- Check if user already voted for THIS option
    SELECT * INTO v_existing_vote
    FROM public.poll_votes
    WHERE poll_id = p_poll_id AND option_id = p_option_id AND user_id = v_user_id;

    IF FOUND THEN
        -- Retract vote (toggle off)
        DELETE FROM public.poll_votes
        WHERE poll_id = p_poll_id AND option_id = p_option_id AND user_id = v_user_id;
        v_result := 'RETRACTED';
    ELSE
        -- Single-choice rule: delete any other votes on this poll by this user first
        IF NOT v_poll.is_multiple_choice THEN
            DELETE FROM public.poll_votes
            WHERE poll_id = p_poll_id AND user_id = v_user_id;
        END IF;

        -- Insert vote
        INSERT INTO public.poll_votes (poll_id, option_id, user_id, created_at)
        VALUES (p_poll_id, p_option_id, v_user_id, now());
        v_result := 'VOTED';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'action', v_result,
        'poll_id', p_poll_id,
        'option_id', p_option_id
    );
END;
$$;

-- 6. RPC function to close a poll
CREATE OR REPLACE FUNCTION public.close_poll(
    p_poll_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_poll RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, group_id, creator_id, is_closed
    INTO v_poll
    FROM public.polls
    WHERE id = p_poll_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll not found.';
    END IF;

    IF v_poll.is_closed THEN
        RETURN jsonb_build_object('success', true, 'already_closed', true);
    END IF;

    IF NOT (v_poll.creator_id = v_user_id OR public.is_group_admin(v_poll.group_id, v_user_id)) THEN
        RAISE EXCEPTION 'Only the poll creator or group admin can close this poll.';
    END IF;

    UPDATE public.polls
    SET is_closed = true,
        closed_at = now()
    WHERE id = p_poll_id;

    RETURN jsonb_build_object('success', true, 'closed_at', now());
END;
$$;

-- 7. Add UPDATE and DELETE RLS policies for polls
DROP POLICY IF EXISTS "Creator or Admin can update poll in active groups" ON public.polls;
CREATE POLICY "Creator or Admin can update poll in active groups"
    ON public.polls
    FOR UPDATE
    TO authenticated
    USING (
        (creator_id = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_active(group_id)
    );

DROP POLICY IF EXISTS "Creator or Admin can delete poll in active groups" ON public.polls;
CREATE POLICY "Creator or Admin can delete poll in active groups"
    ON public.polls
    FOR DELETE
    TO authenticated
    USING (
        (creator_id = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );

-- 8. Add DELETE RLS policy for poll_votes (vote retraction)
DROP POLICY IF EXISTS "Members can retract their own vote in active, open polls" ON public.poll_votes;
CREATE POLICY "Members can retract their own vote in active, open polls"
    ON public.poll_votes
    FOR DELETE
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.polls p
            WHERE p.id = poll_votes.poll_id
              AND public.is_group_active(p.group_id)
              AND (p.is_closed IS NOT TRUE)
              AND (p.expires_at IS NULL OR now() < p.expires_at)
        )
    );

-- 9. Add polls, poll_options, poll_votes to Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'polls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'poll_options'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'poll_votes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
    END IF;
END;
$$;
