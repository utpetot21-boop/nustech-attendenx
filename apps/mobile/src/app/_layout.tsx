import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';

// Suppress expo-notifications Expo Go SDK 53 warning (Android only)
// This is a known limitation — remote notifications removed from Expo Go SDK 53
if (__DEV__) {
  const _error = console.error.bind(console);
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('expo-notifications') && args[0].includes('SDK 53')) return;
    _error(...args);
  };
  const _warn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('expo-notifications')) return;
    _warn(...args);
  };
}
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  registerForPushNotifications,
  getCachedPushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '@/services/notifications.service';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// ── Auth guard — redirect berdasarkan status login ──────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const colorScheme = useColorScheme();

  // Muat user dari SecureStore sekali saat mount
  useEffect(() => {
    loadUser().then(async () => {
      // Setelah user ter-load, kirim ulang FCM token ke backend
      // (penting saat app dibuka ulang tanpa login ulang)
      try {
        const token = await getCachedPushToken();
        if (token) {
          await api.post('/auth/fcm-token', {
            fcm_token: token,
            platform: Platform.OS,
          });
        }
      } catch {
        // Gagal register FCM tidak boleh block loading
      }
    }).finally(() => setReady(true));
  }, []);

  // Redirect setelah user state siap
  useEffect(() => {
    if (!ready) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(main)');
    }
  }, [ready, user, segments]);

  // Tampilkan splash/loading saat loadUser masih berjalan
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colorScheme === 'dark' ? '#000' : '#F2F2F7',
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    registerForPushNotifications().catch((e) =>
      console.warn('[Push] Registration error:', e),
    );

    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.route) {
        router.push(data.route as any);
      }
    });

    receivedListenerRef.current = addNotificationReceivedListener((_notification) => {});

    return () => {
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
        </Stack>
      </AuthGuard>
    </QueryClientProvider>
    </SafeAreaProvider>
  );
}
