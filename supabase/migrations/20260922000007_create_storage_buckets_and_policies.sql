-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 07 - STORAGE BUCKETS & SECURITY POLICIES
-- ==============================================================================

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'avatars', 
        'avatars', 
        true, 
        5242880, -- 5MB max
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'group-media', 
        'group-media', 
        false, 
        10485760, -- 10MB max
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'attachments', 
        'attachments', 
        false, 
        52428800, -- 50MB max
        ARRAY[
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ]
    ),
    (
        'temporary-uploads', 
        'temporary-uploads', 
        false, 
        52428800, -- 50MB max
        NULL -- all types during staging
    )
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies: avatars
-- Public read for profile avatars
CREATE POLICY "Public read avatars"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- User can only upload/update avatars in their own folder ({user_id}/*)
CREATE POLICY "Users can upload own avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "Users can update own avatar"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

CREATE POLICY "Users can delete own avatar"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- 3. Storage RLS Policies: group-media ({group_id}/*)
CREATE POLICY "Members can view group media"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'group-media'
        AND public.is_group_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
    );

CREATE POLICY "Members can upload group media in active groups"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'group-media'
        AND public.is_group_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
        AND public.is_group_active((storage.foldername(name))[1]::uuid)
    );

CREATE POLICY "Admins can delete group media in active groups"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'group-media'
        AND public.is_group_admin((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
        AND public.is_group_active((storage.foldername(name))[1]::uuid)
    );

-- 4. Storage RLS Policies: attachments ({group_id}/*)
CREATE POLICY "Members can download group attachments in active or archived groups"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'attachments'
        AND public.is_group_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
    );

CREATE POLICY "Members can upload attachments in active groups with FILES enabled"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'attachments'
        AND public.is_group_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
        AND public.is_group_active((storage.foldername(name))[1]::uuid)
        AND public.is_group_feature_enabled((storage.foldername(name))[1]::uuid, 'FILES')
    );

CREATE POLICY "Admins or uploader can delete attachments in active groups"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'attachments'
        AND (
            public.is_group_admin((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
            OR (SELECT auth.uid()) = owner
        )
        AND public.is_group_active((storage.foldername(name))[1]::uuid)
    );

-- 5. Storage RLS Policies: temporary-uploads ({user_id}/*)
CREATE POLICY "Users can manage their own temporary uploads"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'temporary-uploads'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
    WITH CHECK (
        bucket_id = 'temporary-uploads'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
