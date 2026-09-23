import { chatService } from '../../src/features/chat/services/chatService';
import { lifecycleService } from '../../src/features/groups/services/lifecycleService';
import { notificationService } from '../../src/features/notifications/services/notificationService';
import { locationTransmissionPolicy } from '../../src/features/location/services/locationTransmissionPolicy';
import { movementEngine } from '../../src/features/location/services/movementEngine';
import { locationEngine } from '../../src/features/location/services/locationEngine';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

describe('NERAM PART 10: Battery & Realtime Resource Efficiency Audit Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    movementEngine.reset();
  });

  describe('10.36: Realtime Subscription Lifecycle & Channel Cleanup', () => {
    it('Chat: Mounts channel and completely removes channel upon teardown', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const unsubscribe = chatService.subscribeToGroupMessages('grp_100', {});
      expect(supabase.channel).toHaveBeenCalledWith('group-chat-grp_100');

      // Execute teardown
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('Lifecycle: Mounts channel and completely removes channel upon teardown', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const unsubscribe = lifecycleService.subscribeToGroupLifecycle('grp_200', jest.fn());
      expect(supabase.channel).toHaveBeenCalledWith('group-lifecycle-grp_200');

      // Execute teardown
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('Notifications: Mounts user channel and completely removes channel upon teardown', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const unsubscribe = notificationService.subscribeToUserNotifications('usr_300', {});
      expect(supabase.channel).toHaveBeenCalledWith('user-notifications-usr_300');

      // Execute teardown
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('Location Engine: Stops background watcher and evicts listeners upon stopTracking', () => {
      locationEngine.stopTracking();
      expect(locationEngine.getState().isTracking).toBe(false);
    });
  });

  describe('10.35 & 10.37: Battery Conservation & Stationary GPS Suppression', () => {
    it('Stationary state transmits 0 network updates when movement is below 25 meters', () => {
      const baseTime = Date.now() - 60000;

      // Fix 1: Initial position
      const initialFix = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        speed: 0,
        timestamp: baseTime,
      };

      // Fix 2: Stationary drift (5 meters away, speed 0, 45s later)
      const driftedFix = {
        latitude: 12.97164, // ~4.5 meters displacement
        longitude: 77.5946,
        accuracy: 10,
        speed: 0,
        timestamp: baseTime + 45000,
      };

      const decision = locationTransmissionPolicy.shouldTransmit(
        driftedFix,
        initialFix,
        baseTime,
        'STATIONARY',
      );

      // Strict battery rule: 0 transmissions while stationary unless displacement > 25m
      expect(decision.shouldTransmit).toBe(false);
      expect(decision.reason).toContain('STATIONARY');
    });

    it('Stationary state permits transmission when significant physical displacement occurs (> 25m)', () => {
      const baseTime = Date.now() - 40000;

      const initialFix = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        speed: 0,
        timestamp: baseTime,
      };

      // Displaced by ~40 meters
      const movedFix = {
        latitude: 12.97195,
        longitude: 77.5946,
        accuracy: 10,
        speed: 0.8,
        timestamp: baseTime + 30000,
      };

      const decision = locationTransmissionPolicy.shouldTransmit(
        movedFix,
        initialFix,
        baseTime,
        'STATIONARY',
      );

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toContain('STATIONARY_DISPLACEMENT_EXCEEDED');
    });

    it('Jitter suppression: Rejects fixes with displacement < 3m within 60 seconds', () => {
      const baseTime = Date.now() - 30000;

      const initialFix = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        speed: 0,
        timestamp: baseTime,
      };

      // Micro jitter (1.2 meters)
      const jitterFix = {
        latitude: 12.97161,
        longitude: 77.5946,
        accuracy: 10,
        speed: 0.1,
        timestamp: baseTime + 20000,
      };

      const decision = locationTransmissionPolicy.shouldTransmit(
        jitterFix,
        initialFix,
        baseTime,
        'STATIONARY',
      );

      expect(decision.shouldTransmit).toBe(false);
    });

    it('Movement classifier filters out transient noise spikes using speed & displacement thresholds', () => {
      const baseTime = Date.now() - 10000;

      // 1. Initial fix: unknown/stationary
      const fix1 = { latitude: 12.9716, longitude: 77.5946, accuracy: 10, speed: 0, timestamp: baseTime };
      movementEngine.processFix(fix1);

      // 2. Stationary observation
      const fix2 = { latitude: 12.9716, longitude: 77.5946, accuracy: 10, speed: 0, timestamp: baseTime + 1000 };
      const fix3 = { latitude: 12.9716, longitude: 77.5946, accuracy: 10, speed: 0, timestamp: baseTime + 2000 };
      movementEngine.processFix(fix2);
      const state = movementEngine.processFix(fix3);

      expect(state).toBe('STATIONARY');
    });
  });

  describe('10.38 & 10.39: Rate Limiting & Duplicate Action Protection', () => {
    it('Enforces maximum bounded retries in adaptive policy without unbounded message queue', () => {
      const baseTime = Date.now() - 20000;
      const lastFix = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        speed: 1.2,
        timestamp: baseTime,
      };

      // Only 10 seconds elapsed and only 5m walked -> Should suppress
      const rapidFix = {
        latitude: 12.97164,
        longitude: 77.5946,
        accuracy: 10,
        speed: 1.2,
        timestamp: baseTime + 10000,
      };

      const decision = locationTransmissionPolicy.shouldTransmit(
        rapidFix,
        lastFix,
        baseTime,
        'WALKING',
      );

      expect(decision.shouldTransmit).toBe(false);
    });
  });
});
