import NetInfo from '@react-native-community/netinfo';
void NetInfo;
import { networkStatusService } from '../../src/services/networkStatus';

jest.mock('@react-native-community/netinfo', () => {
  let currentListener: ((state: unknown) => void) | null = null;
  return {
    addEventListener: jest.fn((callback) => {
      currentListener = callback;
      return jest.fn(() => {
        currentListener = null;
      });
    }),
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    }),
    __triggerListener: (state: unknown) => {
      if (currentListener) {
        currentListener(state);
      }
    },
  };
});

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      subscribe: jest.fn((callback) => {
        callback('SUBSCRIBED');
      }),
    })),
  },
}));

describe('networkStatusService', () => {
  beforeEach(() => {
    networkStatusService.resetForTesting();
    jest.clearAllMocks();
  });

  it('provides default connected status', () => {
    const status = networkStatusService.getStatus();
    expect(status.isConnected).toBe(true);
    expect(status.isOffline).toBe(false);
  });

  it('notifies subscribers on network transitions', () => {
    const listener = jest.fn();
    const unsubscribe = networkStatusService.subscribe(listener);

    // Initial emission
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        isConnected: true,
        isOffline: false,
      }),
    );

    // Simulate connection drop via simulateStatus
    networkStatusService.simulateStatus({
      isConnected: false,
      isInternetReachable: false,
    });

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isConnected: false,
        isOffline: true,
      }),
    );

    // Simulate reconnection
    networkStatusService.simulateStatus({
      isConnected: true,
      isInternetReachable: true,
    });

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isConnected: true,
        isOffline: false,
      }),
    );

    unsubscribe();
  });

  it('unsubscribes listener cleanly', () => {
    const listener = jest.fn();
    const unsubscribe = networkStatusService.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    networkStatusService.simulateStatus({
      isConnected: false,
      isInternetReachable: false,
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
