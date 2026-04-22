/**
 * Push Notification Service
 * - Registers for Expo push notifications
 * - Stores push token in SecureStore
 * - Sets up foreground notification handler
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Configure how notifications appear when the app is in the foreground
// Wrapped in try-catch: Android Expo Go SDK 53 removed remote notification support
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK baru: shouldShowBanner + shouldShowList wajib
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      // Backward-compat: iOS lama masih baca shouldShowAlert
      shouldShowAlert: true,
    }),
  });
} catch {
  // Expo Go SDK 53 on Android — push notifications not supported, skip silently
}

const PUSH_TOKEN_KEY = 'expo_push_token';

/**
 * Request permission and get Expo push token.
 * Returns null if permission denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    if (__DEV__) console.log('[Push] Skipping — not a physical device');
    return null;
  }

  // Check existing permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('[Push] Permission not granted');
    return null;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AttendenX',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
      });
      // Channel khusus SOS — always-on, tidak bisa di-mute per-app
      await Notifications.setNotificationChannelAsync('sos', {
        name: 'SOS Darurat',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightColor: '#FF3B30',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      // Android Expo Go SDK 53 — skip channel setup
    }
  }

  try {
    // Expo Go: getExpoPushTokenAsync → ExponentPushToken[...]
    // Production build: getDevicePushTokenAsync → raw FCM token
    let token: string | null = null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    try {
      // Jika projectId tersedia (EAS build), pakai Expo push token
      // Jika tidak (Expo Go dev), tetap coba tanpa projectId
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      token = tokenData.data;
    } catch {
      // Fallback ke raw FCM token untuk production build tanpa EAS
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData.data as string;
    }
    if (!token) return null;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    if (__DEV__) console.log('[Push] Token registered:', token.slice(0, 30) + '…');
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[Push] Failed to get token:', err);
    return null;
  }
}

/**
 * Get cached push token from SecureStore.
 */
export async function getCachedPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

/**
 * Add a listener for notification taps (background → open app).
 * Returns the subscription to remove it on unmount.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription | null {
  try {
    return Notifications.addNotificationResponseReceivedListener(handler);
  } catch {
    return null;
  }
}

/**
 * Add a listener for foreground notifications.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription | null {
  try {
    return Notifications.addNotificationReceivedListener(handler);
  } catch {
    return null;
  }
}
