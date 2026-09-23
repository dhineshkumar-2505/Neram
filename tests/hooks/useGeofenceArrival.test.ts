import { renderHook, waitFor } from '@testing-library/react-native';
import { useGeofenceArrival } from '../../src/features/location/hooks/useGeofenceArrival';
import { locationEngine } from '../../src/features/location/services/locationEngine';
import { locationSessionService } from '../../src/features/location/services/locationSessionService';
import type { EventDestination } from '../../src/features/location/types';

jest.mock('../../src/features/location/services/locationEngine');
jest.mock('../../src/features/location/services/locationSessionService');

describe('useGeofenceArrival hook', () => {
  const sessionId = 'session_123';
  const userId = 'user_abc';

  const mockDestination: EventDestination = {
    id: 'dest_1',
    latitude: 13.082700,
    longitude: 80.270700,
    title: 'Meeting Cafe',
    locationName: 'Meeting Cafe',
    source: 'SESSION',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (locationSessionService.markParticipantArrived as jest.Mock).mockResolvedValue({
      success: true,
    });
  });

  it('does not trigger arrival when user is outside 50m geofence', () => {
    // Coordinate ~500m away
    const farFix = {
      latitude: 13.087200,
      longitude: 80.270700,
      accuracy: 10,
    };

    const { result } = renderHook(() =>
      useGeofenceArrival({
        currentFix: farFix,
        destination: mockDestination,
        sessionId,
        userId,
        isParticipating: true,
      }),
    );

    expect(result.current.hasArrived).toBe(false);
    expect(result.current.distanceToDestinationMeters).toBeGreaterThan(50);
    expect(locationSessionService.markParticipantArrived).not.toHaveBeenCalled();
    expect(locationEngine.stopTracking).not.toHaveBeenCalled();
  });

  it('triggers arrival when within 50m with good accuracy (<= 65m)', async () => {
    // Coordinate ~20m away from destination
    const nearFix = {
      latitude: 13.082850,
      longitude: 80.270700,
      accuracy: 15,
    };

    const onArrivedMock = jest.fn();

    const { result } = renderHook(() =>
      useGeofenceArrival({
        currentFix: nearFix,
        destination: mockDestination,
        sessionId,
        userId,
        isParticipating: true,
        onArrived: onArrivedMock,
      }),
    );

    await waitFor(() => {
      expect(result.current.hasArrived).toBe(true);
    });

    expect(result.current.distanceToDestinationMeters).toBeLessThanOrEqual(50);
    expect(locationSessionService.markParticipantArrived).toHaveBeenCalledWith(sessionId, userId);
    expect(locationEngine.stopTracking).toHaveBeenCalledTimes(1);
    expect(onArrivedMock).toHaveBeenCalledTimes(1);
  });

  it('rejects arrival if GPS accuracy is worse than 65m (Accuracy Gate)', () => {
    // Within 20m physically, but accuracy estimate is poor (80m)
    const inaccurateFix = {
      latitude: 13.082850,
      longitude: 80.270700,
      accuracy: 80, // > 65m
    };

    const { result } = renderHook(() =>
      useGeofenceArrival({
        currentFix: inaccurateFix,
        destination: mockDestination,
        sessionId,
        userId,
        isParticipating: true,
      }),
    );

    expect(result.current.hasArrived).toBe(false);
    expect(locationSessionService.markParticipantArrived).not.toHaveBeenCalled();
    expect(locationEngine.stopTracking).not.toHaveBeenCalled();
  });

  it('enforces idempotency: does not trigger repeated arrival updates', async () => {
    const nearFix = {
      latitude: 13.082850,
      longitude: 80.270700,
      accuracy: 10,
    };

    const { result, rerender } = renderHook(
      ({ fix }) =>
        useGeofenceArrival({
          currentFix: fix,
          destination: mockDestination,
          sessionId,
          userId,
          isParticipating: true,
        }),
      { initialProps: { fix: nearFix } },
    );

    await waitFor(() => {
      expect(result.current.hasArrived).toBe(true);
    });

    expect(locationSessionService.markParticipantArrived).toHaveBeenCalledTimes(1);

    // Another fix arrives at destination
    rerender({
      fix: {
        latitude: 13.082800,
        longitude: 80.270700,
        accuracy: 8,
      },
    });

    // Should remain 1 call
    expect(locationSessionService.markParticipantArrived).toHaveBeenCalledTimes(1);
    expect(locationEngine.stopTracking).toHaveBeenCalledTimes(1);
  });

  it('does not trigger arrival when user is not participating', () => {
    const nearFix = {
      latitude: 13.082850,
      longitude: 80.270700,
      accuracy: 10,
    };

    const { result } = renderHook(() =>
      useGeofenceArrival({
        currentFix: nearFix,
        destination: mockDestination,
        sessionId,
        userId,
        isParticipating: false, // not participating
      }),
    );

    expect(result.current.hasArrived).toBe(false);
    expect(locationSessionService.markParticipantArrived).not.toHaveBeenCalled();
  });

  it('does not trigger arrival when group is expired', () => {
    const nearFix = {
      latitude: 13.082850,
      longitude: 80.270700,
      accuracy: 10,
    };

    const { result } = renderHook(() =>
      useGeofenceArrival({
        currentFix: nearFix,
        destination: mockDestination,
        sessionId,
        userId,
        isParticipating: true,
        isExpired: true, // expired
      }),
    );

    expect(result.current.hasArrived).toBe(false);
    expect(locationSessionService.markParticipantArrived).not.toHaveBeenCalled();
  });
});
