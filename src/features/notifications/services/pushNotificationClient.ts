import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { notificationService } from './notificationService';

const SECURE_STORE_DEVICE_ID_KEY = 'neram_push_device_id';
export const DEFAULT_CHANNEL_ID = 'neram-default';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Retrieves or lazily creates a stable persistent hardware installation UUID.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(SECURE_STORE_DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const newId = Crypto.randomUUID();
    await SecureStore.setItemAsync(SECURE_STORE_DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return 'fallback-device-' + Date.now();
  }
}

export interface RegisterPushResult {
  success: boolean;
  pushToken?: string;
  deviceId?: string;
  reason?: 'NOT_A_DEVICE' | 'PERMISSION_DENIED' | 'TOKEN_ERROR' | 'NETWORK_ERROR';
  error?: string;
}

/**
 * Client-side push notification registration service.
 * Negotiates device permissions, configures Android channels, obtains ExponentPushToken,
 * and synchronizes with public.user_devices on Supabase.
 */
export const pushNotificationClient = {
  /**
   * Configures Android high-priority notification channels.
   */
  async configureAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: 'Neram Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FF9D',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
      });
    }
  },

  /**
   * Prompts user for system permissions, retrieves Expo push token, and saves to user_devices.
   */
  async registerForPushNotificationsAsync(userId: string): Promise<RegisterPushResult> {
    try {
      await this.configureAndroidChannel();

      // Push notifications require a physical device or Expo Go
      if (!Device.isDevice) {
        if (__DEV__) {
          console.warn('[pushNotificationClient] Push notifications require a physical device.');
        }
        return { success: false, reason: 'NOT_A_DEVICE' };
      }

      // 1. Verify permissions
      const permissionRes = await Notifications.getPermissionsAsync();
      let finalStatus = permissionRes?.status;

      if (finalStatus !== 'granted') {
        const reqRes = await Notifications.requestPermissionsAsync();
        finalStatus = reqRes?.status;
      }

      if (finalStatus !== 'granted') {
        return { success: false, reason: 'PERMISSION_DENIED' };
      }

      // 2. Obtain Expo push token
      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenResponse.data;

      if (!pushToken) {
        return { success: false, reason: 'TOKEN_ERROR', error: 'Empty token returned by Expo.' };
      }

      // 3. Obtain stable device identifier
      const deviceId = await getOrCreateDeviceId();
      const platform: 'ANDROID' | 'IOS' = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

      // 4. Upsert into Supabase user_devices
      const res = await notificationService.registerDeviceToken(
        {
          deviceId,
          platform,
          pushToken,
        },
        userId,
      );

      if (!res.success) {
        return { success: false, reason: 'NETWORK_ERROR', error: res.error };
      }

      return { success: true, pushToken, deviceId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown push registration failure';
      if (__DEV__) {
        console.warn('[pushNotificationClient] Error registering push notifications:', msg);
      }
      return { success: false, reason: 'TOKEN_ERROR', error: msg };
    }
  },

  /**
   * Removes device push token from public.user_devices upon logout.
   */
  async unregisterPushNotificationsAsync(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deviceId = await getOrCreateDeviceId();
      return await notificationService.unregisterDeviceToken(deviceId, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during push unregistration';
      return { success: false, error: msg };
    }
  },

  /**
   * Subscribes to notification interaction events (e.g. user taps on lock-screen notification).
   */
  addResponseListener(
    listener: (response: Notifications.NotificationResponse) => void,
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  },

  /**
   * Subscribes to foreground notification arrival events.
   */
  addReceivedListener(
    listener: (notification: Notifications.Notification) => void,
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(listener);
  },
};

export default pushNotificationClient;
