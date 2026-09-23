---
name: testing-verification
description: "Comprehensive testing, build validation, and logical user flow verification skill for Neram. Use after implementing code changes, bug fixes, or features to verify unit tests, screen integration, auth flows, and Android production bundles."
---

# Testing & Verification

## Purpose
Prevent false declarations of completion. An agent must never declare success based on hunches or compilation alone. Every modification in Neram must be proven through automated type checking, zero-warning linting, automated Jest/RTL test suites, and verified end-to-end user journeys.

---

## When to Use
- After implementing or editing any feature, hook, service, component, or screen.
- After resolving bugs to confirm root-cause remediation and prevent regressions.
- Before submitting any task or pull request for review.
- When validating database migration scripts against application models.

---

## Mandatory Workflow
Execute this four-phase verification pipeline after any code modification:

$$\text{Static Analysis} \longrightarrow \text{Automated Test Suites} \longrightarrow \text{End-to-End Flow Verification} \longrightarrow \text{Production Build Check}$$

1. **Static Analysis**: Run TypeScript strict mode (`npm run typecheck`) and ESLint with zero-warning tolerance (`npm run lint`).
2. **Automated Test Suites**: Run the Jest test harness (`npm test`) covering unit, hook, and screen integration tests.
3. **End-to-End Flow Verification**: Trace and verify the end-to-end data and authentication lifecycles logically or interactively.
4. **Production Build Check**: Execute the Metro Android bundle export (`npx expo export --platform android --no-bytecode`) to verify bundle integrity.

---

## Detailed Rules

### 1. The Mandatory Authentication Verification Sequence
Whenever authentication, token storage, or route protection is touched, verify this exact sequence:

```text
1. Fresh Launch: App starts with status === 'INITIALIZING' rendering AuthLoadingScreen.
2. Auth Loading: Session check executes via ExpoSecureStoreAdapter.
3. Login Screen: If no session, status becomes 'UNAUTHENTICATED'; LoginScreen renders.
4. Cancelled OAuth: Cancel in Custom Tabs returns cleanly without error banner.
5. Valid Credentials: User authenticates with Google; PKCE/token exchange succeeds.
6. Identity Check:
   - If profile missing/incomplete: transitions to 'NEEDS_ONBOARDING' (OnboardingScreen).
   - If profile complete: transitions to 'AUTHENTICATED' (MainTabs).
7. Authenticated App: User navigates between Home, Friends, and Profile tabs.
8. Logout: Tapping 'Sign Out' purges KeyStore, resets state to 'UNAUTHENTICATED'.
9. Re-Login: User can immediately authenticate again without restart.
10. Session Restoration: Restarting the app restores authenticated session without prompt.
```

### 2. Major Feature Verification Sequence
For every major feature (e.g. Friends, Groups, Profile, Chat, Tasks):
Verify the complete bidirectional cycle across both happy and error paths:

$$\text{UI Action} \longrightarrow \text{Hook/State} \longrightarrow \text{Service Layer} \longrightarrow \text{Supabase / PostgreSQL} \longrightarrow \text{Response / Error} \longrightarrow \text{State Mutation} \longrightarrow \text{UI Update}$$

- **Happy Path**: Data mutation persists to database, triggers Realtime update or state refresh, and updates UI without manual page reload.
- **Error Path**: Database error, unique constraint violation, or network timeout is caught, leaves local state intact, and renders human-readable feedback.

### 3. Root-Cause Remediation Cycle
If any test, typecheck, or build fails:
1. **Diagnose**: Inspect the exact stack trace, compiler error, or test failure message.
2. **Fix the Root Cause**: Fix the faulty logic or constraint in the application code.
3. **Re-Test**: Run the test command again until it passes cleanly.
4. **NEVER Suppress**:
   - Never update test assertions to accept broken behavior.
   - Never mock away failing logic instead of fixing it.
   - Never use `// @ts-ignore` or `any`.

---

## Verification Requirements

### Command Execution Matrix
Run these four commands sequentially in PowerShell:

```powershell
# 1. Strict TypeScript validation (0 errors allowed)
npm run typecheck

# 2. Strict ESLint validation (0 warnings, 0 errors allowed)
npm run lint

# 3. Jest test suite (100% pass across all test suites)
npm test

# 4. Production Android bundle compilation
npx expo export --platform android --no-bytecode
```

All four commands must exit with code 0 before task completion.

---

## Common Mistakes to Avoid
- **Declaring Victory on Compilation Alone**: Believing code works because `tsc --noEmit` passed, without running Jest tests.
- **Mocking the Bug Away**: Changing Jest mocks in `tests/` so that tests pass while real production code remains broken.
- **Testing Only the Happy Path**: Never testing what happens when the network drops, the user denies permissions, or a duplicate record is submitted.
- **Ignoring Console Warnings**: Dismissing yellow box or Jest warnings as "just warnings". All warnings must be resolved.
- **Skipping Build Verification**: Failing to run `npx expo export` and discovering missing assets or syntax errors in Metro at deploy time.
