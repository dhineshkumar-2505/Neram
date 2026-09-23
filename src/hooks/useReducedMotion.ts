import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { setHapticsReducedMotion } from '../utils/haptics';

/**
 * Hook to detect and react to system-level reduced-motion accessibility preference.
 */
export function useReducedMotion(): boolean {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isCurrent && enabled) {
          setIsReducedMotion(true);
          setHapticsReducedMotion(true);
        }
      })
      .catch(() => {
        // Fallback for mock environments
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (isCurrent) {
          setIsReducedMotion(enabled);
          setHapticsReducedMotion(enabled);
        }
      },
    );

    return () => {
      isCurrent = false;
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  return isReducedMotion;
}

export default useReducedMotion;
