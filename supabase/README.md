# Neram Supabase Infrastructure & Security Architecture

This directory houses the complete PostgreSQL backend schema, Row Level Security (RLS) policies, database triggers, Realtime configuration, storage policies, and security test suites for the Neram platform.

The PostgreSQL database enforces the application's integrity and security rules independently of the React Native mobile client.

---

## 1. Migration Sequence & Inventory

Migrations are version-controlled under `supabase/migrations/` and executed sequentially in alphabetical/timestamp order:

1. **`20260922000001_create_enums_and_types.sql`**:
   - Custom PostgreSQL enums: `group_purpose`, `lifecycle_state`, `group_role`, `friend_request_status`, `task_status`, `task_priority`, `location_session_status`, `notification_type`.
   - Utility trigger function: `trigger_set_updated_at()`.

2. **`20260922000002_create_profiles_and_devices.sql`**:
   - `profiles` table: 1-to-1 link with `auth.users(id)` with auto-provisioning trigger on auth signup.
   - Normalized unique lower-cased username index (`citext`/`lower(username)` pattern, alphanumeric + underscores, 3-30 chars).
   - Exact username lookup RPC: `search_exact_username(text)` (no fuzzy search, prevents enumeration).
   - `user_devices` table: FCM/APNS push tokens isolated strictly to the owning user via RLS.

3. **`20260922000003_create_social_graph.sql`**:
   - `blocks` table: Prevents interactions and invitations between blocked users.
   - `friendships` table: Unordered canonical pair representation (`user_low_id < user_high_id`) with sort normalization trigger preventing duplicates regardless of order.
   - `friend_requests` table: Request lifecycle (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`).
   - Helper functions: `are_friends(user_a, user_b)` and `is_blocked(user_a, user_b)`.
   - RPC: `respond_to_friend_request(request_id, accept)` with atomic friendship insertion.

4. **`20260922000004_create_groups_and_membership.sql`**:
   - `groups` table: Ephemeral purpose-driven groups with check constraint `expires_at > starts_at`.
   - `group_members` table: `OWNER`, `ADMIN`, `MEMBER` roles.
   - `group_features` table: Modular feature toggles (`CHAT`, `TASKS`, `FILES`, `EVENTS`, `POLLS`, `LOCATION`).
   - **CRITICAL LAW**: `trg_enforce_friend_only_membership` trigger and RLS enforce that invitees MUST be an accepted mutual friend of an active group `OWNER` or `ADMIN`. Direct API calls bypassing the UI are rejected at the database engine level.
   - Auto-creator trigger adding group creator as initial `OWNER` and provisioning default feature modules.

5. **`20260922000005_create_collaboration_modules.sql`**:
   - `files` metadata table: Tracks files stored in private Supabase Storage buckets (Postgres never stores binary blobs).
   - `messages` & `message_attachments` tables: Ephemeral group chat, soft deletes (`deleted_at`), reply threading. Write blocked if group is expired or feature disabled.
   - `tasks` & `task_assignees` tables: Multi-assignee task management, priority/status enums, group membership check trigger on assignees.
   - `events` table: Scheduled group activities with geographical coordinates.
   - `polls`, `poll_options`, `poll_votes` tables: Single-vote poll enforcement via unique index `idx_poll_votes_unique_user_vote`.

6. **`20260922000006_create_location_and_notifications.sql`**:
   - `location_sessions` table: Active time-boxed group rendezvous with destination coordinates.
   - `current_locations` table: Privacy-first ephemeral table storing ONLY the latest live GPS coordinate for an active session (`session_id` PK). Overwritten continuously; zero historical GPS logs or breadcrumbs exist.
   - `notifications` table: Push notification inbox isolated to recipient.
   - `audit_logs` table: Immutable tamper-resistant security audit log for security-critical actions.
   - Realtime publication: Enabled on `messages`, `tasks`, `group_members`, `notifications`, `current_locations`, `groups`.

7. **`20260922000007_create_storage_buckets_and_policies.sql`**:
   - Private Supabase Storage buckets: `avatars`, `group-media`, `attachments`, `temporary-uploads`.
   - Storage RLS policies on `storage.objects` enforcing authenticated access, ownership, and group membership.

8. **`20260922000008_security_hardening.sql`**:
   - Revokes `PUBLIC` and `anon` execution on all custom `SECURITY DEFINER` functions.
   - Restricts internal trigger functions from RPC exposure.
   - Grants least-privilege `EXECUTE` on client RPCs to `authenticated`.

---

## 2. Local Development & Deployment

### Prerequisites
- Docker Desktop (for local Supabase CLI execution)
- Node.js 18+ and npm
- Supabase CLI (`npx supabase`)

### Applying Migrations
To apply migrations against the connected Supabase cloud project or local Docker instance:
```bash
# Against local Docker stack:
npx supabase migration up

# Against linked cloud project:
npx supabase db push
```

---

## 3. Database Security Testing

The test suite in `supabase/tests/database_security_tests.sql` validates all 16 core security assertions:
1. Anonymous write/read rejected.
2. Cross-user private data access blocked (devices, notifications).
3. Non-friends rejected when added to groups.
4. Standard members blocked from inviting users.
5. Admins allowed to invite accepted friends.
6. Owners allowed to invite accepted friends.
7. Expired groups reject writes (messages, tasks, locations).
8. Non-members cannot read group messages.
9. Non-members cannot read group location.
10. Users cannot alter or acknowledge another user's notifications.
11. Duplicate friendships rejected by canonical constraint.
12. Duplicate group memberships rejected.
13. Duplicate task assignments rejected.
14. Duplicate single-vote poll votes rejected.
15. Groups with `expires_at <= starts_at` rejected.
16. Blocked users cannot bypass friendship or group membership.

### Running Tests
Execute the test file in Supabase SQL Editor or via MCP:
```sql
\i supabase/tests/database_security_tests.sql
```
Expected output: 16 rows with status `PASSED`.

---

## 4. Generating TypeScript Database Types

TypeScript types representing the live PostgreSQL schema are generated directly into `src/types/database.ts`:

```bash
# Using Supabase CLI:
npx supabase gen types typescript --project-id <project_ref> > src/types/database.ts

# Or for local development:
npx supabase gen types typescript --local > src/types/database.ts
```

---

## 5. Core Security Assumptions & Guarantees

1. **Zero-Trust Client Boundary**:
   The React Native mobile client is untrusted. Malicious clients cannot bypass business rules by calling PostgREST or GraphQL directly.
2. **Authoritative Server Time**:
   Group expiry relies strictly on PostgreSQL `now()`. Mobile clock tampering cannot extend group lifetimes.
3. **Friend-Only Group Invariant**:
   Only active group `OWNER` or `ADMIN` members can invite users, and only if an accepted mutual friendship exists.
4. **Zero GPS History Retention**:
   The `current_locations` table stores only the latest state for an active session. No historical GPS breadcrumb table exists in the database architecture.
5. **Private Storage by Default**:
   All storage buckets are private. Objects are accessed through short-lived signed URLs or verified group member policies.
