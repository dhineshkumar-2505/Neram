import { renderHook, act } from '@testing-library/react-native';
import {
  useGroupLifecycle,
  calculateGroupRemainingTime,
} from '../../src/features/groups';

describe('calculateGroupRemainingTime pure utility', () => {
  const baseStart = new Date('2026-09-23T10:00:00.000Z');

  it('calculates multi-day countdown correctly', () => {
    const expiry = new Date('2026-09-25T14:30:00.000Z'); // 2 days, 4 hours, 30 min
    const now = new Date('2026-09-23T10:00:00.000Z');

    const res = calculateGroupRemainingTime(baseStart, expiry, now);

    expect(res.days).toBe(2);
    expect(res.hours).toBe(4);
    expect(res.minutes).toBe(30);
    expect(res.isExpired).toBe(false);
    expect(res.isExpiring).toBe(false);
    expect(res.formattedText).toBe('2d 4h 30m');
  });

  it('flags space as isExpiring when under 1 hour remains', () => {
    const expiry = new Date('2026-09-23T10:45:00.000Z'); // 45 minutes total
    const now = new Date('2026-09-23T10:00:00.000Z');

    const res = calculateGroupRemainingTime(baseStart, expiry, now);

    expect(res.days).toBe(0);
    expect(res.hours).toBe(0);
    expect(res.minutes).toBe(45);
    expect(res.isExpiring).toBe(true);
    expect(res.isExpired).toBe(false);
    expect(res.formattedText).toBe('45m 0s');
  });

  it('flags space as isExpired when current time surpasses expires_at', () => {
    const expiry = new Date('2026-09-23T12:00:00.000Z');
    const now = new Date('2026-09-23T12:00:01.000Z');

    const res = calculateGroupRemainingTime(baseStart, expiry, now);

    expect(res.isExpired).toBe(true);
    expect(res.isExpiring).toBe(false);
    expect(res.progressFraction).toBe(1.0);
    expect(res.formattedText).toBe('Space Expired');
  });
});

describe('useGroupLifecycle hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with active state and updates on interval ticks', () => {
    const startsAt = new Date(Date.now() - 3600 * 1000); // started 1h ago
    const expiresAt = new Date(Date.now() + 5000); // 5 seconds left

    const { result } = renderHook(() =>
      useGroupLifecycle(startsAt, expiresAt, 'ACTIVE'),
    );

    expect(result.current.isExpired).toBe(false);
    expect(result.current.isExpiring).toBe(true);
    expect(result.current.lifecycleState).toBe('EXPIRING');

    // Advance 6 seconds
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.lifecycleState).toBe('EXPIRED');
  });

  it('handles empty timestamps gracefully', () => {
    const { result } = renderHook(() =>
      useGroupLifecycle(undefined, undefined, 'ACTIVE'),
    );

    expect(result.current.remainingTime.formattedText).toBe('--');
    expect(result.current.isExpired).toBe(false);
  });
});
