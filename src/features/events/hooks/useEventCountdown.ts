import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { calculateEventCountdown, EventCountdown } from '../types';

/**
 * Drift-free live countdown hook for events and milestones.
 * Calculates remaining duration from the absolute target timestamp and system clock.
 * Recalculates immediately upon AppState transition to 'active' (foreground resume).
 * Cleans up interval timers immediately on unmount or target change.
 */
export function useEventCountdown(targetTime: string | Date | undefined): EventCountdown {
  const [countdown, setCountdown] = useState<EventCountdown>(() => {
    if (!targetTime) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalRemainingMs: 0,
        isTargetReached: true,
        isPast: true,
        formattedText: '--',
        shortText: '--',
      };
    }
    return calculateEventCountdown(targetTime);
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const recalculate = useCallback(() => {
    if (!targetTime) return;
    const updated = calculateEventCountdown(targetTime);
    setCountdown(updated);
    if (updated.isTargetReached) {
      clearTimer();
    }
  }, [targetTime, clearTimer]);

  // Main ticker effect
  useEffect(() => {
    if (!targetTime) {
      clearTimer();
      setCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalRemainingMs: 0,
        isTargetReached: true,
        isPast: true,
        formattedText: '--',
        shortText: '--',
      });
      return;
    }

    // Initial immediate calculation
    const initial = calculateEventCountdown(targetTime);
    setCountdown(initial);

    if (initial.isTargetReached) {
      clearTimer();
      return;
    }

    // Set 1-second interval ticker
    clearTimer();
    intervalRef.current = setInterval(() => {
      recalculate();
    }, 1000);

    return () => {
      clearTimer();
    };
  }, [targetTime, recalculate, clearTimer]);

  // AppState listener for background/foreground recovery
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        recalculate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove?.();
    };
  }, [recalculate]);

  return countdown;
}

export default useEventCountdown;
