import { renderHook, waitFor } from '@testing-library/react-native';
import { useEventDestination } from '../../src/features/location/hooks/useEventDestination';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase');

describe('useEventDestination hook', () => {
  const groupId = 'group_abc';
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    (supabase.removeChannel as jest.Mock).mockReturnValue(Promise.resolve());
  });

  it('prioritizes upcoming milestone event with coordinates', async () => {
    const mockEvents = [
      {
        id: 'event_std',
        title: 'Lunch',
        location_name: 'Diner',
        latitude: 12.91,
        longitude: 77.61,
        is_milestone: false,
        target_time: new Date(Date.now() + 3600000).toISOString(),
      },
      {
        id: 'event_milestone',
        title: 'Keynote Demo',
        location_name: 'Main Stage',
        latitude: 12.95,
        longitude: 77.65,
        is_milestone: true,
        target_time: new Date(Date.now() + 7200000).toISOString(),
      },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockEvents,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useEventDestination(groupId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.destination).not.toBeNull();
    expect(result.current.destination?.id).toBe('event_milestone');
    expect(result.current.destination?.source).toBe('EVENT_MILESTONE');
    expect(result.current.destination?.isMilestone).toBe(true);
    expect(result.current.destination?.title).toBe('Keynote Demo');
  });

  it('selects earliest upcoming standard event when no milestone is available', async () => {
    const mockEvents = [
      {
        id: 'event_1',
        title: 'Morning Sync',
        location_name: 'Blue Tokai Cafe',
        latitude: 12.93,
        longitude: 77.62,
        is_milestone: false,
        target_time: new Date(Date.now() + 1800000).toISOString(),
      },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: mockEvents,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useEventDestination(groupId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.destination).not.toBeNull();
    expect(result.current.destination?.id).toBe('event_1');
    expect(result.current.destination?.source).toBe('EVENT');
    expect(result.current.destination?.title).toBe('Morning Sync');
  });

  it('falls back to location session destination when no events have coordinates', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const sessionFallback = {
      destinationLat: 13.0827,
      destinationLng: 80.2707,
      destinationName: 'Marina Beach',
      title: 'Beach Gathering',
    };

    const { result } = renderHook(() =>
      useEventDestination(groupId, sessionFallback),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.destination).not.toBeNull();
    expect(result.current.destination?.id).toBe('session-destination');
    expect(result.current.destination?.source).toBe('SESSION_DESTINATION');
    expect(result.current.destination?.latitude).toBe(13.0827);
    expect(result.current.destination?.locationName).toBe('Marina Beach');
  });

  it('returns null if neither event nor session provides coordinates', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useEventDestination(groupId, null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.destination).toBeNull();
  });
});
