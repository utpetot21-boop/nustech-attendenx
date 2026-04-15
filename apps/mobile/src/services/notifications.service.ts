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

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PUSH_TOKEN_KEY = 'expo_push_token';

/**
 * Request permission and get Expo push token.
 * Returns null if permission denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Skipping — not a physical device');
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
    console.log('[Push] Permission not granted');
    return null;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'AttendenX',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  try {
    // Expo Go: getExpoPushTokenAsync → ExponentPushToken[...]
    // Production build: getDevicePushTokenAsync → raw FCM token
    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
    } catch {
      // Fallback ke raw FCM token untuk production build
      const tokenData = await Notifications.getDevicePushTokenAsync();
      token = tokenData.data as string;
    }
    if (!token) return null;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    console.log('[Push] Token registered:', token.slice(0, 30) + '…');
    return token;
  } catch (err) {
    console.warn('[Push] Failed to get token:', err);
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
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Add a listener for foreground notifications.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}
