---
name: production-readiness
description: "Pre-ship audit and hardening gate for Neram. Use when completing a feature, milestone, or major phase to verify code cleanliness, error resiliency, Realtime subscriptions, battery efficiency, and build stability."
---

# Production Readiness

## Purpose
Serve as an uncompromising pre-ship audit gate. Before any feature, milestone, or phase is considered complete, it must be thoroughly hardened, verified against edge cases, purged of temporary scaffolding, and proven production-ready across code quality, resiliency, performance, and build pipelines.

---

## When to Use
- At the conclusion of a development phase (e.g., Phase 4 Group Engine, Phase 5 Realtime Messaging, Phase 7 Outing Coordination).
- Prior to asking for user sign-off or shipping code to production.
- When performing scheduled repository-wide health and integration checks.

---

## Mandatory Workflow
Execute this five-step pre-ship hardening gate before declaring any feature complete:

$$\text{Code Hygiene} \longrightarrow \text{Resiliency Audit} \longrightarrow \text{Realtime \& Leaks} \longrightarrow \text{Performance Audit} \longrightarrow \text{Full Build Validation}$$

1. **Code Hygiene**: Scan the codebase to eliminate TODOs, temporary debugging logs, unused imports, mock test data, and loose TypeScript types.
2. **Resiliency Audit**: Verify how the system behaves under network loss, server errors, database constraint violations, and session expirations.
3. **Realtime & Leaks**: Audit all event listeners, Realtime channels, and background intervals for guaranteed cleanup upon unmount.
4. **Performance Audit**: Check query efficiency, re-render bottlenecks, and location telemetry battery drain.
5. **Full Build Validation**: Run the complete build pipeline: Typecheck (`0 errors`), Lint (`0 warnings`), Jest tests (`100% pass`), and Metro production bundling.

---

## Detailed Rules

### 1. Code Cleanliness & Hygiene Checklist
Search for and ruthlessly eliminate:
- [ ] **No `console.log` statements**: Only `console.warn` or `console.error` guarded by `if (__DEV__)` are permitted.
- [ ] **Zero Mock Data in Production Code**: Ensure mock objects used during spikes are moved to `tests/` and never referenced in `src/`.
- [ ] **No Unresolved TODOs**: Implement the feature or remove obsolete TODO comments.
- [ ] **No Dead Code / Unused Imports**: Unused variables, components, or imports must be removed.
- [ ] **Zero TypeScript `any`**: Explicitly type all data structures using `src/types/` and Zod/TypeScript schemas.
- [ ] **No Suppressed Errors**: Never use `@ts-ignore`, empty catch blocks, or bypass linters.

### 2. Failure State & Resiliency Matrix
Every asynchronous operation must gracefully handle these five failure vectors:
1. **Network Disconnection / Timeout**: Display a non-blaming error state or offline indicator; never crash or spin indefinitely.
2. **Expired Session**: Automatically trigger token refresh; if refresh fails, cleanly transition to `UNAUTHENTICATED`.
3. **Database Constraint Rejections**: Handle unique constraint conflicts (e.g. duplicate username or friend request) and show contextual human-readable feedback.
4. **Permission Denied**: Catch RLS 403 / 401 exceptions without exposing internal PostgreSQL column names.
5. **Empty Result Sets**: Render a contextual `EmptyState` with a clear recovery or creation button.

### 3. Realtime Channels & Memory Leak Prevention
- Every `supabase.channel()` subscription in a `useEffect` must have a corresponding cleanup:
  ```typescript
  useEffect(() => {
    const channel = supabase.channel(`channel_${id}`).on(...).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);
  ```
- All async callbacks in hooks or screens must track mount state (`isMountedRef` or `isCancelled` flag) to prevent state updates after unmount.

### 4. Performance & Battery Efficiency (Geospatial Rules)
If writing or modifying location tracking code:
- **Stationary Suppression**: Transmit zero network updates when stationary (delta $<15\text{m}$ and speed $<0.5\text{m/s}$).
- **Adaptive Frequency**: Strictly follow `docs/LOCATION_PLAN.md`:
  - Walking: $30\text{s}$ or $15\text{m}$
  - Driving: $10\text{s}$ or $50\text{m}$
- **Arrival Termination**: Automatically halt tracking upon reaching destination ($\le 50\text{m}$) or upon group expiry.
- **Single Coordinate Row**: Ensure `current_locations` maintains only 1 row per active session. Never write historical breadcrumb trails.

### 5. Absolute Non-Negotiables (Fix Root Causes)
Never under any circumstances:
- Comment out broken code to make a test pass.
- Disable authentication or bypass RLS policies.
- Replace real backend functionality with hardcoded mock responses.
- Ignore TypeScript or ESLint compiler errors.
- Claim a task is complete without running the verification commands.

---

## Verification Requirements
Before issuing the final report:
1. **Type Check**:
   ```powershell
   npm run typecheck
   ```
   *Must exit with code 0 (0 errors).*
2. **Lint Check**:
   ```powershell
   npm run lint
   ```
   *Must exit with code 0 (0 warnings, 0 errors).*
3. **Automated Tests**:
   ```powershell
   npm test
   ```
   *100% test suites must pass cleanly without warnings.*
4. **Metro Production Export**:
   ```powershell
   npx expo export --platform android --no-bytecode
   ```
   *Must package the complete module bundle into `dist` with exit code 0.*

---

## Common Mistakes to Avoid
- **"It Compiles So It Works"**: Assuming code is bug-free because TypeScript compiled, without testing failure scenarios.
- **Leaked Realtime Subscriptions**: Creating multiple overlapping channel subscriptions on every tab press or state change.
- **Silent Failures**: Swallowing catch blocks with `catch (err) {}` leaving the UI stuck in a loading state.
- **Database Mismatch**: Assuming column lengths without verifying PostgreSQL table constraints in `supabase/migrations/`.
- **Accidental Hardcoded Secrets**: Leaving test API keys or tokens in code files.
