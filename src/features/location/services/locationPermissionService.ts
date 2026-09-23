import * as Location from 'expo-location';
import { Linking } from 'react-native';
import type { LocationPermissionState } from '../types';

export const locationPermissionService = {
  /**
   * Queries current operating system foreground location permission state.
   */
  async checkForegroundPermission(): Promise<LocationPermissionState> {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

      if (status === Location.PermissionStatus.GRANTED) {
        return 'GRANTED';
      }

      if (status === Location.PermissionStatus.DENIED) {
        return canAskAgain ? 'DENIED' : 'BLOCKED';
      }

      return 'NOT_DETERMINED';
    } catch {
      return 'NOT_DETERMINED';
    }
  },

  /**
   * Triggers the operating system location permission request dialog.
   * MUST only be called after user completes the Stage 1 educational opt-in.
   */
  async requestForegroundPermission(): Promise<{
    granted: boolean;
    state: LocationPermissionState;
  }> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === Location.PermissionStatus.GRANTED) {
        return { granted: true, state: 'GRANTED' };
      }

      const state: LocationPermissionState = canAskAgain ? 'DENIED' : 'BLOCKED';
      return { granted: false, state };
    } catch {
      return { granted: false, state: 'DENIED' };
    }
  },

  /**
   * Opens device application settings when permissions are permanently blocked.
   */
  async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch {
      // Graceful fallback if openSettings fails
    }
  },
};
