import {
  pushNotificationClient,
  DEFAULT_CHANNEL_ID,
  getOrCreateDeviceId,
} from '../../src/features/notifications/services/pushNotificationClient';
import { notificationService } from '../../src/features/notifications/services/notificationService';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
}));

let mockIsDevice = true;

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-secure-device-uuid'),
}));

jest.mock('../../src/features/notifications/services/notificationService', () => ({
  notificationService: {
    registerDeviceToken: jest.fn(),
    unregisterDeviceToken: jest.fn(),
  },
}));

describe('pushNotificationClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDevice = true;
    Platform.OS = 'android';
  });

  describe('getOrCreateDeviceId', () => {
    it('returns existing deviceId from SecureStore if present', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('saved-device-999');
      const deviceId = await getOrCreateDeviceId();
      expect(deviceId).toBe('saved-device-999');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('generates, persists and returns a new UUID if SecureStore is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
      const deviceId = await getOrCreateDeviceId();
      expect(deviceId).toBe('mock-secure-device-uuid');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'neram_push_device_id',
        'mock-secure-device-uuid',
      );
    });
  });

  describe('configureAndroidChannel', () => {
    it('creates high priority notification channel on Android', async () => {
      Platform.OS = 'android';
      await pushNotificationClient.configureAndroidChannel();
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        DEFAULT_CHANNEL_ID,
        expect.objectContaining({
          name: 'Neram Alerts',
          importance: 5,
          lightColor: '#00FF9D',
        }),
      );
    });

    it('bypasses channel creation on iOS', async () => {
      Platform.OS = 'ios';
      await pushNotificationClient.configureAndroidChannel();
      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('registerForPushNotificationsAsync', () => {
    it('returns NOT_A_DEVICE if running in simulator or emulator', async () => {
      mockIsDevice = false;
      const result = await pushNotificationClient.registerForPushNotificationsAsync('usr_123');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('NOT_A_DEVICE');
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('returns PERMISSION_DENIED when system permission is refused', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

      const result = await pushNotificationClient.registerForPushNotificationsAsync('usr_123');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('PERMISSION_DENIED');
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('successfully registers device token when permissions are granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'ExponentPushToken[mock-token-xyz]',
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('device-abc');
      (notificationService.registerDeviceToken as jest.Mock).mockResolvedValueOnce({ success: true });

      const result = await pushNotificationClient.registerForPushNotificationsAsync('usr_123');

      expect(result.success).toBe(true);
      expect(result.pushToken).toBe('ExponentPushToken[mock-token-xyz]');
      expect(result.deviceId).toBe('device-abc');
      expect(notificationService.registerDeviceToken).toHaveBeenCalledWith(
        {
          deviceId: 'device-abc',
          platform: 'ANDROID',
          pushToken: 'ExponentPushToken[mock-token-xyz]',
        },
        'usr_123',
      );
    });

    it('handles network synchronization failure gracefully', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'ExponentPushToken[mock-token-xyz]',
      });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('device-abc');
      (notificationService.registerDeviceToken as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Network request failed',
      });

      const result = await pushNotificationClient.registerForPushNotificationsAsync('usr_123');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('NETWORK_ERROR');
      expect(result.error).toBe('Network request failed');
    });
  });

  describe('unregisterPushNotificationsAsync', () => {
    it('retrieves device ID and calls unregisterDeviceToken', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('device-abc');
      (notificationService.unregisterDeviceToken as jest.Mock).mockResolvedValueOnce({ success: true });

      const res = await pushNotificationClient.unregisterPushNotificationsAsync('usr_123');
      expect(res.success).toBe(true);
      expect(notificationService.unregisterDeviceToken).toHaveBeenCalledWith('device-abc', 'usr_123');
    });
  });

  describe('Listeners', () => {
    it('attaches response listener properly', () => {
      const mockCallback = jest.fn();
      pushNotificationClient.addResponseListener(mockCallback);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(mockCallback);
    });

    it('attaches received listener properly', () => {
      const mockCallback = jest.fn();
      pushNotificationClient.addReceivedListener(mockCallback);
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(mockCallback);
    });
  });
});
