# Purpose-Driven Temporary Social Platform: Master Database Plan

## 1. Relational Database Overview & Schema Standards

The database is built on **PostgreSQL 15+** managed via Supabase.

### Schema Conventions:
1. **Primary Keys**: Always `id UUID DEFAULT gen_random_uuid() PRIMARY KEY` (except where composite natural keys or direct foreign-key PKs are specified).
2. **Timestamps**: Always `TIMESTAMPTZ` stored in UTC. Never use naive `TIMESTAMP`.
3. **Auditability**: All stateful tables carry `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
4. **Soft vs. Hard Deletes**: Soft deletes (`deleted_at TIMESTAMPTZ`) are applied to chat messages and group memberships to preserve auditability; location coordinates are hard-deleted for privacy.
5. **Enums**: Native PostgreSQL enums (`CREATE TYPE ... AS ENUM`) are utilized for bounded state machines to guarantee compile-time database validation.

---

## 2. PostgreSQL Enumerated Types

```sql
CREATE TYPE friend_request_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE group_purpose AS ENUM ('OUTING', 'PROJECT', 'HACKATHON', 'BIRTHDAY', 'TRIP', 'STUDY', 'SPORTS', 'EVENT', 'CUSTOM');
CREATE TYPE group_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE lifecycle_state AS ENUM ('CREATED', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'ARCHIVED', 'PURGED');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE task_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');
CREATE TYPE location_session_status AS ENUM ('ACTIVE', 'PAUSED', 'ARRIVED', 'ENDED');
CREATE TYPE notification_type AS ENUM (
    'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'GROUP_INVITE',
    'TASK_ASSIGNED', 'TASK_DEADLINE', 'MESSAGE_MENTION',
    'EVENT_REMINDER', 'MEETING_APPROACHING', 'MEMBER_ARRIVED',
    'GROUP_EXPIRING', 'GROUP_EXPIRED'
);
```

---

## 3. Detailed Table Specifications

### 3.1 `profiles`
Stores the public social identity linked directly to `auth.users`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | `PK, FK -> auth.users(id) ON DELETE CASCADE` | Immutable user identifier |
| `username` | `TEXT` | `NOT NULL UNIQUE` | Lowercase alphanumeric username (`^[a-z0-9_]{3,20}$`) |
| `display_name`| `TEXT` | `NOT NULL` | User's chosen public name (1–50 chars) |
| `avatar_path` | `TEXT` | `NULLABLE` | S3 path inside `avatars` bucket |
| `dob` | `DATE` | `NULLABLE` | Date of birth (age verification) |
| `bio` | `TEXT` | `NULLABLE` | Short biography (max 160 chars) |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Registration timestamp |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Last profile update |

* **Constraints**:
  - `CHECK (char_length(username) >= 3 AND char_length(username) <= 20)`
  - `CHECK (username ~ '^[a-z0-9_]+$')`
* **Indexes**:
  - `CREATE UNIQUE INDEX idx_profiles_username ON profiles (username);`

---

### 3.2 `user_devices`
Maintains hardware push tokens for FCM and APNs push dispatches.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `device_id` | `TEXT` | `PK` | Unique hardware device identifier |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Device owner |
| `platform` | `TEXT` | `NOT NULL CHECK (platform IN ('IOS', 'ANDROID'))` | Mobile operating system |
| `push_token` | `TEXT` | `NOT NULL` | APNs device token or FCM registration token |
| `last_seen_at`| `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Last active app ping |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Device registration time |

* **Indexes**:
  - `CREATE INDEX idx_user_devices_user_id ON user_devices (user_id);`

---

### 3.3 `friend_requests`
Tracks incoming and outgoing friend invitations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Request identifier |
| `sender_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | User sending request |
| `receiver_id`| `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Target recipient |
| `status` | `friend_request_status` | `NOT NULL DEFAULT 'PENDING'` | Request status |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Request creation time |
| `responded_at`| `TIMESTAMPTZ`| `NULLABLE` | Timestamp of accept/decline |

* **Constraints**:
  - `CHECK (sender_id <> receiver_id)`
  - `UNIQUE (sender_id, receiver_id)` (only one active request per pair)
* **Indexes**:
  - `CREATE INDEX idx_friend_requests_receiver_status ON friend_requests (receiver_id, status);`
  - `CREATE INDEX idx_friend_requests_sender_status ON friend_requests (sender_id, status);`

---

### 3.4 `friendships`
Stores the established social graph as canonical unordered pairs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Friendship record ID |
| `user_low_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Lower UUID in sorted pair |
| `user_high_id`| `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Higher UUID in sorted pair |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Established timestamp |

* **Constraints**:
  - `CHECK (user_low_id < user_high_id)`
  - `UNIQUE (user_low_id, user_high_id)`
* **Indexes**:
  - `CREATE UNIQUE INDEX idx_friendships_canonical_pair ON friendships (user_low_id, user_high_id);`
  - `CREATE INDEX idx_friendships_user_low ON friendships (user_low_id);`
  - `CREATE INDEX idx_friendships_user_high ON friendships (user_high_id);`

---

### 3.5 `blocks`
Enforces hard social isolation.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Block record ID |
| `blocker_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | User initiating block |
| `blocked_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | User being blocked |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Timestamp block occurred |

* **Constraints**:
  - `CHECK (blocker_id <> blocked_id)`
  - `UNIQUE (blocker_id, blocked_id)`
* **Indexes**:
  - `CREATE INDEX idx_blocks_blocker_blocked ON blocks (blocker_id, blocked_id);`

---

### 3.6 `groups`
The core temporal container.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Group identifier |
| `owner_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` | Group creator / owner |
| `name` | `TEXT` | `NOT NULL` | Group title (1–80 chars) |
| `description`| `TEXT` | `NULLABLE` | Group description (max 500 chars) |
| `image_path` | `TEXT` | `NULLABLE` | S3 path inside `group-media` bucket |
| `purpose` | `group_purpose` | `NOT NULL` | Purpose archetype |
| `starts_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Group activation start |
| `expires_at` | `TIMESTAMPTZ`| `NOT NULL` | Group termination time |
| `lifecycle_state` | `lifecycle_state` | `NOT NULL DEFAULT 'ACTIVE'` | Server-managed lifecycle status |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Update timestamp |

* **Constraints**:
  - `CHECK (expires_at > starts_at)`
  - `CHECK (expires_at <= starts_at + INTERVAL '1 year')`
* **Indexes**:
  - `CREATE INDEX idx_groups_lifecycle_expires ON groups (lifecycle_state, expires_at);`
  - `CREATE INDEX idx_groups_owner_id ON groups (owner_id);`

---

### 3.7 `group_members`
Maintains group roster, roles, and membership lifecycles.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Group container |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Member identity |
| `role` | `group_role` | `NOT NULL DEFAULT 'MEMBER'` | Member permission tier |
| `joined_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Join timestamp |
| `left_at` | `TIMESTAMPTZ`| `NULLABLE` | Departure timestamp (soft removal) |

* **Constraints**:
  - `PRIMARY KEY (group_id, user_id)`
* **Indexes**:
  - `CREATE INDEX idx_group_members_user_id ON group_members (user_id) WHERE left_at IS NULL;`
  - `CREATE INDEX idx_group_members_group_id ON group_members (group_id) WHERE left_at IS NULL;`

---

### 3.8 `group_features`
Explicit feature flags activating or disabling modules per group.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Group container |
| `feature_key`| `TEXT` | `NOT NULL` | Key (`CHAT`, `TASKS`, `FILES`, `EVENTS`, `POLLS`, `LOCATION`) |
| `enabled_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | When feature was activated |
| `enabled_by` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` | Admin who enabled feature |

* **Constraints**:
  - `PRIMARY KEY (group_id, feature_key)`

---

### 3.9 `messages`
Realtime group communication stream.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Message identifier |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Target group |
| `sender_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` | Author of message |
| `body` | `TEXT` | `NOT NULL` | Message textual content |
| `reply_to_id`| `UUID` | `NULLABLE, FK -> messages(id) ON DELETE SET NULL` | Parent message in thread |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Timestamp message was sent |
| `edited_at` | `TIMESTAMPTZ`| `NULLABLE` | Timestamp of last edit |
| `deleted_at` | `TIMESTAMPTZ`| `NULLABLE` | Soft-delete timestamp |

* **Constraints**:
  - `CHECK (char_length(body) > 0 AND char_length(body) <= 4000)`
* **Indexes**:
  - `CREATE INDEX idx_messages_group_created ON messages (group_id, created_at DESC) WHERE deleted_at IS NULL;`

---

### 3.10 `message_attachments`
Joins uploaded files to specific chat messages.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Join identifier |
| `message_id` | `UUID` | `NOT NULL, FK -> messages(id) ON DELETE CASCADE` | Parent message |
| `file_id` | `UUID` | `NOT NULL, FK -> files(id) ON DELETE CASCADE` | Referenced file entity |

* **Indexes**:
  - `CREATE UNIQUE INDEX idx_message_attachments_pair ON message_attachments (message_id, file_id);`

---

### 3.11 `tasks`
Structured work items for Project and Hackathon groups.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Task identifier |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Target group |
| `creator_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` | Creator of the task |
| `title` | `TEXT` | `NOT NULL` | Task title (1–120 chars) |
| `description`| `TEXT` | `NULLABLE` | Extended markdown description |
| `deadline` | `TIMESTAMPTZ`| `NULLABLE` | Due timestamp |
| `priority` | `task_priority` | `NOT NULL DEFAULT 'MEDIUM'` | Priority weight |
| `status` | `task_status` | `NOT NULL DEFAULT 'NOT_STARTED'` | Current workflow status |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Last update timestamp |

* **Indexes**:
  - `CREATE INDEX idx_tasks_group_status_deadline ON tasks (group_id, status, deadline);`

---

### 3.12 `task_assignees`
Supports multiple assignees per task.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `task_id` | `UUID` | `NOT NULL, FK -> tasks(id) ON DELETE CASCADE` | Target task |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Assigned team member |

* **Constraints**:
  - `PRIMARY KEY (task_id, user_id)`

---

### 3.13 `events`
Milestones, meetup points, and deadlines that drive group urgency.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Event identifier |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Target group |
| `title` | `TEXT` | `NOT NULL` | Event title |
| `description`| `TEXT` | `NULLABLE` | Context notes |
| `starts_at` | `TIMESTAMPTZ`| `NOT NULL` | Event start timestamp |
| `ends_at` | `TIMESTAMPTZ`| `NULLABLE` | Event conclusion timestamp |
| `location_text`| `TEXT` | `NULLABLE` | Physical venue name or address |
| `latitude` | `DOUBLE PRECISION`| `NULLABLE` | Geocoded latitude |
| `longitude` | `DOUBLE PRECISION`| `NULLABLE` | Geocoded longitude |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Record creation |

* **Constraints**:
  - `CHECK (ends_at IS NULL OR ends_at >= starts_at)`
* **Indexes**:
  - `CREATE INDEX idx_events_group_starts ON events (group_id, starts_at);`

---

### 3.14 `polls`, `poll_options`, and `poll_votes`
Rapid consensus mechanisms for group decisions.

#### `polls`
| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` |
| `creator_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` |
| `question` | `TEXT` | `NOT NULL` |
| `expires_at` | `TIMESTAMPTZ`| `NULLABLE` |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` |

#### `poll_options`
| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` |
| `poll_id` | `UUID` | `NOT NULL, FK -> polls(id) ON DELETE CASCADE` |
| `option_text`| `TEXT` | `NOT NULL` |
| `sort_order` | `INT` | `NOT NULL DEFAULT 0` |

#### `poll_votes`
| Column | Type | Constraints |
| :--- | :--- | :--- |
| `poll_id` | `UUID` | `NOT NULL, FK -> polls(id) ON DELETE CASCADE` |
| `option_id` | `UUID` | `NOT NULL, FK -> poll_options(id) ON DELETE CASCADE` |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` |

* **Constraints**:
  - `PRIMARY KEY (poll_id, user_id)` (guarantees strictly one vote per user per poll)

---

### 3.15 `files`
Metadata catalog for all binary assets stored in S3.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | File record identifier |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Scoped group |
| `owner_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE RESTRICT` | Uploader |
| `filename` | `TEXT` | `NOT NULL` | Original user filename |
| `mime_type` | `TEXT` | `NOT NULL` | Standard MIME type (`application/pdf`, etc.) |
| `size_bytes` | `BIGINT` | `NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800)` | File size (max 50MB) |
| `storage_path`| `TEXT` | `NOT NULL UNIQUE` | Full S3 key inside bucket |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Upload timestamp |

* **Indexes**:
  - `CREATE INDEX idx_files_group_id ON files (group_id);`

---

### 3.16 `location_sessions`
Manages the active window during which physical tracking is permissible.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Session identifier |
| `group_id` | `UUID` | `NOT NULL, FK -> groups(id) ON DELETE CASCADE` | Parent group |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Sharing member |
| `starts_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Tracking commencement |
| `ends_at` | `TIMESTAMPTZ`| `NOT NULL` | Hard tracking deadline |
| `destination_lat`| `DOUBLE PRECISION`| `NOT NULL` | Destination latitude |
| `destination_lng`| `DOUBLE PRECISION`| `NOT NULL` | Destination longitude |
| `status` | `location_session_status` | `NOT NULL DEFAULT 'ACTIVE'` | Operational status |

* **Constraints**:
  - `CHECK (ends_at > starts_at)`
  - `CHECK (destination_lat BETWEEN -90 AND 90 AND destination_lng BETWEEN -180 AND 180)`
* **Indexes**:
  - `CREATE INDEX idx_location_sessions_group_status ON location_sessions (group_id, status);`

---

### 3.17 `current_locations`
Ephemeral, non-historical position store. One row per active session.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `session_id` | `UUID` | `PK, FK -> location_sessions(id) ON DELETE CASCADE` | 1-to-1 with active session |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Member identifier |
| `latitude` | `DOUBLE PRECISION`| `NOT NULL` | Current latitude |
| `longitude` | `DOUBLE PRECISION`| `NOT NULL` | Current longitude |
| `accuracy` | `REAL` | `NOT NULL` | Accuracy radius in meters |
| `speed` | `REAL` | `NULLABLE` | Speed in m/s |
| `heading` | `REAL` | `NULLABLE` | Heading in degrees (0–360) |
| `recorded_at`| `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Fix acquisition timestamp |

* **Constraints**:
  - `CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)`
* **Indexes**:
  - `CREATE INDEX idx_current_locations_session_recorded ON current_locations (session_id, recorded_at DESC);`

---

### 3.18 `notifications`
Persistent in-app notification records.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Notification ID |
| `user_id` | `UUID` | `NOT NULL, FK -> profiles(user_id) ON DELETE CASCADE` | Recipient user |
| `type` | `notification_type` | `NOT NULL` | Actionable event type |
| `actor_id` | `UUID` | `NULLABLE, FK -> profiles(user_id) ON DELETE SET NULL` | Triggering user |
| `group_id` | `UUID` | `NULLABLE, FK -> groups(id) ON DELETE CASCADE` | Related group context |
| `payload_json`| `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Context metadata |
| `read_at` | `TIMESTAMPTZ`| `NULLABLE` | Read acknowledgement |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Dispatch timestamp |

* **Indexes**:
  - `CREATE INDEX idx_notifications_user_read_created ON notifications (user_id, read_at, created_at DESC);`

---

### 3.19 `audit_logs`
Immutable record of security and administrative operations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Log entry ID |
| `actor_id` | `UUID` | `NULLABLE, FK -> profiles(user_id) ON DELETE SET NULL` | Operating user |
| `action` | `TEXT` | `NOT NULL` | Action name (`GROUP_CREATED`, etc.) |
| `resource_type`| `TEXT` | `NOT NULL` | Entity type (`groups`, `members`) |
| `resource_id`| `UUID` | `NOT NULL` | ID of affected entity |
| `metadata_json`| `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | State snapshot or delta |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT now()` | Event timestamp |

---

## 4. Key Functions & Database Triggers

### 4.1 Automatic Profile Creation on Sign-Up
```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username, display_name)
    VALUES (
        NEW.id,
        'user_' || substr(NEW.id::text, 1, 8),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Member')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

### 4.2 Canonical Friendship Sorter Trigger
Prevents inverted pair insertion:
```sql
CREATE OR REPLACE FUNCTION public.normalize_friendship_pair()
RETURNS TRIGGER AS $$
DECLARE
    temp_id UUID;
BEGIN
    IF NEW.user_low_id > NEW.user_high_id THEN
        temp_id := NEW.user_low_id;
        NEW.user_low_id := NEW.user_high_id;
        NEW.user_high_id := temp_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_friendship
    BEFORE INSERT OR UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION public.normalize_friendship_pair();
```

### 4.3 Strict Friend-Only Group Member Validation Trigger
Ensures that nobody can join or be added to a group unless they are friends with the group owner or inviting admin:
```sql
CREATE OR REPLACE FUNCTION public.validate_friendship_before_group_insert()
RETURNS TRIGGER AS $$
DECLARE
    grp_owner UUID;
    is_friend BOOLEAN;
BEGIN
    SELECT owner_id INTO grp_owner FROM groups WHERE id = NEW.group_id;
    
    -- Owner joining their own group is naturally valid
    IF NEW.user_id = grp_owner THEN
        RETURN NEW;
    END IF;

    -- Check if friendship exists between owner and the new member
    SELECT EXISTS (
        SELECT 1 FROM friendships
        WHERE (user_low_id = LEAST(NEW.user_id, grp_owner) AND user_high_id = GREATEST(NEW.user_id, grp_owner))
    ) INTO is_friend;

    IF NOT is_friend THEN
        RAISE EXCEPTION 'Security violation: Group membership requires an existing mutual friendship.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_friend_only_membership
    BEFORE INSERT ON group_members
    FOR EACH ROW EXECUTE FUNCTION public.validate_friendship_before_group_insert();
```

---

## 5. Realtime Publication Configuration

Only tables requiring live synchronisation are added to the Supabase Realtime publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE current_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
```

---

## 6. Storage Bucket Definitions & Rules

```sql
-- Insert Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('group-media', 'group-media', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('temporary-uploads', 'temporary-uploads', false);
```
