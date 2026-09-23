import { renderHook, waitFor } from '@testing-library/react-native';
import { useLocationTracking } from '../../src/features/location/hooks/useLocationTracking';
import { locationEngine } from '../../src/features/location/services/locationEngine';
import * as authHook from '../../src/hooks/useAuth';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/location/services/locationEngine');

describe('useLocationTracking hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'usr_current', email: 'test@example.com' },
    });

    (locationEngine.getState as jest.Mock).mockReturnValue({
      isTracking: false,
      movementState: 'UNKNOWN',
      currentFix: null,
      lastTransmittedAt: null,
      transmissionCount: 0,
      error: null,
    });

    (locationEngine.subscribe as jest.Mock).mockImplementation((listener) => {
      listener(locationEngine.getState());
      return () => {};
    });

    (locationEngine.startTracking as jest.Mock).mockResolvedValue({ success: true });
  });

  it('starts tracking when user is an active participant and session is valid', async () => {
    const { result } = renderHook(() =>
      useLocationTracking('grp_100', 'sess_100', true, false),
    );

    await waitFor(() => {
      expect(locationEngine.startTracking).toHaveBeenCalledWith(
        'sess_100',
        'grp_100',
        'usr_current',
      );
    });

    expect(result.current.isTracking).toBe(false); // initial snapshot before broadcast
  });

  it('stops tracking when user is not participating', async () => {
    renderHook(() =>
      useLocationTracking('grp_100', 'sess_100', false, false),
    );

    expect(locationEngine.startTracking).not.toHaveBeenCalled();
    expect(locationEngine.stopTracking).toHaveBeenCalled();
  });

  it('stops tracking when group is expired', async () => {
    renderHook(() =>
      useLocationTracking('grp_100', 'sess_100', true, true),
    );

    expect(locationEngine.startTracking).not.toHaveBeenCalled();
    expect(locationEngine.stopTracking).toHaveBeenCalled();
    expect(locationEngine.onGroupExpired).toHaveBeenCalledWith('grp_100');
  });

  it('cleans up and stops tracking when component unmounts', () => {
    const { unmount } = renderHook(() =>
      useLocationTracking('grp_100', 'sess_100', true, false),
    );

    unmount();

    expect(locationEngine.stopTracking).toHaveBeenCalled();
  });
});
