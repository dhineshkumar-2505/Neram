# Neram (நேரம்) — Purpose-Driven Temporary Social Platform

> **A temporary, purpose-aware digital space where people coordinate in the physical world, collaborate around shared objectives, and automatically close the space when its lifecycle ends.**

$$\text{Purpose} + \text{People} + \text{Tools} + \text{Time} + \text{Realtime} + \text{Lifecycle} = \text{Purpose-Driven Temporary Group}$$

---

## 📚 Master Architecture & Documentation

All core engineering specifications, database schemas, security models, and implementation plans are curated in the [`docs/`](docs/) directory:

| Document | Focus & Scope |
| :--- | :--- |
| 📋 [**PROJECT_PLAN.md**](docs/PROJECT_PLAN.md) | 10-phase engineering roadmap, dependency graph, MVP scope, milestones, and definitions of done. |
| 🏗️ [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Modular monolith architecture, React Native client, Supabase backend, realtime, storage, and client/server boundaries. |
| 🗄️ [**DATABASE_PLAN.md**](docs/DATABASE_PLAN.md) | Complete PostgreSQL schema, 20+ tables, enums, foreign keys, triggers, constraints, and realtime publications. |
| 🔒 [**SECURITY_PLAN.md**](docs/SECURITY_PLAN.md) | Zero-trust client policy, Row Level Security (RLS) rules, friend-only membership enforcement, and location privacy. |
| 🎨 [**UI_PLAN.md**](docs/UI_PLAN.md) | Screen inventory, design tokens (4pt/8pt grid, typography, HSL palettes), circular duration dial physics, and mandatory screen states. |
| 📍 [**LOCATION_PLAN.md**](docs/LOCATION_PLAN.md) | Ephemeral GPS tracking, on-device movement filter, battery preservation, MapLibre & Valhalla routing, and 50m arrival auto-stop. |
| 🧪 [**TEST_PLAN.md**](docs/TEST_PLAN.md) | 15-layer testing matrix spanning unit, pgTAP database tests, RLS negative tests, battery benchmarks, and E2E journeys. |
| 📜 [**DEVELOPMENT_RULES.md**](docs/DEVELOPMENT_RULES.md) | 20 non-negotiable architectural laws governing security, privacy, battery, aesthetics, and code quality. |
| 🛠️ [**DEVELOPMENT_SETUP.md**](docs/DEVELOPMENT_SETUP.md) | Local environment setup, mobile emulators, native development builds, and debugging guide. |
| 📄 [**Master Blueprint**](docs/purpose_driven_social_app_master_blueprint.txt) | Original master product, UX, and engineering specification (V1). |

---

## 🗂️ Clean Project Directory Structure

```
d:/project neram/
├── assets/                                    # Mobile app icons, adaptive icons, and splash screens
├── docs/                                      # Master architecture specifications and plans
│   ├── ARCHITECTURE.md
│   ├── DATABASE_PLAN.md
│   ├── DEVELOPMENT_RULES.md
│   ├── DEVELOPMENT_SETUP.md
│   ├── LOCATION_PLAN.md
│   ├── PROJECT_PLAN.md
│   ├── SECURITY_PLAN.md
│   ├── TEST_PLAN.md
│   ├── UI_PLAN.md
│   └── purpose_driven_social_app_master_blueprint.txt
│
├── src/                                       # Application source code
│   ├── app/                                   # Application root shell & providers
│   ├── components/                            # Foundational UI components (Screen, Text, Button, Card, States)
│   ├── design/                                # Centralized design tokens (typography, spacing, colors, elevation)
│   ├── features/                              # Domain-driven feature slices (auth, profile, friends, groups, chat, etc.)
│   ├── hooks/                                 # Custom React hooks
│   ├── lib/                                   # Infrastructure adapters (Supabase client)
│   ├── navigation/                            # React Navigation (Bottom Tabs + Root Stack)
│   ├── state/                                 # Global UI state (Zustand)
│   ├── types/                                 # TypeScript models and Supabase database definitions
│   └── utils/                                 # Pure utility functions
│
├── supabase/                                  # Backend infrastructure
│   ├── functions/                             # Deno Edge Functions
│   ├── migrations/                            # PostgreSQL SQL migrations
│   └── seed/                                  # Seed data fixtures
│
├── tests/                                     # Automated Jest and component tests
│
├── .env.example                               # Safe environment variables template
├── .gitignore                                 # Git protection for secrets, node_modules, build artifacts
├── .prettierrc                                # Code formatting rules
├── app.json                                   # Validated Expo SDK 57 configuration
├── App.tsx                                    # Application root with SafeAreaProvider & RootNavigator
├── eslint.config.mjs                          # ESLint 9 configuration with strict rules
├── index.ts                                   # Expo application entrypoint
├── jest.config.js                             # Jest configuration with path aliases
├── package.json                               # npm dependencies and scripts
└── tsconfig.json                              # Strict TypeScript configuration
```

---

## ⚡ Quickstart Commands

```bash
# 1. Install dependencies
npm install

# 2. Verify TypeScript (0 errors)
npm run typecheck

# 3. Verify Code Quality (0 warnings, 0 errors)
npm run lint

# 4. Run Automated Test Suite (7/7 passing)
npm test

# 5. Verify Expo Project Health (21/21 checks passing)
npx expo-doctor

# 6. Launch Metro Bundler in Development Client Mode
npm start
```

---

## 🎯 Current Project Status

- ✅ **Step 1: Blueprint Analysis & Master Planning** — Complete (8 architecture documents produced).
- ✅ **Step 2: Technical Foundation** — Complete & Verified (React Native, Expo SDK 57, design tokens, navigation, base components, and Jest testing harness active).
- ⏳ **Step 3: Database Implementation & Migrations** — Next up.
