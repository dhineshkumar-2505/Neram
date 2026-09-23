---
name: project-audit
description: "Repository-aware architecture inspection and impact analysis workflow for Neram. Use before modifying, adding, or refactoring features to trace boundaries, dependencies, reusable components, and prevent regressions."
---

# Project Audit & Architecture

## Purpose
Enforce a disciplined, read-first engineering workflow. An agent must thoroughly understand Neram's architecture, documentation, data flows, and component boundaries before modifying or adding code, avoiding blind edits, redundant abstractions, and architectural regressions.

---

## When to Use
- At the start of any new feature implementation, enhancement, or refactoring pass.
- When investigating bugs that span multiple application layers (e.g., UI to database).
- Before altering navigation stacks, database schemas, authentication flows, or shared state.
- When onboarding to an unfamiliar feature folder in `src/features/`.

---

## Mandatory Workflow
Every modification must follow this immutable six-step progression:

$$\text{Read} \longrightarrow \text{Understand} \longrightarrow \text{Trace} \longrightarrow \text{Plan} \longrightarrow \text{Modify} \longrightarrow \text{Verify}$$

1. **Read**: Inspect `docs/` (`PROJECT_PLAN.md`, `DEVELOPMENT_RULES.md`, `UI_PLAN.md`, `SECURITY_PLAN.md`, `DATABASE_PLAN.md`) and relevant schemas in `supabase/migrations/`. Treat documented engineering laws as non-negotiable truth.
2. **Understand**: Examine the folder structure, existing interfaces in `src/types/`, and active state lifecycles before changing code.
3. **Trace**: Map the end-to-end data trajectory across all architectural tiers for the feature.
4. **Plan**: Formulate concrete changes. Check for downstream consumers and potential regressions. For non-trivial tasks, draft an implementation plan.
5. **Modify**: Apply targeted, minimal, and surgical code changes following existing patterns and strict TypeScript typing.
6. **Verify**: Run `npm run typecheck`, `npm run lint`, `npm test`, and prebuild/export checks to ensure zero regressions.

---

## Detailed Rules

### 1. Documented Specifications Are Ground Truth
- Always check `docs/PROJECT_PLAN.md` for milestone definitions and operational prerequisites (e.g., *Friendship must exist before group membership*; *Server controls group expiration*).
- Adhere strictly to the 20 engineering laws in `docs/DEVELOPMENT_RULES.md`.

### 2. Trace Architectural Boundaries
Always locate where the responsibility lies across the Neram stack:
```text
React Native / Expo UI Screen (src/features/<feature>/screens/)
  ↓
Bespoke Feature Components (src/features/<feature>/components/)
  ↓
Core Design System (src/components/ & src/design/tokens.ts)
  ↓
State / Hook Layer (src/contexts/, src/hooks/, src/features/<feature>/hooks/)
  ↓
Service / API Layer (src/features/<feature>/services/)
  ↓
Supabase Client Adapter (src/lib/supabase.ts & src/services/supabase/)
  ↓
PostgreSQL RLS, RPCs, & Triggers (supabase/migrations/)
```

### 3. Reuse Core UI Components Before Creating New Ones
Before creating ad-hoc buttons, inputs, or cards, inspect `src/components/`:
- `Screen`: Safe-area-aware container with default Obsidian background and light status bar.
- `Text`: Dynamic typography enforcing `tokens.typography.sizes` and `lineHeights`.
- `Button`: Primary, secondary, outline, ghost, and danger variants with built-in loading states.
- `Input`: Label, error, hint, prefix, suffix, and debounced text handling.
- `Card`: Outlined, subtle, and elevated surfaces styled for Obsidian Dark.
- `LoadingState`, `EmptyState`, `ErrorState`: Universal screen feedback components.

### 4. Respect Strict Database Type Definitions
- All database entities must correspond to TypeScript types in `src/types/database.ts` and feature types in `src/types/`.
- Never use TypeScript `any`. If a Supabase query returns generic JSON or join rows, write explicit raw interfaces and map them cleanly (see `RawFriendshipRow` in `src/features/friends/services/friendsService.ts`).

### 5. Check Related Implementations & Impact Radius
- Never assume a bug or feature exists in a single isolated file.
- When altering a service method, check all calling hooks, screen components, and test files under `tests/`.
- Ensure changes in one tab or navigation stack do not break route parameters in `src/navigation/types.ts`.

---

## Verification Requirements
Before declaring the audit and planning complete:
- [ ] Documented dependencies verified against `PROJECT_PLAN.md`.
- [ ] Existing reusable components identified in `src/components/`.
- [ ] Database constraints and RLS policies checked in `supabase/migrations/` or live PostgreSQL.
- [ ] Transitive call-sites identified across `src/` and `tests/`.
- [ ] Verification command sequence planned: `npm run typecheck && npm run lint && npm test`.

---

## Common Mistakes to Avoid
- **Blind Editing**: Modifying a screen file without checking if navigation parameters in `src/navigation/types.ts` or database constraints in PostgreSQL match.
- **Reinventing the Wheel**: Re-implementing text inputs, buttons, or custom colors instead of using `src/components/` and `src/design/tokens.ts`.
- **Ignoring Dependency Sequencing**: Attempting to implement group features before friend relationships exist, violating Phase 3/4 prerequisites.
- **Premature Refactoring**: Rewriting working services or adapters (like `ExpoSecureStoreAdapter`) without explicit architectural justification.
- **Single-File Tunnel Vision**: Fixing a type in a service file but forgetting to update its mock in `tests/services/`.
