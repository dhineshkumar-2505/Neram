import * as Location from 'expo-location';
import { LocationEngine } from '../../src/features/location/services/locationEngine';
import { locationPermissionService } from '../../src/features/location/services/locationPermissionService';
import { locationSessionService } from '../../src/features/location/services/locationSessionService';

jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 3,
  },
}));

jest.mock('../../src/features/location/services/locationPermissionService', () => ({
  locationPermissionService: {
    checkForegroundPermission: jest.fn(),
  },
}));

jest.mock('../../src/features/location/services/locationSessionService', () => ({
  locationSessionService: {
    upsertCurrentLocation: jest.fn(),
  },
}));

describe('LocationEngine', () => {
  let engine: LocationEngine;
  let mockLocationCallback: ((location: Location.LocationObject) => void) | null = null;
  const mockSubscription = {
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationCallback = null;

    (Location.watchPositionAsync as jest.Mock).mockImplementation(
      (_options, callback) => {
        mockLocationCallback = callback;
        return Promise.resolve(mockSubscription);
      },
    );

    (locationPermissionService.checkForegroundPermission as jest.Mock).mockResolvedValue('GRANTED');
    (locationSessionService.upsertCurrentLocation as jest.Mock).mockResolvedValue({ success: true });

    engine = new LocationEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('starts tracking and sets up single native watcher when authorized and permission granted', async () => {
    const result = await engine.startTracking('sess_1', 'grp_1', 'usr_1');

    expect(result.success).toBe(true);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(engine.getState().isTracking).toBe(true);
  });

  it('is idempotent: does not register a second watcher if already tracking the same session', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');
    const secondCall = await engine.startTracking('sess_1', 'grp_1', 'usr_1');

    expect(secondCall.success).toBe(true);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('stops previous watcher if called with a different session ID', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');
    await engine.startTracking('sess_2', 'grp_1', 'usr_1');

    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2);
  });

  it('fails to start tracking if permission is not GRANTED', async () => {
    (locationPermissionService.checkForegroundPermission as jest.Mock).mockResolvedValue('DENIED');

    const result = await engine.startTracking('sess_1', 'grp_1', 'usr_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Location permission is not granted.');
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    expect(engine.getState().isTracking).toBe(false);
  });

  it('transmits initial position fix immediately and increments transmissionCount', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');

    expect(mockLocationCallback).not.toBeNull();

    const mockFix: Location.LocationObject = {
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 10,
        accuracy: 12,
        altitudeAccuracy: 5,
        heading: 90,
        speed: 0,
      },
      timestamp: Date.now(),
    };

    mockLocationCallback!(mockFix);

    // Wait a tick for async transmission
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(locationSessionService.upsertCurrentLocation).toHaveBeenCalledWith(
      'sess_1',
      'usr_1',
      expect.objectContaining({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 12,
      }),
    );
    expect(engine.getState().transmissionCount).toBe(1);
  });

  it('stops tracking completely when stopTracking is invoked', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');
    engine.stopTracking();

    expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    expect(engine.getState().isTracking).toBe(false);
  });

  it('aborts tracking when onGroupExpired is triggered for the active group', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');
    engine.onGroupExpired('grp_1');

    expect(engine.getState().isTracking).toBe(false);
  });

  it('aborts tracking when user signs out', async () => {
    await engine.startTracking('sess_1', 'grp_1', 'usr_1');
    engine.onAuthSignedOut();

    expect(engine.getState().isTracking).toBe(false);
  });
});
