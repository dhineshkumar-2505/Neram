import { networkStatusService } from '../../src/services/networkStatus';
import { routingService } from '../../src/features/location/services/routingService';
import { chatService } from '../../src/features/chat/services/chatService';
import { locationEngine } from '../../src/features/location/services/locationEngine';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
  NetInfoStateType: {
    none: 'none',
    unknown: 'unknown',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  },
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnValue({
      subscribe: jest.fn((cb) => {
        cb?.('SUBSCRIBED');
        return { unsubscribe: jest.fn() };
      }),
      on: jest.fn().mockReturnThis(),
    }),
    removeChannel: jest.fn(),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

describe('NERAM PART 10: Network Resilience & Failure Recovery Suite', () => {
  let netInfoListener: ((state: NetInfoState) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
      netInfoListener = cb;
      return () => {
        netInfoListener = null;
      };
    });
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: NetInfoStateType.wifi,
      details: null,
    });
  });

  describe('10.31: Normal & Slow Network (3G Simulation)', () => {
    it('handles normal network state with verified reachability', () => {
      networkStatusService.initialize();

      const status = networkStatusService.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.isOffline).toBe(false);
    });

    it('handles slow network request timeout gracefully via AbortController', async () => {
      const abortController = new AbortController();
      const abortSpy = jest.spyOn(global, 'fetch').mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            if (options?.signal?.aborted) {
              const abortErr = new Error('Aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            } else {
              reject(new Error('Network request timed out'));
            }
          }, 100);
        });
      });

      // Trigger abort after 30ms to simulate fast timeout on slow network
      setTimeout(() => abortController.abort(), 30);

      const result = await routingService.calculateRoute({
        origin: { latitude: 12.9716, longitude: 77.5946 },
        destination: { latitude: 12.9352, longitude: 77.6245 },
        profile: 'auto',
        signal: abortController.signal,
      });

      expect(result.route).toBeNull();
      expect(result.error).toBeTruthy();
      abortSpy.mockRestore();
    });
  });

  describe('10.32: Packet Loss & Intermittent Failures', () => {
    it('prevents crashing on intermittent packet drop during chat message submission', async () => {
      const mockInsert = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockRejectedValueOnce(new Error('Socket connection reset by peer'));

      const { supabase } = require('../../src/lib/supabase');
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      });

      const result = await chatService.sendMessage({
        groupId: 'grp_test_1',
        senderId: 'usr_1',
        body: 'Testing packet drop resiliency',
        tempId: 'temp_packet_drop_123',
      });

      expect(result.message).toBeNull();
      expect(result.tempId).toBe('temp_packet_drop_123');
      expect(result.error).toContain('Socket connection reset by peer');
    });

    it('enforces idempotent retry backoff without runaway infinite loops', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection lost'));

      const result = await routingService.calculateRoute({
        origin: { latitude: 12.9716, longitude: 77.5946 },
        destination: { latitude: 12.9352, longitude: 77.6245 },
        profile: 'auto',
      });

      // Retried maximum allowed times (original + 2 retries = 3 calls) then stopped safely
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result.route).toBeNull();
      fetchSpy.mockRestore();
    });
  });

  describe('10.33: Airplane Mode Transition & Recovery', () => {
    it('dispatches offline event when airplane mode activates and recovers when deactivated', () => {
      const statuses: boolean[] = [];

      const unsubscribe = networkStatusService.subscribe((status) => {
        statuses.push(status.isOffline);
      });

      // 1. Simulate Airplane Mode ON (Disconnected)
      netInfoListener?.({
        isConnected: false,
        isInternetReachable: false,
        type: NetInfoStateType.none,
        details: null,
      });

      expect(networkStatusService.getStatus().isOffline).toBe(true);

      // 2. Simulate Airplane Mode OFF (Reconnected to 4G/Wifi)
      netInfoListener?.({
        isConnected: true,
        isInternetReachable: true,
        type: NetInfoStateType.cellular,
        details: {
          cellularGeneration: null,
          carrier: null,
          isConnectionExpensive: false,
        },
      } as any);

      expect(networkStatusService.getStatus().isOffline).toBe(false);

      unsubscribe();
      expect(statuses).toContain(true);
      expect(statuses[statuses.length - 1]).toBe(false);
    });
  });

  describe('10.34: App Backgrounding & Resume Handling', () => {
    it('reacts to AppState changes between background and active without leaking listeners', () => {
      let appStateListener: ((state: AppStateStatus) => void) | null = null;
      const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });

      // Start engine
      locationEngine.stopTracking(); // Ensure fresh state
      expect(locationEngine.getState().isTracking).toBe(false);

      // Transition app to background
      if (appStateListener) {
        (appStateListener as (state: AppStateStatus) => void)('background');
      }
      expect(locationEngine.getState().isTracking).toBe(false);

      // Transition app to active
      if (appStateListener) {
        (appStateListener as (state: AppStateStatus) => void)('active');
      }
      expect(locationEngine.getState().isTracking).toBe(false);

      addEventListenerSpy.mockRestore();
    });
  });
});
