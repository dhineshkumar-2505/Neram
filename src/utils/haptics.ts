import * as Haptics from 'expo-haptics';

let lastTickTime = 0;
const MIN_TICK_INTERVAL_MS = 40;

let isReducedMotionActive = false;

/**
 * Updates reduced motion override for haptic feedback.
 */
export function setHapticsReducedMotion(enabled: boolean): void {
  isReducedMotionActive = enabled;
}

export function resetHapticsThrottle(): void {
  lastTickTime = 0;
}

/**
 * Centralized, rate-limited haptic feedback utility for Neram.
 * Guarantees zero gesture spam and graceful fallback in unsupported environments.
 */
export const haptics = {
  /**
   * Selection feedback for tab switches, segmented buttons, and option picks.
   */
  selection: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Graceful fallback for web/unsupported
    }
  },

  /**
   * High-frequency tick for dial rotating and sliders.
   * Rate-limited to prevent motor saturation.
   */
  tick: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    const now = Date.now();
    if (now - lastTickTime < MIN_TICK_INTERVAL_MS) {
      return;
    }
    lastTickTime = now;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Boundary resistance feedback when reaching dial limits (0 or max).
   */
  boundary: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Tactile confirmation feedback for stepper presses, preset selections, and release.
   */
  confirm: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Important confirmation feedback on successful mutations (task complete, vote cast).
   */
  success: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Warning feedback for destructive prompts or near-dissolution notices.
   */
  warning: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Error feedback on validation failures or disconnected actions.
   */
  error: async (): Promise<void> => {
    if (isReducedMotionActive) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Graceful fallback
    }
  },
};

export default haptics;
