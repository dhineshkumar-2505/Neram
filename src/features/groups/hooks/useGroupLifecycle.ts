import { useState, useEffect } from 'react';
import {
  GroupRemainingTime,
  GroupLifecycleState,
  calculateGroupRemainingTime,
} from '../types';

export interface UseGroupLifecycleResult {
  remainingTime: GroupRemainingTime;
  lifecycleState: GroupLifecycleState;
  isExpiring: boolean;
  isExpired: boolean;
}

/**
 * Real-time temporal lifecycle hook for temporary groups.
 * Ticks every 1000ms to calculate exact countdown, progress fraction,
 * and state transitions (ACTIVE -> EXPIRING -> EXPIRED).
 */
export function useGroupLifecycle(
  startsAt: string | Date | undefined,
  expiresAt: string | Date | undefined,
  databaseState: GroupLifecycleState = 'ACTIVE',
): UseGroupLifecycleResult {
  const [remainingTime, setRemainingTime] = useState<GroupRemainingTime>(() => {
    if (!startsAt || !expiresAt) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalRemainingSeconds: 0,
        isExpiring: false,
        isExpired: false,
        progressFraction: 0,
        formattedText: '--',
      };
    }
    return calculateGroupRemainingTime(startsAt, expiresAt);
  });

  useEffect(() => {
    if (!startsAt || !expiresAt) return;

    // Run immediate calculation
    setRemainingTime(calculateGroupRemainingTime(startsAt, expiresAt));

    // If already expired, no need to tick
    const initialCheck = calculateGroupRemainingTime(startsAt, expiresAt);
    if (initialCheck.isExpired) {
      return;
    }

    const intervalId = setInterval(() => {
      const updated = calculateGroupRemainingTime(startsAt, expiresAt);
      setRemainingTime(updated);

      if (updated.isExpired) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [startsAt, expiresAt]);

  // Derive active lifecycle state
  let resolvedState = databaseState;
  if (databaseState === 'ARCHIVED' || databaseState === 'PURGED') {
    resolvedState = databaseState;
  } else if (remainingTime.isExpired) {
    resolvedState = 'EXPIRED';
  } else if (remainingTime.isExpiring) {
    resolvedState = 'EXPIRING';
  } else {
    resolvedState = 'ACTIVE';
  }

  return {
    remainingTime,
    lifecycleState: resolvedState,
    isExpiring: remainingTime.isExpiring,
    isExpired: remainingTime.isExpired,
  };
}

export default useGroupLifecycle;
