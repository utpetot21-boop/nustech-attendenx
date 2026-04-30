import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, useColorScheme, InteractionManager, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/query-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  registerForPushNotifications,
  getCachedPushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '@/services/notifications.service';
import { rescheduleCheckInReminders } from '@/services/check-in-reminder.service';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import {
  NOTIF_ROUTE_MAP,
  ATTENDANCE_HISTORY_SENTINEL,
  ANN_TAB_SENTINEL,
  TASK_DEEP_LINK_TYPES,
} from '@/constants/notifRoutes';

const POSTED_FCM_TOKEN_KEY = 'posted_fcm_token';

// Cold-start: simpan data notif yang di-tap sebelum auth selesai load.
// Diproses oleh AuthGuard setelah user terkonfirmasi login.
let _pendingColdStart: Record<string, string> | null = null;

const ALLOWED_NOTIF_ROUTES = new Set<string>([
  ...Object.values(NOTIF_ROUTE_MAP).filter((r) => r.startsWith('/')),
  '/(main)/sos-alert',
  '/(main)/notifications',
]);

function isAllowedNotifRoute(route: string): boolean {
  if (ALLOWED_NOTIF_ROUTES.has(route)) return true;
  for (const allowed of ALLOWED_NOTIF_ROUTES) {
    if (route.startsWith(allowed + '/') || route.startsWith(allowed + '?')) return true;
  }
  return false;
}

function routeFromNotifData(
  data: Record<string, string>,
  push: (target: Parameters<ReturnType<typeof useRouter>['push']>[0]) => void,
): void {
  // SOS: params sanitized
  if (data.type === 'sos_alert') {
    push({ pathname: '/(main)/sos-alert', params: sanitizeSosParams(data) });
    return;
  }
  // Task deep-link — navigasi langsung ke detail tugas via task_id
  if (
    TASK_DEEP_LINK_TYPES.has(data.type) &&
    typeof data.task_id === 'string' &&
    /^[\w-]{8,64}$/.test(data.task_id)
  ) {
    push(`/(main)/tasks/${data.task_id}` as Href);
    return;
  }
  // Backend-sent route (whitelist-validated)
  if (data.route && isAllowedNotifRoute(data.route)) {
    push(data.route as Href);
    return;
  }
  const route = NOTIF_ROUTE_MAP[data.type];
  if (!route) return;
  if (route === ATTENDANCE_HISTORY_SENTINEL) {
    push({ pathname: '/(main)/attendance', params: { openHistory: '1' } });
  } else if (route === ANN_TAB_SENTINEL) {
    push({ pathname: '/(main)/notifications', params: { tab: 'ann' } });
  } else {
    push(route as Href);
  }
}

// ── Sanitasi params SOS dari push notification ──────────────────────────────
// Kalau ada pihak yang berhasil inject FCM, minimal lat/lng/userName tidak
// bisa dijadikan vektor (NaN crash, extreme value, kontrol char di display).
function sanitizeSosParams(data: Record<string, string>): {
  alertId: string;
  lat: string;
  lng: string;
  userName: string;
} {
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const rawName = typeof data.userName === 'string' ? data.userName : '';
  return {
    alertId:  (data.alertId ?? '').slice(0, 64),
    lat:      latOk ? String(lat) : '',
    lng:      lngOk ? String(lng) : '',
    userName: rawName.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 80) || 'Rekan Anda',
  };
}

// ── Error boundary — cegah force-close di production ───────────────────────
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(e: unknown) {
    return { hasError: true, error: String(e) };
  }
  componentDidCatch(e: unknown) {
    if (__DEV__) console.error('[ErrorBoundary]', e);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0A0A0F' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 }}>Terjadi Kesalahan</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 28 }}>
            Aplikasi mengalami error. Silakan restart atau coba lagi.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: '' })}
            style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: '#007AFF' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Coba Lagi</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 20, textAlign: 'center' }}>
              {this.state.error}
            </Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

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
      // (penting saat app dibuka ulang tanpa login ulang).
      // Dedup: hanya POST jika token berbeda dari yang pernah di-post.
      try {
        const token = await getCachedPushToken();
        if (token) {
          const posted = await SecureStore.getItemAsync(POSTED_FCM_TOKEN_KEY);
          if (posted !== token) {
            await api.post('/auth/fcm-token', {
              fcm_token: token,
              platform: Platform.OS,
            });
            await SecureStore.setItemAsync(POSTED_FCM_TOKEN_KEY, token);
          }
        }
      } catch {
        // Gagal register FCM tidak boleh block loading
      }
      // Fire-and-forget: re-schedule pengingat check-in sesuai jadwal terbaru
      rescheduleCheckInReminders().catch(() => null);
    }).finally(() => setReady(true));
  }, []);

  // Redirect setelah user state siap
  useEffect(() => {
    if (!ready) return;

    const inAuth          = segments[0] === '(auth)';
    const onChangePw      = segments[1] === 'change-password';
    const mustChangePw    = !!user?.must_change_password;

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && mustChangePw) {
      if (!onChangePw) router.replace('/(auth)/change-password');
    } else if (user && inAuth && !mustChangePw) {
      router.replace('/(main)');
    } else if (user && !mustChangePw && _pendingColdStart) {
      // Cold-start: auth sudah siap, proses notif yang pending
      const data = _pendingColdStart;
      _pendingColdStart = null;
      InteractionManager.runAfterInteractions(() => {
        routeFromNotifData(data, (t) => router.push(t as Parameters<typeof router.push>[0]));
      });
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
    registerForPushNotifications().catch((e) => {
      if (__DEV__) console.warn('[Push] Registration error:', e);
    });

    // Warm-start: app di background, user tap notif → auth sudah aktif, langsung navigate
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      routeFromNotifData(data, (t) => router.push(t as Parameters<typeof router.push>[0]));
    });

    // Cold-start: app killed → simpan data, AuthGuard yang navigasi setelah auth siap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      _pendingColdStart = data;
    }).catch(() => null);

    // Notif masuk saat app foreground → invalidasi badge segera (tanpa tunggu interval)
    receivedListenerRef.current = addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['ann-unread-count'] });
    });

    return () => {
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
          </Stack>
        </AuthGuard>
      </AppErrorBoundary>
    </QueryClientProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
