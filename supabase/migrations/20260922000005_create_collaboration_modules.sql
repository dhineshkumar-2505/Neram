-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 05 - COLLABORATION MODULES (CHAT, TASKS, EVENTS, POLLS, FILES)
-- ==============================================================================

-- 1. Files Metadata Table (Created early so message_attachments can reference it)
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CONSTRAINT chk_file_size CHECK (size_bytes > 0 AND size_bytes <= 52428800), -- 50MB max
    storage_path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_group_id ON public.files (group_id);
CREATE INDEX idx_files_owner_id ON public.files (owner_id);

-- 2. Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    body TEXT NOT NULL CONSTRAINT chk_message_body CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_group_created ON public.messages (group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX idx_messages_reply_to_id ON public.messages (reply_to_id);

-- 3. Message Attachments Table
CREATE TABLE public.message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    CONSTRAINT uq_message_file_pair UNIQUE (message_id, file_id)
);

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments (message_id);

-- 4. Tasks Table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    title TEXT NOT NULL CONSTRAINT chk_task_title CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 120),
    description TEXT,
    deadline TIMESTAMPTZ,
    priority public.task_priority NOT NULL DEFAULT 'MEDIUM',
    status public.task_status NOT NULL DEFAULT 'NOT_STARTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_group_status_deadline ON public.tasks (group_id, status, deadline);
CREATE INDEX idx_tasks_creator_id ON public.tasks (creator_id);

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();

-- 5. Task Assignees Table
CREATE TABLE public.task_assignees (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_assignees_user_id ON public.task_assignees (user_id);

-- Trigger: Ensure Assignee is an Active Member of the Task's Group
CREATE OR REPLACE FUNCTION public.validate_task_assignee_membership()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_task_group UUID;
BEGIN
    SELECT group_id INTO v_task_group FROM public.tasks WHERE id = NEW.task_id;
    IF NOT public.is_group_member(v_task_group, NEW.user_id) THEN
        RAISE EXCEPTION 'Security violation: Cannot assign task to a user who is not a member of the group.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_task_assignee
    BEFORE INSERT ON public.task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_task_assignee_membership();

-- 6. Events Table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL CONSTRAINT chk_event_title CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 100),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    location_text TEXT,
    latitude DOUBLE PRECISION CONSTRAINT chk_event_lat CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
    longitude DOUBLE PRECISION CONSTRAINT chk_event_lng CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_event_timing CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX idx_events_group_starts ON public.events (group_id, starts_at);

-- 7. Polls Tables
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    question TEXT NOT NULL CONSTRAINT chk_poll_question CHECK (char_length(trim(question)) >= 1 AND char_length(question) <= 250),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_polls_group_id ON public.polls (group_id);

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL CONSTRAINT chk_option_text CHECK (char_length(trim(option_text)) >= 1 AND char_length(option_text) <= 120),
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_poll_options_poll_id ON public.poll_options (poll_id, sort_order);

CREATE TABLE public.poll_votes (
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (poll_id, user_id) -- Strict V1 Single-Vote Guarantee
);

CREATE INDEX idx_poll_votes_option_id ON public.poll_votes (option_id);

-- 8. Enable Row Level Security
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies: Messages
CREATE POLICY "Members can view messages in their groups"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Active members can send messages in active groups with CHAT enabled"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = sender_id
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'CHAT')
    );

CREATE POLICY "Sender can edit their own active message"
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.uid()) = sender_id
        AND deleted_at IS NULL
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        (SELECT auth.uid()) = sender_id
        AND public.is_group_active(group_id)
    );

CREATE POLICY "Sender or Admin can soft delete message"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        (SELECT auth.uid()) = sender_id
        OR public.is_group_admin(group_id, (SELECT auth.uid()))
    );

-- 10. RLS Policies: Message Attachments
CREATE POLICY "Members can view message attachments"
    ON public.message_attachments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_attachments.message_id
              AND public.is_group_member(m.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Sender can attach files to active messages"
    ON public.message_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_attachments.message_id
              AND m.sender_id = (SELECT auth.uid())
              AND public.is_group_active(m.group_id)
        )
    );

-- 11. RLS Policies: Tasks
CREATE POLICY "Members can view tasks"
    ON public.tasks
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can insert tasks in active groups with TASKS enabled"
    ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = creator_id
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'TASKS')
    );

CREATE POLICY "Members can update tasks in active groups"
    ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

CREATE POLICY "Creator or Admin can delete tasks"
    ON public.tasks
    FOR DELETE
    TO authenticated
    USING (
        (creator_id = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );

-- 12. RLS Policies: Task Assignees
CREATE POLICY "Members can view task assignees"
    ON public.task_assignees
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_assignees.task_id
              AND public.is_group_member(t.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Members can modify task assignees in active groups"
    ON public.task_assignees
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_assignees.task_id
              AND public.is_group_member(t.group_id, (SELECT auth.uid()))
              AND public.is_group_active(t.group_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_assignees.task_id
              AND public.is_group_member(t.group_id, (SELECT auth.uid()))
              AND public.is_group_active(t.group_id)
        )
    );

-- 13. RLS Policies: Events
CREATE POLICY "Members can view events"
    ON public.events
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can create events in active groups with EVENTS enabled"
    ON public.events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'EVENTS')
    );

CREATE POLICY "Members can update events in active groups"
    ON public.events
    FOR UPDATE
    TO authenticated
    USING (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    )
    WITH CHECK (
        public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

CREATE POLICY "Admins can delete events in active groups"
    ON public.events
    FOR DELETE
    TO authenticated
    USING (
        public.is_group_admin(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
    );

-- 14. RLS Policies: Polls, Options & Votes
CREATE POLICY "Members can view polls"
    ON public.polls
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can create polls in active groups with POLLS enabled"
    ON public.polls
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = creator_id
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'POLLS')
    );

CREATE POLICY "Members can view poll options"
    ON public.poll_options
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.polls p
            WHERE p.id = poll_options.poll_id
              AND public.is_group_member(p.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Poll creator can add options in active groups"
    ON public.poll_options
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.polls p
            WHERE p.id = poll_options.poll_id
              AND p.creator_id = (SELECT auth.uid())
              AND public.is_group_active(p.group_id)
        )
    );

CREATE POLICY "Members can view poll votes"
    ON public.poll_votes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.polls p
            WHERE p.id = poll_votes.poll_id
              AND public.is_group_member(p.group_id, (SELECT auth.uid()))
        )
    );

CREATE POLICY "Members can vote in active, non-expired polls"
    ON public.poll_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM public.polls p
            WHERE p.id = poll_votes.poll_id
              AND public.is_group_member(p.group_id, (SELECT auth.uid()))
              AND public.is_group_active(p.group_id)
              AND (p.expires_at IS NULL OR now() < p.expires_at)
        )
    );

-- 15. RLS Policies: Files Metadata
CREATE POLICY "Members can view files metadata"
    ON public.files
    FOR SELECT
    TO authenticated
    USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "Members can insert files metadata in active groups with FILES enabled"
    ON public.files
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = owner_id
        AND public.is_group_member(group_id, (SELECT auth.uid()))
        AND public.is_group_active(group_id)
        AND public.is_group_feature_enabled(group_id, 'FILES')
    );

CREATE POLICY "Owner or Admin can delete files metadata in active groups"
    ON public.files
    FOR DELETE
    TO authenticated
    USING (
        (owner_id = (SELECT auth.uid()) OR public.is_group_admin(group_id, (SELECT auth.uid())))
        AND public.is_group_active(group_id)
    );
