-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 01 - ENUMS & UTILITY FUNCTIONS
-- ==============================================================================

-- 1. Friend Request Status Enum
CREATE TYPE public.friend_request_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED'
);

-- 2. Group Purpose Archetypes Enum
CREATE TYPE public.group_purpose AS ENUM (
    'OUTING',
    'PROJECT',
    'HACKATHON',
    'BIRTHDAY',
    'TRIP',
    'STUDY',
    'SPORTS',
    'EVENT',
    'CUSTOM'
);

-- 3. Group Membership Roles Enum
CREATE TYPE public.group_role AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER'
);

-- 4. Group Lifecycle States Enum
CREATE TYPE public.lifecycle_state AS ENUM (
    'CREATED',
    'ACTIVE',
    'EXPIRING',
    'EXPIRED',
    'ARCHIVED',
    'PURGED'
);

-- 5. Task Priorities Enum
CREATE TYPE public.task_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- 6. Task Statuses Enum
CREATE TYPE public.task_status AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'BLOCKED',
    'COMPLETED'
);

-- 7. Location Session Status Enum
CREATE TYPE public.location_session_status AS ENUM (
    'ACTIVE',
    'PAUSED',
    'ARRIVED',
    'ENDED'
);

-- 8. Notification Types Enum
CREATE TYPE public.notification_type AS ENUM (
    'FRIEND_REQUEST',
    'FRIEND_ACCEPTED',
    'GROUP_INVITE',
    'TASK_ASSIGNED',
    'TASK_DEADLINE',
    'MESSAGE_MENTION',
    'EVENT_REMINDER',
    'MEETING_APPROACHING',
    'MEMBER_ARRIVED',
    'GROUP_EXPIRING',
    'GROUP_EXPIRED'
);

-- 9. Automatic Updated At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
