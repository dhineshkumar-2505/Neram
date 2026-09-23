import { renderHook, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useEventCountdown } from '../../src/features/events/hooks/useEventCountdown';
import { calculateEventCountdown } from '../../src/features/events/types';

describe('useEventCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('calculateEventCountdown utility', () => {
    it('calculates days, hours, minutes, and seconds accurately from future target', () => {
      const now = new Date('2026-09-23T12:00:00.000Z');
      // 2 days, 4 hours, 18 minutes, 30 seconds ahead
      const target = new Date('2026-09-25T16:18:30.000Z');

      const result = calculateEventCountdown(target, now);

      expect(result.days).toBe(2);
      expect(result.hours).toBe(4);
      expect(result.minutes).toBe(18);
      expect(result.seconds).toBe(30);
      expect(result.isTargetReached).toBe(false);
      expect(result.isPast).toBe(false);
      expect(result.formattedText).toBe('2d 04:18:30');
      expect(result.shortText).toBe('2d 4h');
    });

    it('returns target reached / started when target timestamp has passed', () => {
      const now = new Date('2026-09-23T12:00:00.000Z');
      const target = new Date('2026-09-23T11:59:00.000Z'); // 1 minute in the past

      const result = calculateEventCountdown(target, now);

      expect(result.isTargetReached).toBe(true);
      expect(result.isPast).toBe(true);
      expect(result.formattedText).toBe('Started');
      expect(result.shortText).toBe('Now');
      expect(result.totalRemainingMs).toBe(0);
    });

    it('handles invalid dates gracefully', () => {
      const result = calculateEventCountdown('invalid-date-string');

      expect(result.isTargetReached).toBe(true);
      expect(result.isPast).toBe(true);
      expect(result.formattedText).toBe('Invalid date');
    });
  });

  describe('useEventCountdown hook', () => {
    it('initializes and updates live countdown every second', () => {
      const baseNow = new Date('2026-09-23T10:00:00.000Z').getTime();
      jest.setSystemTime(baseNow);

      const targetTime = new Date('2026-09-23T10:00:05.000Z').toISOString(); // 5 seconds ahead

      const { result } = renderHook(() => useEventCountdown(targetTime));

      expect(result.current.seconds).toBe(5);
      expect(result.current.isTargetReached).toBe(false);

      // Advance by 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.seconds).toBe(3);
      expect(result.current.isTargetReached).toBe(false);

      // Advance by 3 more seconds (reaches 0)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.isTargetReached).toBe(true);
      expect(result.current.formattedText).toBe('Started');
    });

    it('recalculates immediately when AppState returns to active (foreground)', () => {
      const baseNow = new Date('2026-09-23T10:00:00.000Z').getTime();
      jest.setSystemTime(baseNow);

      const targetTime = new Date('2026-09-23T10:10:00.000Z').toISOString(); // 10 mins ahead

      let appStateListener: ((state: AppStateStatus) => void) | undefined;
      const addEventListenerSpy = jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_event, listener) => {
          appStateListener = listener;
          return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
        });

      const { result } = renderHook(() => useEventCountdown(targetTime));

      expect(result.current.minutes).toBe(10);

      // Simulate device being backgrounded for 5 minutes
      jest.setSystemTime(baseNow + 5 * 60 * 1000);

      // Trigger AppState change to active
      act(() => {
        if (appStateListener) {
          appStateListener('active');
        }
      });

      // Countdown should immediately reflect 5 minutes remaining
      expect(result.current.minutes).toBe(5);

      addEventListenerSpy.mockRestore();
    });

    it('returns empty placeholder when targetTime is undefined', () => {
      const { result } = renderHook(() => useEventCountdown(undefined));

      expect(result.current.formattedText).toBe('--');
      expect(result.current.shortText).toBe('--');
      expect(result.current.isTargetReached).toBe(true);
    });
  });
});
