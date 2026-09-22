# Purpose-Driven Temporary Social Platform: Development Rules & Engineering Laws

These rules are **mandatory, non-negotiable architectural laws**. Every contributor, subagent, and automated process working on this codebase must adhere to them.

---

## 1. Security & Authorization Laws

1. **NEVER Bypass Row Level Security (RLS)**
   - Every single table in PostgreSQL must have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Never query or mutate the database using the Supabase Service Role key inside the mobile client or frontend applications. The Service Role key is strictly reserved for secure Edge Functions running trusted backend jobs.

2. **NEVER Trust the Client for Authorization**
   - The client application is an untrusted runtime environment.
   - Any check performed on the client (e.g. checking user roles to hide an admin button) is strictly for user experience, never for security. Every permission check must be independently verified by PostgreSQL RLS or backend Edge Functions.

3. **NEVER Use UI Visibility as a Security Mechanism**
   - Hiding an input, disabling a button, or concealing a screen does not protect data. 
   - A malicious client can issue direct REST, GraphQL, or WebSocket calls bypassing the UI entirely. The database must reject unauthorized requests natively.

4. **Friendship MUST Exist Before Group Membership**
   - A user can ONLY be added or invited to a group if an accepted, mutual friendship exists between the invitee and the inviter/owner.
   - This rule must be enforced by PostgreSQL database triggers and Edge Function verification before any membership record can be inserted.

5. **Backend Exclusively Controls Group Lifecycle**
   - Group expiration and state transitions are owned by the server.
   - Never trust the device clock for lifecycle evaluation or authorization. Server `now()` in PostgreSQL is the sole source of temporal truth.

6. **NEVER Expose Secrets in the Client**
   - Only the public Supabase URL and Supabase Anonymous Key (`anon`) are permitted in the client bundle.
   - Database connection strings, service role keys, push notification server credentials, and external API master keys must reside strictly in Supabase Secrets / Environment Variables.

---

## 2. Geospatial & Location Privacy Laws

7. **Location is Strictly Opt-In**
   - Location tracking must never initiate automatically. 
   - The user must explicitly trigger tracking via a clear, unambiguous action inside an active outing group.

8. **Location is Strictly Group-Scoped**
   - Coordinates emitted during an outing must never be readable or broadcast outside of that specific group's active membership.

9. **Location is Temporary & Ephemeral**
   - Tracking is active only during an open `location_session` whose duration cannot exceed the group's lifespan.
   - Reaching destination arrival ($\le 50\text{m}$) or group expiration must immediately terminate tracking and revoke location broadcasts.

10. **Do NOT Store Raw GPS History by Default**
    - The platform is a coordination tool, not a surveillance engine.
    - `current_locations` maintains only the latest coordinate fix per active session. Past coordinates must not be persisted into a historical breadcrumb trail.

11. **Aggressively Optimize Battery Usage**
    - Never poll GPS at high frequency when the user is stationary.
    - Separate GPS sensor sampling from network transmission. Suppress updates entirely if movement delta is $<15\text{m}$ and speed is $<0.5\text{m/s}$.
    - Measure battery drain on physical devices before declaring location features complete.

---

## 3. UI, Aesthetics & Design System Laws

12. **Do NOT Use Emojis as UI Icons**
    - Emojis in place of professional icons degrade aesthetic quality and feel amateur.
    - All interface icons must come from a single, consistent custom SVG / professional vector icon set.

13. **Use ONE Consistent Icon Language**
    - All vector icons must share identical optical stroke weights ($2\text{pt}$), corner roundings, and bounding boxes ($24\text{pt}$). Mixing icon packs with conflicting visual languages is forbidden.

14. **Avoid the Cheap "AI / Generic Dashboard" Aesthetic**
    - Do not fill screens with meaningless charts, generic repetitive cards, random rainbow gradients, or excessive glassmorphism.
    - Adhere strictly to the design tokens: 4pt/8pt spatial rhythm, curated HSL color palette (Indigo-Violet, Deep Teal, Slate), and typography-first hierarchy.

15. **Every Major Screen Requires Four Mandatory States**
    - Every primary screen must implement:
      1. **Loading State**: Purposeful skeleton screen preserving optical height.
      2. **Empty State**: Clear explanation of context with a prominent next action.
      3. **Error State**: Non-blaming explanation with a retry mechanism.
      4. **Offline State**: Visual banner indicating cached data with disabled or queued mutations.

---

## 4. Architecture & Dependency Management Laws

16. **Prefer a Modular Monolith (Do NOT Introduce Microservices Unnecessarily)**
    - Do not prematurely split the backend into independent services, Kubernetes clusters, Kafka topics, or Redis instances.
    - Leverage Supabase PostgreSQL, Edge Functions, Storage, and Realtime as a unified core until concrete performance measurements prove a specific bottleneck.

17. **Do NOT Add Dependencies Without Justification**
    - Every new third-party library introduced into `package.json` increases bundle size, native maintenance burden, and security surface.
    - Adding any dependency requires explicit justification evaluating its bundle impact, native bridging requirements, and license.

18. **Do NOT Rewrite Working Code Unnecessarily**
    - Refactoring must be driven by explicit architectural necessity, bug remediation, or performance optimization—never personal stylistic whims.
    - Preserve existing comments, types, and established patterns.

---

## 5. Engineering Rigor & Quality Laws

19. **Do NOT Claim a Feature is Complete Without Testing It**
    - A feature is incomplete if it has only been tested on the happy path in a simulator.
    - Edge cases, poor network scenarios, permission revocations, and unauthorized access attempts must be tested.

20. **Run Type Checking and Tests After Meaningful Changes**
    - `tsc --noEmit` and the automated test suite must run clean with zero errors before any code is committed.
    - TypeScript `any` is strictly prohibited. Define explicit interfaces, types, and Zod schemas for all data models.
