import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { locationPermissionService } from '../../src/features/location/services/locationPermissionService';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

describe('locationPermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkForegroundPermission', () => {
    it('returns GRANTED when expo-location returns GRANTED', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        canAskAgain: true,
      });

      const state = await locationPermissionService.checkForegroundPermission();

      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
      expect(state).toBe('GRANTED');
    });

    it('returns DENIED when permission is denied and can ask again', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        canAskAgain: true,
      });

      const state = await locationPermissionService.checkForegroundPermission();

      expect(state).toBe('DENIED');
    });

    it('returns BLOCKED when permission is denied and cannot ask again', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        canAskAgain: false,
      });

      const state = await locationPermissionService.checkForegroundPermission();

      expect(state).toBe('BLOCKED');
    });

    it('returns NOT_DETERMINED when undetermined or on exception', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Hardware sensor query failed'),
      );

      const state = await locationPermissionService.checkForegroundPermission();

      expect(state).toBe('NOT_DETERMINED');
    });
  });

  describe('requestForegroundPermission', () => {
    it('prompts the native OS dialog and returns granted state', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        canAskAgain: true,
      });

      const result = await locationPermissionService.requestForegroundPermission();

      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(result.granted).toBe(true);
      expect(result.state).toBe('GRANTED');
    });

    it('returns DENIED state when user rejects but can ask again', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        canAskAgain: true,
      });

      const result = await locationPermissionService.requestForegroundPermission();

      expect(result.granted).toBe(false);
      expect(result.state).toBe('DENIED');
    });

    it('returns BLOCKED state when permanently denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        canAskAgain: false,
      });

      const result = await locationPermissionService.requestForegroundPermission();

      expect(result.granted).toBe(false);
      expect(result.state).toBe('BLOCKED');
    });

    it('handles unexpected request exceptions gracefully', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission dialog cancelled by OS'),
      );

      const result = await locationPermissionService.requestForegroundPermission();

      expect(result.granted).toBe(false);
      expect(result.state).toBe('DENIED');
    });
  });

  describe('openSettings', () => {
    it('opens application device settings via Linking.openSettings', async () => {
      const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

      await locationPermissionService.openSettings();

      expect(openSettingsSpy).toHaveBeenCalled();
      openSettingsSpy.mockRestore();
    });

    it('handles Linking error gracefully', async () => {
      const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('Cannot open settings'));

      await expect(locationPermissionService.openSettings()).resolves.toBeUndefined();
      openSettingsSpy.mockRestore();
    });
  });
});
