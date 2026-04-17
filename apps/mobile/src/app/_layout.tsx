import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
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

    const inAuth          = segments[0] === '(auth)';
    const onChangePw      = segments[1] === 'change-password';
    const mustChangePw    = !!user?.must_change_password;

    if (!user && !inAuth) {
      // Belum login → ke halaman login
      router.replace('/(auth)/login');
    } else if (user && mustChangePw) {
      // Password harus diganti — paksa ke halaman ganti password
      // (kecuali sudah di halaman itu)
      if (!onChangePw) {
        router.replace('/(auth)/change-password');
      }
    } else if (user && inAuth && !mustChangePw) {
      // Sudah login + password oke, tapi masih di auth area → ke main
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
      if (!data) return;

      // Jika backend sudah kirim route langsung, pakai itu
      if (data.route) {
        router.push(data.route as Href);
        return;
      }

      // SOS alert untuk penerima — buka layar peta SOS dengan params
      if (data.type === 'sos_alert') {
        router.push({
          pathname: '/(main)/sos-alert',
          params: {
            alertId:  data.alertId  ?? '',
            lat:      data.lat      ?? '',
            lng:      data.lng      ?? '',
            userName: data.userName ?? 'Rekan Anda',
          },
        });
        return;
      }

      // Mapping type → route
      const ROUTE_MAP: Record<string, string> = {
        // Tukar Jadwal
        swap_request_received:          '/(main)/schedule-swap',
        swap_request_accepted_by_target:'/(main)/schedule-swap',
        swap_request_approved:          '/(main)/schedule-swap',
        swap_request_rejected:          '/(main)/schedule-swap',
        swap_request_admin:             '/(main)/schedule-swap',
        // Cuti & Izin
        leave_approved:                 '/(main)/leave',
        leave_rejected:                 '/(main)/leave',
        leave_expiry_reminder:          '/(main)/leave',
        collective_leave_deduction:     '/(main)/leave',
        // Absensi izin terlambat / pulang awal
        late_arrival_approved:          '/(main)/attendance',
        late_arrival_rejected:          '/(main)/attendance',
        early_departure_approved:       '/(main)/attendance',
        early_departure_rejected:       '/(main)/attendance',
        // Absensi / SP
        sp_reminder:                    '/(main)/attendance',
        alfa_detected:                  '/(main)/attendance',
        // SOS aktivasi (pengirim)
        sos:                            '/(main)/sos',
        // Tugas
        task_assigned:                  '/(main)/tasks',
        sla_breach:                     '/(main)/tasks',
        // Berita Acara
        ba_generated:                   '/(main)/service-reports/index',
      };

      // Pengumuman — buka tab Pengumuman di halaman notifikasi
      if (data.type === 'announcement_approved' || data.type === 'announcement_rejected' || data.type === 'announcement_pending') {
        router.push({ pathname: '/(main)/notifications', params: { tab: 'ann' } });
        return;
      }

      const route = ROUTE_MAP[data.type];
      if (route) router.push(route as Href);
    });

    // Cold-start: app dibuka dari notif saat killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      setTimeout(() => {
        if (data.type === 'sos_alert') {
          router.push({
            pathname: '/(main)/sos-alert',
            params: {
              alertId:  data.alertId  ?? '',
              lat:      data.lat      ?? '',
              lng:      data.lng      ?? '',
              userName: data.userName ?? 'Rekan Anda',
            },
          });
        } else if (data.type === 'announcement_approved' || data.type === 'announcement_rejected' || data.type === 'announcement_pending') {
          router.push({ pathname: '/(main)/notifications', params: { tab: 'ann' } });
        }
      }, 500); // delay kecil agar router sudah siap
    }).catch(() => null);

    receivedListenerRef.current = addNotificationReceivedListener((_notification) => {});

    return () => {
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
