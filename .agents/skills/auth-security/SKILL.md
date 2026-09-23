---
name: auth-security
description: "Authentication and zero-trust security audit skill for Neram. Use when touching authentication flows, Google OAuth, session persistence (SecureStore), token handling, Supabase RLS, Edge Functions, or security-sensitive RPCs."
---

# Authentication & Security

## Purpose
Enforce rigorous, zero-trust security across Neram. The client application is an untrusted runtime environment. Every identity verification, session persistence, and authorization check must be authoritative, cryptographically verified, and backed by hardware encryption and PostgreSQL Row Level Security (RLS).

---

## When to Use
- Whenever modifying `src/services/auth/`, `src/contexts/AuthContext.tsx`, or `src/services/supabase/secureStoreAdapter.ts`.
- When adding or changing RLS policies, PostgreSQL triggers, or `SECURITY DEFINER` RPC functions in `supabase/migrations/`.
- When modifying Android deep links (`neram://auth/callback`), `app.json`, or OAuth redirect URIs.
- When working on protected navigation boundaries in `src/navigation/RootNavigator.tsx`.

---

## Mandatory Workflow
Any modification touching authentication or security must execute this verification sequence:

$$\text{Scope Check} \longrightarrow \text{Credential Audit} \longrightarrow \text{OAuth Chain Trace} \longrightarrow \text{RLS Verification} \longrightarrow \text{Session Test}$$

1. **Scope Check**: Determine if the change affects client authentication state, token storage, deep links, or database RLS policies.
2. **Credential Audit**: Verify that zero secrets (service role keys, private certificates) are bundled into client code. Ensure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are referenced.
3. **OAuth Chain Trace**: Trace the Google OAuth callback chain from browser custom tabs to local session creation and profile resolution.
4. **RLS Verification**: Verify that PostgreSQL RLS policies evaluate `(SELECT auth.uid())` and reject unauthorized inserts, updates, deletes, and selects natively.
5. **Session Test**: Validate login, session persistence in Android KeyStore, token refresh, and complete state purge upon logout.

---

## Detailed Rules

### 1. The Authoritative Google OAuth Chain (Android Only)
Verify the complete end-to-end OAuth trajectory:
```text
User taps "Continue with Google" (src/features/auth/screens/LoginScreen.tsx)
  ↓
signInWithGoogle() initiates OAuth with redirectTo: 'neram://auth/callback' (src/services/auth/googleAuth.ts)
  ↓
WebBrowser.openAuthSessionAsync opens Android Custom Tabs
  ↓
Google Authenticates & redirects to Supabase Auth GoTrue endpoint
  ↓
GoTrue redirects to deep link 'neram://auth/callback' with PKCE code or tokens
  ↓
extractParamsFromUrl parses URL, preserving '=' in Base64 tokens and decoding '+' to spaces
  ↓
exchangeCodeForSession(code) or setSession({ access_token, refresh_token })
  ↓
supabase.auth.onAuthStateChange fires SIGNED_IN event (src/contexts/AuthContext.tsx)
  ↓
fetchProfile(userId) queries public.profiles
  ↓
checkNeedsOnboarding(profile) determines status (NEEDS_ONBOARDING vs AUTHENTICATED)
  ↓
RootNavigator reactively mounts OnboardingScreen or MainTabNavigator via key={status}
```

#### Android OAuth Verification Checklist:
- **Package ID**: Must be `com.neram.app` in `app.json`.
- **Scheme**: Must be `neram` in `app.json`.
- **Redirect URI**: Must match `neram://auth/callback` in Supabase Auth Allowed Redirect URLs.
- **Plugins**: `expo-dev-client`, `expo-secure-store`, `expo-web-browser` declared in `app.json`.
- **Custom Tab Warmup**: `WebBrowser.maybeCompleteAuthSession()` called at module root.
- **Cancellation**: If `authResult.type === 'cancel' || 'dismiss'`, return `{ cancelled: true }` without displaying jarring error alerts.

### 2. Hardware-Backed Session Storage (`ExpoSecureStoreAdapter`)
- Never use unencrypted `AsyncStorage` for session tokens.
- All auth tokens must be stored using `ExpoSecureStoreAdapter` (`src/services/supabase/secureStoreAdapter.ts`), utilizing Android KeyStore and `EncryptedSharedPreferences`.
- Payloads exceeding Android KeyStore's 2048-byte limit must be automatically chunked at the 1800-byte threshold (`___CHUNKED___:` pointer).
- `removeItem` must cleanly purge all chunk keys (`${key}_chunk_${i}`) to prevent orphaned token fragments.

### 3. Absolute Security Laws (From DEVELOPMENT_RULES.md)
1. **NEVER Bypass Row Level Security (RLS)**:
   - Every single table in PostgreSQL must have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - The Supabase Service Role key is strictly forbidden in the client app.
2. **NEVER Trust Client-Provided User IDs**:
   - Never trust `userId` passed in a mutation payload. RLS policies must strictly verify `(SELECT auth.uid()) = user_id` or `(SELECT auth.uid()) = sender_id`.
3. **NEVER Use UI Visibility as Security**:
   - Disabling buttons or hiding screens is purely UX. Direct API requests must be rejected natively by Postgres.
4. **Mutual Friendship Is Mandatory for Group Entry**:
   - Database triggers and RLS must enforce `public.are_friends(auth.uid(), target_user_id)` before adding any member to a temporary group.
5. **Server Exclusively Controls Expiry**:
   - Client clocks cannot be trusted. Server `now()` in PostgreSQL determines whether groups, sessions, or tokens are expired.

---

## Verification Requirements
Every authentication or security change must pass this complete test harness:

```text
1. Fresh Launch: App starts with status === 'INITIALIZING' displaying AuthLoadingScreen.
2. Unauthenticated: Renders LoginScreen with branded TimeGlyph and Google button.
3. Invalid / Cancelled OAuth: Cancel returns gracefully without blocking errors.
4. Valid OAuth: Tokens exchanged cleanly, profile fetched, status transitions to NEEDS_ONBOARDING or AUTHENTICATED.
5. Navigation Switch: key={status} ensures instant switch without stale screen retention.
6. Session Persistence: App reload / restart hydrates session from KeyStore without re-login.
7. Logout: signOut() revokes server session, purges KeyStore chunks, and returns to LoginScreen.
8. Route Guard: Unauthenticated access to MainTabs or GroupDetail is impossible.
```

Run automated validation:
```powershell
npm test tests/auth/
npm run typecheck
```

---

## Common Mistakes to Avoid
- **Treating Client UI as Security**: Believing data is safe because a button is hidden or a screen is not in the bottom tab bar.
- **Naive URL Param Splitting**: Using `str.split('=')` on OAuth callback URLs, truncating Base64 JWTs ending with `=` padding.
- **False Onboarding on Network Flakes**: Falsely forcing an authenticated user into `NEEDS_ONBOARDING` when a network timeout occurs while fetching `profiles`.
- **Orphaned KeyStore Chunks**: Overwriting a chunked session with a single session without deleting old `${key}_chunk_*` entries.
- **Hardcoding Test UUIDs**: Hardcoding user IDs or auth headers in production services instead of obtaining them from `supabase.auth.getSession()`.
