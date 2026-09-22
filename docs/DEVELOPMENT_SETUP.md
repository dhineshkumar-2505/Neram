# Neram: Development Setup & Engineering Guide

## 1. Prerequisites & Environment

To contribute to and build the **Neram** application, your local environment must satisfy the following minimum specifications:

- **Node.js**: `v20.0.0` or higher (verified on `v24.11.1`).
- **Package Manager**: `npm` (v10+).
- **Git**: Installed and configured.
- **Mobile SDKs** (Required for native development builds):
  - **Android**: Android Studio with Android SDK 34+, Android SDK Platform-Tools, and an Android Virtual Device (AVD) or physical device connected via USB debugging.
  - **iOS**: macOS with Xcode 15+ and CocoaPods (for iOS simulator or physical device development).
- **Expo CLI**: Executed via `npx expo` (no global installation required).

---

## 2. Quickstart Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dhineshkumar-2505/Neram.git
   cd Neram
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment template:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and provide your credentials (see Section 3 below).

---

## 3. Environment Variables (.env)

The application utilizes Expo's public environment variable mechanism (`EXPO_PUBLIC_` prefix) to make non-sensitive configuration parameters available to the client:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project API URL | `https://your-project.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anonymous client key | `eyJhbGciOi...` |
| `EXPO_PUBLIC_MAP_TILE_URL` | OpenFreeMap / vector tile server URL | `https://tiles.openfreemap.org/styles/bright` |
| `EXPO_PUBLIC_VALHALLA_API_URL` | Valhalla routing & map-matching endpoint | `https://valhalla1.openstreetmap.de` |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry error monitoring DSN (optional in dev) | `https://...@sentry.io/...` |
| `EXPO_PUBLIC_APP_ENV` | Environment identifier | `development` / `staging` / `production` |

> [!CAUTION]
> **Never commit `.env` or any file containing private keys, signing keystores, or Supabase service-role keys.** The `.gitignore` is pre-configured to ignore all secret patterns.

---

## 4. Development Workflow & Commands

### 4.1 Running the App
The project is built around **Expo Development Builds** (`expo-dev-client`) to support native modules such as MapLibre, background location services, and push notifications without Expo Go limitations:

- **Start Metro Bundler with Dev Client**:
  ```bash
  npm start
  ```
- **Start with Cache Cleared**:
  ```bash
  npm run start:clear
  ```

### 4.2 Running on Native Emulators & Devices
To build and launch the native runtime on emulators:
- **Android**:
  ```bash
  npm run android
  ```
  *(Generates the local `android/` directory via Prebuild and installs the debug APK on your running emulator/device).*
- **iOS** (macOS required):
  ```bash
  npm run ios
  ```
  *(Generates the local `ios/` directory via Prebuild, installs CocoaPods, and launches on iOS Simulator).*

### 4.3 Native Prebuild
To inspect or generate native Android/iOS project folders manually:
```bash
npm run prebuild
```

---

## 5. Verification & Code Quality Commands

Always verify that your changes pass all checks before committing:

| Command | Purpose |
| :--- | :--- |
| `npm run typecheck` | Strict TypeScript compilation check (`tsc --noEmit`) with zero errors. |
| `npm run lint` | ESLint 9 validation across all TypeScript files (`--max-warnings 0`). |
| `npm run lint:fix` | Automatic remediation of linting issues. |
| `npm run format` | Prettier code formatting on all TypeScript and markdown files. |
| `npm run format:check` | Verifies code conforms to formatting rules without modifying files. |
| `npm test` | Runs Jest unit and component test suites via `jest-expo`. |
| `npm run test:watch` | Interactive test runner during development. |
| `npm run test:coverage` | Generates code coverage report in `coverage/`. |

---

## 6. Project Architecture Overview

```
src/
├── app/                  # Application root & shell initialization
├── components/           # Foundational UI components (Screen, Text, Button, Card, States)
├── design/               # Centralized design tokens (typography, spacing, colors, elevation)
├── features/             # Domain feature slices (auth, profile, friends, groups, chat, location, etc.)
├── hooks/                # Reusable custom React hooks
├── lib/                  # Infrastructure adapters (Supabase client, API utilities)
├── navigation/           # React Navigation architecture (Bottom Tabs + Root Stack)
├── state/                # Global UI state (Zustand)
├── types/                # TypeScript interfaces and Supabase database definitions
└── utils/                # Pure utility functions

supabase/
├── migrations/           # Versioned SQL migrations (PostgreSQL enums, tables, RLS)
├── functions/            # Deno Edge Functions
└── seed/                 # Development test fixtures

tests/                    # Automated Jest and component test suites
```

---

## 7. Native Development-Build Architecture

Because Neram requires:
1. Native background location tracking (`FOREGROUND_SERVICE_LOCATION` on Android, `UIBackgroundModes` on iOS),
2. MapLibre Native GL vector rendering,
3. Hardware-level haptic ticks and audio synthesis,
4. System-level notification handling,

**the project does not rely on Expo Go as a long-term runtime.** The app uses Expo Config Plugins and Prebuild to maintain clean, declarative native projects while allowing full native capabilities.
