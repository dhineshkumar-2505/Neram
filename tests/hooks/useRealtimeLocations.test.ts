import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRealtimeLocations } from '../../src/features/location/hooks/useRealtimeLocations';
import { locationSessionService } from '../../src/features/location/services/locationSessionService';
import { supabase } from '../../src/lib/supabase';
import type { CurrentLocation } from '../../src/features/location/types';

jest.mock('../../src/features/location/services/locationSessionService');
jest.mock('../../src/lib/supabase');

describe('useRealtimeLocations hook', () => {
  const sessionId = 'session_123';
  const currentUserId = 'user_self';

  const mockLocations: CurrentLocation[] = [
    {
      sessionId,
      userId: 'user_self',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      speed: 1.2, // Walking
      heading: 90,
      recordedAt: new Date().toISOString(),
      user: {
        userId: 'user_self',
        displayName: 'Self User',
        username: 'self',
        avatarPath: null,
      },
    },
    {
      sessionId,
      userId: 'user_other',
      latitude: 12.9816,
      longitude: 77.6046,
      accuracy: 15,
      speed: 8.5, // Driving
      heading: 180,
      recordedAt: new Date().toISOString(),
      user: {
        userId: 'user_other',
        displayName: 'Other Driver',
        username: 'driver',
        avatarPath: null,
      },
    },
  ];

  let realtimeCallback: (payload: { eventType: string; new: unknown; old: unknown }) => void;
  let statusCallback: (status: string) => void;

  const mockChannel = {
    on: jest.fn().mockImplementation((_event, _filter, callback) => {
      realtimeCallback = callback;
      return mockChannel;
    }),
    subscribe: jest.fn().mockImplementation((callback) => {
      statusCallback = callback;
      if (statusCallback) statusCallback('SUBSCRIBED');
      return mockChannel;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (locationSessionService.getCurrentLocations as jest.Mock).mockResolvedValue({
      locations: mockLocations,
    });
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    (supabase.removeChannel as jest.Mock).mockReturnValue(Promise.resolve());
  });

  it('fetches initial locations and normalizes state correctly', async () => {
    const { result } = renderHook(() =>
      useRealtimeLocations(sessionId, currentUserId),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.isConnected).toBe(true);

    const selfRecord = result.current.locationsMap['user_self'];
    expect(selfRecord).toBeDefined();
    expect(selfRecord?.isCurrentUser).toBe(true);
    expect(selfRecord?.movementState).toBe('WALKING');
    expect(selfRecord?.isStale).toBe(false);

    const driverRecord = result.current.locationsMap['user_other'];
    expect(driverRecord).toBeDefined();
    expect(driverRecord?.isCurrentUser).toBe(false);
    expect(driverRecord?.movementState).toBe('DRIVING');
  });

  it('updates location map on Realtime INSERT / UPDATE event', async () => {
    const { result } = renderHook(() =>
      useRealtimeLocations(sessionId, currentUserId),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Simulate Realtime UPDATE for driver
    act(() => {
      realtimeCallback?.({
        eventType: 'UPDATE',
        new: {
          session_id: sessionId,
          user_id: 'user_other',
          latitude: 12.982,
          longitude: 77.605,
          accuracy: 8,
          speed: 12.0, // Driving faster
          heading: 185,
          recorded_at: new Date().toISOString(),
        },
        old: {},
      });
    });

    await waitFor(() => {
      const updatedDriver = result.current.locationsMap['user_other'];
      expect(updatedDriver?.latitude).toBe(12.982);
      expect(updatedDriver?.longitude).toBe(77.605);
      expect(updatedDriver?.speed).toBe(12.0);
      expect(updatedDriver?.movementState).toBe('DRIVING');
    });
  });

  it('removes member on Realtime DELETE event', async () => {
    const { result } = renderHook(() =>
      useRealtimeLocations(sessionId, currentUserId),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.locationsMap['user_other']).toBeDefined();

    // Simulate Realtime DELETE
    act(() => {
      realtimeCallback?.({
        eventType: 'DELETE',
        new: null,
        old: { user_id: 'user_other' },
      });
    });

    expect(result.current.locationsMap['user_other']).toBeUndefined();
    expect(result.current.locations).toHaveLength(1);
  });

  it('unsubscribes channel cleanly on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeLocations(sessionId, currentUserId),
    );

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
