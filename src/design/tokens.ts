/**
 * Neram Design Tokens Foundation
 * 
 * Based on UI_PLAN.md:
 * - 4pt base spacing / 8pt layout rhythm
 * - Controlled depth and elevation
 * - Typography-first scale
 * - Curated HSL color palette (Indigo-Violet, Deep Teal, Deep Blue-Black, Slate)
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,       // Buttons, tags, badges
  md: 12,      // Cards, text inputs
  lg: 16,      // Sheets, dialogs, media previews
  xl: 24,      // Modal containers, floating rails
  full: 9999,  // Avatars, pill tags
} as const;

export const colors = {
  // Primary Family: Indigo-Violet
  primary: {
    default: '#4F46E5',    // hsl(245, 68%, 58%)
    light: '#818CF8',      // hsl(245, 75%, 68%)
    dark: '#3730A3',       // hsl(245, 65%, 45%)
    subtle: '#EEF2FF',     // hsl(245, 60%, 96%)
    muted: '#C7D2FE',
  },

  // Secondary Family: Deep Teal
  secondary: {
    default: '#0D9488',    // hsl(172, 66%, 40%)
    light: '#2DD4BF',      // hsl(172, 60%, 55%)
    dark: '#115E59',       // hsl(172, 70%, 30%)
    subtle: '#F0FDFA',     // hsl(172, 50%, 95%)
    muted: '#99F6E4',
  },

  // Neutral Surfaces & Hierarchy (Obsidian Dark Theme)
  background: '#0B0F19',   // Deep Obsidian base screen background
  surface: '#111827',      // Card, list item & sheet surface
  surfaceSubtle: '#161F30', // Elevated card / subtle background
  surfaceElevated: '#1E293B', // Floating rails & modals

  // Text Hierarchy
  text: {
    primary: '#F8FAFC',    // Pure bright white (dominant title/heading)
    secondary: '#94A3B8',  // Slate muted (body & supporting)
    tertiary: '#64748B',   // Inactive metadata / hints
    inverse: '#0B0F19',    // Text on light/accent surfaces
  },

  // Borders & Dividers
  border: {
    default: 'rgba(255, 255, 255, 0.12)',
    subtle: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.20)',
  },

  // Status & Feedback Signals
  status: {
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',
  },
} as const;

export const typography = {
  // Font Sizes
  sizes: {
    display: 32,
    title1: 24,
    title2: 20,
    title3: 17,
    body: 15,
    callout: 14,
    footnote: 13,
    caption: 11,
  },

  // Line Heights
  lineHeights: {
    display: 40,
    title1: 30,
    title2: 26,
    title3: 22,
    body: 20,
    callout: 18,
    footnote: 16,
    caption: 14,
  },

  // Font Weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const layout = {
  minTouchTarget: 44,
  buttonHeight: 48,
  primaryTouchTarget: 52,
  avatarSm: 36,
  avatarMd: 44,
  avatarLg: 72,
  bottomNavHeight: 76,
  headerHeight: 56,
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 6,
  },
} as const;

export const motion = {
  duration: {
    instant: 150,
    quick: 250,
    natural: 350,
    deliberate: 450,
  },
} as const;

export const tokens = {
  spacing,
  radius,
  colors,
  typography,
  layout,
  elevation,
  motion,
} as const;

export type Tokens = typeof tokens;
export default tokens;
