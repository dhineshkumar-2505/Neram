import { renderHook, waitFor } from '@testing-library/react-native';
import { useValhallaRoute } from '../../src/features/location/hooks/useValhallaRoute';
import { routingService } from '../../src/features/location/services/routingService';
import type { CalculatedRoute, EventDestination } from '../../src/features/location/types';

jest.mock('../../src/features/location/services/routingService');

describe('useValhallaRoute hook', () => {
  const mockDestination: EventDestination = {
    id: 'dest_1',
    latitude: 13.0850,
    longitude: 80.2750,
    title: 'Central Station',
    locationName: 'Central Station',
    source: 'SESSION',
  };

  const sampleRoute: CalculatedRoute = {
    coordinates: [
      [80.2707, 13.0827],
      [80.2750, 13.0850],
    ],
    distanceMeters: 1200,
    durationSeconds: 300,
    profile: 'auto',
    origin: { latitude: 13.0827, longitude: 80.2707 },
    destination: { latitude: 13.0850, longitude: 80.2750 },
    calculatedAt: Date.now(),
    isStale: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not calculate route if origin or destination is missing', () => {
    const { result } = renderHook(() =>
      useValhallaRoute({
        origin: null,
        destination: mockDestination,
      }),
    );

    expect(result.current.route).toBeNull();
    expect(result.current.formattedEta).toBe('--');
    expect(result.current.formattedDistance).toBe('--');
    expect(routingService.calculateRoute).not.toHaveBeenCalled();
  });

  it('calculates route successfully when origin and destination are provided', async () => {
    (routingService.calculateRoute as jest.Mock).mockResolvedValue({
      route: sampleRoute,
      error: undefined,
    });

    const { result } = renderHook(() =>
      useValhallaRoute({
        origin: { latitude: 13.0827, longitude: 80.2707 },
        destination: mockDestination,
        movementState: 'DRIVING',
      }),
    );

    await waitFor(() => {
      expect(result.current.route).not.toBeNull();
    });

    expect(result.current.formattedDistance).toBe('1.2 km');
    expect(result.current.formattedEta).toBe('5 min');
    expect(routingService.calculateRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'auto',
      }),
    );
  });

  it('selects pedestrian profile when movementState is WALKING', async () => {
    const walkingRoute: CalculatedRoute = {
      ...sampleRoute,
      profile: 'pedestrian',
      durationSeconds: 900,
    };

    (routingService.calculateRoute as jest.Mock).mockResolvedValue({
      route: walkingRoute,
      error: undefined,
    });

    const { result } = renderHook(() =>
      useValhallaRoute({
        origin: { latitude: 13.0827, longitude: 80.2707 },
        destination: mockDestination,
        movementState: 'WALKING',
      }),
    );

    await waitFor(() => {
      expect(result.current.route).not.toBeNull();
    });

    expect(routingService.calculateRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'pedestrian',
      }),
    );
    expect(result.current.formattedEta).toBe('15 min');
  });

  it('skips recalculation if origin displacement is under 35m and not stale', async () => {
    (routingService.calculateRoute as jest.Mock).mockResolvedValue({
      route: sampleRoute,
    });

    let currentOrigin = { latitude: 13.082700, longitude: 80.270700 };

    const { rerender } = renderHook(
      ({ origin }) =>
        useValhallaRoute({
          origin,
          destination: mockDestination,
        }),
      { initialProps: { origin: currentOrigin } },
    );

    await waitFor(() => {
      expect(routingService.calculateRoute).toHaveBeenCalledTimes(1);
    });

    // Move ~5 meters (very slight lat change, < 35m)
    currentOrigin = { latitude: 13.082740, longitude: 80.270700 };
    rerender({ origin: currentOrigin });

    // Should NOT have triggered a second route recalculation
    expect(routingService.calculateRoute).toHaveBeenCalledTimes(1);
  });

  it('triggers recalculation if origin displacement is >= 35m', async () => {
    (routingService.calculateRoute as jest.Mock).mockResolvedValue({
      route: sampleRoute,
    });

    let currentOrigin = { latitude: 13.082700, longitude: 80.270700 };

    const { rerender } = renderHook(
      ({ origin }) =>
        useValhallaRoute({
          origin,
          destination: mockDestination,
        }),
      { initialProps: { origin: currentOrigin } },
    );

    await waitFor(() => {
      expect(routingService.calculateRoute).toHaveBeenCalledTimes(1);
    });

    // Move ~60 meters north (13.08324 vs 13.08270 is ~60m)
    currentOrigin = { latitude: 13.083240, longitude: 80.270700 };
    rerender({ origin: currentOrigin });

    await waitFor(() => {
      expect(routingService.calculateRoute).toHaveBeenCalledTimes(2);
    });
  });

  it('does not calculate route when isExpired is true', () => {
    const { result } = renderHook(() =>
      useValhallaRoute({
        origin: { latitude: 13.0827, longitude: 80.2707 },
        destination: mockDestination,
        isExpired: true,
      }),
    );

    expect(result.current.route).toBeNull();
    expect(routingService.calculateRoute).not.toHaveBeenCalled();
  });
});
