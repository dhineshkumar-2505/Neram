# Purpose-Driven Temporary Social Platform: Master Security Plan

## 1. Security Philosophy & Non-Negotiables

Security in this platform is built on **Zero Trust in the Client**. 
1. **The UI is never a security boundary**: Hiding a button, masking an input, or omitting a screen does not protect data.
2. **Every API mutation and query must pass PostgreSQL Row Level Security (RLS)** or execute within a cryptographically verified Edge Function.
3. **Friendship is a mandatory security precondition**: Nobody can enter a group without an accepted mutual friendship with the group authority.
4. **Physical location is high-risk telemetry**: Coordinates must be strictly ephemeral, group-scoped, permissioned, and automatically expirable.
5. **No client-side clock tampering**: Expiration, time-windows, and token lifetimes are strictly determined by the server database clock (`now()`).

---

## 2. Authentication & Identity Architecture

### 2.1 Supabase Auth & Google OAuth
- **Provider**: Google OAuth 2.0 via Supabase GoTrue with secure PKCE (Proof Key for Code Exchange) flow on native mobile.
- **Hardware-Backed Token Storage**: Refresh and access tokens are saved in iOS Keychain (via `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) and Android Keystore (via encrypted SharedPreferences) using `expo-secure-store`.
- **JWT Claims**: Supabase issues an RS256 signed JWT containing `sub` (User UUID), `role` (`authenticated`), and standard expiry claims (`exp` set to 3600 seconds).

---

## 3. Authorization & Role-Based Access Control (RBAC)

### 3.1 Role Hierarchy
Within each group, users occupy one of three discrete roles:
1. **`OWNER`**: Full administrative power. Can alter group settings, invite/remove members, enable/disable modules, change roles, trigger early expiration, and delete the group.
2. **`ADMIN`**: Delegated authority. Can invite members (must still be mutual friends), manage tasks, pin events, and moderate content. Cannot demote or remove the Owner.
3. **`MEMBER`**: Operational collaborator. Can read/post messages, create/complete tasks, cast poll votes, view events, upload files, and participate in location sessions. Cannot change group settings.

### 3.2 Permission Matrix
| Action | Owner | Admin | Member | Non-Member / Stranger |
| :--- | :---: | :---: | :---: | :---: |
| **View Group Interior** | ✅ | ✅ | ✅ | ❌ (RLS Deny) |
| **Send Messages / Upload Files** | ✅ | ✅ | ✅ | ❌ |
| **Invite New Members** | ✅ | ✅ (Friends only) | ❌ | ❌ |
| **Remove Members** | ✅ | ✅ (Members only)| ❌ | ❌ |
| **Toggle Group Modules** | ✅ | ❌ | ❌ | ❌ |
| **View Live Outing Map** | ✅ | ✅ | ✅ (If session active) | ❌ |
| **Transmit Live Location** | ✅ | ✅ | ✅ (Opt-in only) | ❌ |
| **Trigger Early Expiration** | ✅ | ❌ | ❌ | ❌ |
| **Post-Expiry Read (Archived)**| ✅ | ✅ | ✅ | ❌ |
| **Post-Expiry Write/Mutate** | ❌ | ❌ | ❌ | ❌ |

---

## 4. Row Level Security (RLS) Strategy

Row Level Security is enabled on **100% of tables** without exception:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### 4.1 Reusable Security Helper Functions
To avoid costly recursive subqueries and ensure DRY security definitions:

```sql
-- Check if user is active member of group
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_user_id AND left_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Check if group is currently active (not expired)
CREATE OR REPLACE FUNCTION public.is_group_active(p_group_id UUID)
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = p_group_id
          AND lifecycle_state IN ('CREATED', 'ACTIVE', 'EXPIRING')
          AND now() < expires_at
    );
END;
$$ LANGUAGE plpgsql;

-- Check mutual friendship
CREATE OR REPLACE FUNCTION public.are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friendships
        WHERE user_low_id = LEAST(p_user_a, p_user_b)
          AND user_high_id = GREATEST(p_user_a, p_user_b)
    );
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Key Concrete RLS Policies

#### Messages: Read & Insert Policies
```sql
-- Read: Member of the group can view messages
CREATE POLICY "Members can view messages" ON public.messages
    FOR SELECT USING (public.is_group_member(group_id, auth.uid()));

-- Insert: Must be active member AND group must NOT be expired
CREATE POLICY "Active members can insert messages in active groups" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND public.is_group_member(group_id, auth.uid())
        AND public.is_group_active(group_id)
    );
```

#### Friend-Only Group Membership Security
```sql
-- Insert: Non-owner additions require mutual friendship with the inviter/owner
CREATE POLICY "Admins can only add existing mutual friends" ON public.group_members
    FOR INSERT WITH CHECK (
        -- Self-insertion if owner
        (user_id = auth.uid() AND EXISTS (SELECT 1 FROM groups WHERE id = group_id AND owner_id = auth.uid()))
        OR
        -- Addition by owner/admin who is mutual friends with the invitee
        (
            (EXISTS (SELECT 1 FROM group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')))
            AND public.are_friends(auth.uid(), user_id)
        )
    );
```

#### Module Permissions Enforcement
If a module (e.g. `TASKS` or `CHAT`) is disabled in `group_features`, RLS blocks interaction:
```sql
CREATE POLICY "Tasks require TASKS feature enabled" ON public.tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_features
            WHERE group_id = tasks.group_id AND feature_key = 'TASKS'
        )
        AND public.is_group_member(group_id, auth.uid())
        AND public.is_group_active(group_id)
    );
```

---

## 5. Location Privacy & Ephemeral Telemetry

Location data constitutes the most sensitive telemetry in the platform.

### Strict Privacy Controls:
1. **Opt-in Only**: Location transmission never begins automatically. The user must tap an explicit "Share Location" action.
2. **Session Scoped**: Coordinates are only transmitted if a valid `location_sessions` row exists with `status = 'ACTIVE'` and `now() < ends_at`.
3. **Group Isolation**: Only fellow active members of that specific group can read the `current_locations` table or receive realtime location broadcasts.
4. **Zero History**: `current_locations` maintains only 1 row per active session. Past coordinates are overwritten, never archived into a historical breadcrumb trail.
5. **Auto-Termination**:
   - Reaching destination geofence ($\le 50\text{m}$) sets status to `ARRIVED` and halts transmission.
   - Group transition to `EXPIRED` triggers an immediate cascade terminating all location sessions and deleting `current_locations` records.

```sql
CREATE POLICY "Location visible only to active group members" ON public.current_locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.location_sessions ls
            WHERE ls.id = current_locations.session_id
              AND ls.status = 'ACTIVE'
              AND public.is_group_member(ls.group_id, auth.uid())
        )
    );
```

---

## 6. Storage Security & Signed URLs

### Bucket Permissions & Access Patterns:
1. **`avatars`**:
   - `SELECT`: Public access permitted.
   - `INSERT / UPDATE`: Authenticated user matching folder name: `auth.uid() = (storage.foldername(name))[1]`.
2. **`group-media`**:
   - `SELECT / INSERT`: Allowed only if `public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())`.
3. **`attachments` (Documents, Chat Files)**:
   - Completely private. Zero public access.
   - Files are fetched exclusively using short-lived (15-minute) HMAC **Signed URLs** generated by the Supabase Storage API after verifying group membership.

---

## 7. Username Enumeration Protection & Rate Limiting

### Threat:
Attackers searching for partial names (e.g., `@d`, `@dh`, `@dhi`) to scrape the user directory.

### Countermeasures:
1. **Exact-Match Query Only**:
   The search endpoint uses strict equality on normalized lowercase username:
   ```sql
   WHERE username = lower(trim(p_search_query))
   ```
   Wildcard searching (`LIKE '%query%'` or `ILIKE 'query%'`) is explicitly forbidden.
2. **Constant-Time RPC Response**:
   The RPC `search_exact_username` returns a minimal object (`user_id`, `username`, `display_name`, `avatar_path`) and introduces a synthetic jittered delay (50–100ms) to counteract timing attacks.
3. **Rate Limiting**:
   The Edge Function limits search queries to **10 requests per minute per IP/User UUID**. Exceeding this returns HTTP 429 Too Many Requests.

---

## 8. Threat Model & Security Mitigations

| Threat Vector | Severity | Attack Mechanism | Implemented Mitigation |
| :--- | :---: | :--- | :--- |
| **Clock Tampering** | High | Client manipulates system clock to keep expired group alive. | Expiry checks run entirely on PostgreSQL `now()`. Device time affects only visual UI. |
| **Membership Tampering** | Critical | Attacker attempts to inject stranger into group via direct API. | DB trigger and RLS check enforce `are_friends()` prior to insert. Non-friends raise DB exception. |
| **Location Surveillance**| Critical | Malicious member eavesdrops on GPS after outing ends. | Arrived state or expired group terminates session; backend deletes coordinates immediately. |
| **Cross-Group Leakage** | High | User sends queries guessing UUIDs of other groups. | RLS validates `is_group_member(group_id, auth.uid())` on every select and mutation. |
| **Replay / Spoofing** | Medium | Attacker captures and replays location coordinates. | Coordinates require `recorded_at` within 60s of server `now()` and an active session ID. |
| **Storage Traversal** | High | Attacker guesses S3 file paths to access private attachments. | Attachment bucket has public access disabled; download requires valid HMAC signed token. |

---

## 9. Security Test Cases

The following test suites must be executed before deployment:
1. **RLS Negative Tests**:
   - Attempt `INSERT` to `group_members` for a non-friend $\to$ Must return SQL error / 403.
   - Attempt `INSERT` to `messages` for an expired group $\to$ Must return 403 Forbidden.
   - Attempt `SELECT` on `messages` from a group the user does not belong to $\to$ Must return 0 rows.
2. **Location Privacy Tests**:
   - Query `current_locations` for a session that has status `ARRIVED` $\to$ Must return empty result.
   - Query `current_locations` from a non-member account $\to$ Must return 0 rows.
3. **Anti-Enumeration Tests**:
   - Issue 15 consecutive username searches in $<30$ seconds $\to$ Requests 11–15 must return HTTP 429.
   - Search for partial prefix `@dhin` when user `@dhinesh` exists $\to$ Must return empty null result.
