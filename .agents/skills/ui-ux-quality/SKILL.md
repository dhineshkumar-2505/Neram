---
name: ui-ux-quality
description: "Human-centered UI/UX quality assurance, visual consistency, design tokens, and interaction audit skill for Neram. Use whenever creating or modifying UI screens, components, gestures, and animations."
---

# UI/UX Quality Assurance

## Purpose
Ensure every interface in Neram feels **intentional, spatial, calm, modern, and expensive**. Agents must inspect the UI the way a real human experiences it on an Android device—evaluating visual rhythm, typography, contrast, keyboard avoidance, tactile feedback, and comprehensive asynchronous state handling.

---

## When to Use
- Whenever creating or modifying screens in `src/features/*/screens/` or `src/navigation/screens/`.
- Whenever editing components in `src/components/` or design tokens in `src/design/tokens.ts`.
- When developing gesture-driven components (e.g., circular duration dials with Reanimated).
- When resolving layout overflow, keyboard clipping, or visual inconsistency bugs.

---

## Mandatory Workflow
Every UI modification must pass this four-stage quality gate:

$$\text{Token Audit} \longrightarrow \text{Layout & Keyboard Audit} \longrightarrow \text{Four-State Validation} \longrightarrow \text{Interaction & Feedback Check}$$

1. **Token Audit**: Confirm 100% adherence to `src/design/tokens.ts`. No arbitrary pixel numbers, no ad-hoc hex colors, zero emojis.
2. **Layout & Keyboard Audit**: Validate responsiveness on small and large Android viewports. Ensure safe areas, status bar style, and keyboard handling (`keyboardShouldPersistTaps="handled"`) work smoothly.
3. **Four-State Validation**: Verify that every asynchronous screen cleanly implements **Loading**, **Success**, **Error**, and **Empty** states.
4. **Interaction & Feedback Check**: Test all touch targets ($\ge 44\text{pt}$), active/pressed feedback, navigation transitions, and haptic ticks on gesture controls.

---

## Detailed Rules

### 1. The Obsidian Dark Design System
Neram's brand identity is grounded in an analog, temporal, quiet aesthetic:
- **Background**: `#0B0F19` (Obsidian Base)
- **Surfaces**: `#111827` (Card / List item), `#161F30` (Subtle container), `#1E293B` (Elevated modals / floating rails)
- **Text Palette**:
  - `primary`: `#F8FAFC` (Pure white headers & titles)
  - `secondary`: `#94A3B8` (Slate muted body text)
  - `tertiary`: `#64748B` (Hints, disabled metadata)
  - `inverse`: `#0B0F19` (Text on bright accent pills)
- **Accent Accents**:
  - Primary Indigo: `#4F46E5` (interactive buttons) / `#818CF8` (icons & active tabs)
  - Secondary Teal: `#0D9488` / `#2DD4BF` (presence dots & status tags)
- **Borders**: Translucent white `rgba(255, 255, 255, 0.08)` to `0.12`
- **Status Bar**: Always `barStyle="light-content"` on Android.

### 2. Spatial Rhythm & Geometry
- **Grid**: Built strictly on a 4-point base grid and 8-point layout rhythm (`tokens.spacing.xs = 4`, `sm = 8`, `md = 16`, `lg = 24`, `xl = 32`, `xxl = 48`).
- **Radii**: `tokens.radius.sm = 8` (buttons, tags), `md = 12` (cards, inputs), `lg = 16` (sheets), `xl = 24` (containers), `full = 9999` (avatars, pills).
- **Touch Targets**: Minimum **$44\text{pt} \times 44\text{pt}$** for all clickable elements (`tokens.layout.minTouchTarget`). Primary buttons must be at least **$48\text{pt}$** high.

### 3. Iconography Laws (From DEVELOPMENT_RULES.md)
1. **Zero Emojis in UI**: Never use emojis (👋, 🔍, 👥, ⏰) as icons or navigation labels. Emojis degrade aesthetic quality.
2. **One Consistent Icon Language**: All interface icons must be custom SVG vector components (see `src/navigation/components/TabIcons.tsx` and `src/features/auth/components/`) with:
   - $24\text{pt}$ bounding box
   - Uniform $2\text{pt}$ stroke weight
   - Rounded line caps (`strokeLinecap="round"`) and line joins (`strokeLinejoin="round"`).

### 4. Mandatory Universal States
Every data-driven screen must handle all paths without leaving the user on a blank screen or infinite spinner:

```text
Path 1 (Success): Initial → Skeleton / LoadingState → Populated Content
Path 2 (Error):   Initial → LoadingState → ErrorState (Clear copy + Retry button)
Path 3 (Empty):   Initial → LoadingState → EmptyState (Context explanation + Prominent action)
```

- **Loading**: Use layout-matching skeletons or `src/components/LoadingState.tsx`.
- **Empty**: Use `src/components/EmptyState.tsx` with an actionable `actionLabel` and `onAction` callback.
- **Error**: Use `src/components/ErrorState.tsx` or translucent error banners with dismiss (`✕`) actions.

### 5. Keyboard & Input Polish
- All scrollable forms must set `keyboardShouldPersistTaps="handled"`.
- Text inputs must use `src/components/Input.tsx` with clear labels, hints, and error captions.
- Search inputs must debounce queries ($300\text{–}400\text{ms}$) and guard against race conditions with cancellation tokens.

### 6. Tactile Physics & Sound (Reanimated Controls)
For gesture-driven controls (such as the circular duration selector):
- Use `react-native-reanimated` and `react-native-gesture-handler`.
- Emit light tactile feedback (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) when crossing discrete tick thresholds.
- Provide accessible stepper fallback buttons (`+` and `-`) for screen reader support.

---

## Verification Requirements
Before closing any UI task:
- [ ] Screen renders cleanly without horizontal or vertical clipping.
- [ ] Safe area insets (`SafeAreaView` from `react-native-safe-area-context`) protect status bar and navigation bars.
- [ ] Status bar icons are clearly visible (`light-content`).
- [ ] Empty state renders when lists have 0 items.
- [ ] Error state renders with a functioning retry mechanism upon network failure.
- [ ] No arbitrary pixel values or ad-hoc non-token hex colors introduced.
- [ ] Automated Jest screen tests pass (`npm test tests/screens/`).

---

## Common Mistakes to Avoid
- **White Flashes on Dark Theme**: Forgetting that a parent container or navigator defaults to white background, causing white flashes during screen transitions.
- **Emoji Placeholders**: Using an emoji icon because an SVG hasn't been drawn yet. Always create an SVG vector component.
- **Infinite Spinners**: Showing a generic spinning wheel that never times out when an API error occurs.
- **Hidden Inputs Under Keyboard**: Failing to wrap form screens in a `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- **Truncated Text Without Font Scaling**: Hardcoding fixed container heights that clip text when device accessibility font scaling is enabled.
