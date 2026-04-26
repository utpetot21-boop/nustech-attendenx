import { useCallback, useRef } from 'react';
import { useColorScheme, View, Animated, TouchableOpacity, Text as RNText } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, router } from 'expo-router';
import {
  Home,
  Wrench,
  Bell,
  LayoutGrid,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { tasksService } from '@/services/tasks.service';
import { attendanceService } from '@/services/attendance.service';
import { api } from '@/services/api';
import { C } from '@/constants/tokens';
import { TabBarContext } from '@/context/TabBarContext';
import { useAuthStore } from '@/stores/auth.store';

const TAB_BAR_SLIDE = 100;
const TAB_H = 72;

const TAB_COLORS = {
  index:        C.blue,
  pekerjaan:    C.orange,
  notifications: C.red,
  profile:      C.purple,
};

function TabIcon({
  icon: Icon,
  focused,
  color,
  activeColor,
}: {
  icon: LucideIcon;
  focused: boolean;
  color: string;
  activeColor: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 30,
        borderRadius: 15,
        backgroundColor: focused ? `${activeColor}1F` : 'transparent',
      }}
    >
      <Icon
        size={21}
        strokeWidth={focused ? 2.2 : 1.6}
        color={focused ? activeColor : color}
      />
    </View>
  );
}

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)';
  const insets      = useSafeAreaInsets();
  const user        = useAuthStore((s) => s.user);

  // ── Auto-hide tab bar on scroll ─────────────────────────────────────────────
  const translateY  = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHidden    = useRef(false);

  const showTabBar = useCallback(() => {
    if (!isHidden.current) return;
    isHidden.current = false;
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, tension: 120, friction: 16,
    }).start();
  }, [translateY]);

  // onScroll tersedia di context tapi auto-hide dinonaktifkan agar nav selalu terlihat
  const onScroll = useCallback((_e: { nativeEvent: { contentOffset: { y: number } } }) => {}, []);

  // Badge: tugas pending_confirmation
  const { data: pendingTasks } = useQuery({
    queryKey: ['tasks', 'pending_confirmation'],
    queryFn: () => tasksService.getMyTasks({ status: 'pending_confirmation' }),
    refetchInterval: 30000,
    select: (d) => d?.total ?? 0,
  });

  // Badge: notif + pengumuman belum dibaca
  const { data: unreadNotif } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data?.count ?? 0),
    refetchInterval: 30000,
  });
  const { data: unreadAnn } = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: () => api.get('/announcements/me/unread-count').then((r) => r.data?.count ?? 0),
    refetchInterval: 60000,
  });

  // State absensi untuk warna FAB
  const { data: attState } = useQuery({
    queryKey: ['attendance-today', 'fab'],
    queryFn: () => attendanceService.getToday(),
    enabled: !!user,
    refetchInterval: 60000,
    select: (d) => ({ checkedIn: !!d?.check_in_at, checkedOut: !!d?.check_out_at }),
  });

  const taskBadge  = (pendingTasks ?? 0) > 0 ? pendingTasks : undefined;
  const totalUnread = (unreadNotif ?? 0) + (unreadAnn ?? 0);
  const notifBadge = totalUnread > 0 ? totalUnread : undefined;

  const fabColor = attState?.checkedOut ? '#8E8E93'
    : attState?.checkedIn             ? C.green
    : C.blue;

  // FAB: center tepat di tepi atas bar — setengah di dalam, setengah di luar
  const fabBottom = insets.bottom + TAB_H - 48;

  return (
    <TabBarContext.Provider value={{ translateY, onScroll, showTabBar }}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: TAB_H + insets.bottom,
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderTopWidth: 0.5,
              borderTopColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 8,
              transform: [{ translateY }],
            },
            tabBarActiveTintColor: C.blue,
            tabBarInactiveTintColor: inactiveColor,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2, marginBottom: 0 },
            tabBarItemStyle: { paddingTop: 8, paddingBottom: 8 },
          }}
        >
          {/* Tab 1 — Beranda */}
          <Tabs.Screen
            name="index"
            options={{
              title: 'Beranda',
              tabBarIcon: ({ focused, color }) => (
                <TabIcon icon={Home} focused={focused} color={color} activeColor={TAB_COLORS.index} />
              ),
            }}
            listeners={{ tabPress: showTabBar }}
          />

          {/* Tab 2 — Pekerjaan */}
          <Tabs.Screen
            name="pekerjaan"
            options={{
              title: 'Pekerjaan',
              tabBarBadge: taskBadge,
              tabBarBadgeStyle: { backgroundColor: C.orange, fontSize: 10, minWidth: 16, height: 16 },
              tabBarIcon: ({ focused, color }) => (
                <TabIcon icon={Wrench} focused={focused} color={color} activeColor={TAB_COLORS.pekerjaan} />
              ),
            }}
            listeners={{ tabPress: showTabBar }}
          />

          {/* Tab 3 — FAB Check-in (tengah, dummy screen) */}
          <Tabs.Screen
            name="fab-screen"
            options={{
              title: '',
              tabBarLabel: () => null,
              tabBarIcon: () => null,
              tabBarButton: () => (
                // Spacer kosong — FAB di-render sebagai overlay terpisah
                <View style={{ flex: 1 }} pointerEvents="none" />
              ),
            }}
          />

          {/* Tab 4 — Notifikasi */}
          <Tabs.Screen
            name="notifications"
            options={{
              title: 'Notifikasi',
              href: undefined,
              tabBarBadge: notifBadge,
              tabBarBadgeStyle: { backgroundColor: C.red, fontSize: 10, minWidth: 16, height: 16 },
              tabBarIcon: ({ focused, color }) => (
                <TabIcon icon={Bell} focused={focused} color={color} activeColor={TAB_COLORS.notifications} />
              ),
            }}
            listeners={{ tabPress: showTabBar }}
          />

          {/* Tab 5 — Profil */}
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profil',
              tabBarIcon: ({ focused, color }) => (
                <TabIcon icon={LayoutGrid} focused={focused} color={color} activeColor={TAB_COLORS.profile} />
              ),
            }}
            listeners={{ tabPress: showTabBar }}
          />

          {/* Hidden screens — accessible via router.push */}
          <Tabs.Screen name="tasks"                 options={{ href: null, title: 'Semua Tugas' }} />
          <Tabs.Screen name="tasks/[id]"            options={{ href: null, title: 'Detail Tugas' }} />
          <Tabs.Screen name="visits/index"          options={{ href: null, title: 'Riwayat Kunjungan' }} />
          <Tabs.Screen name="visits/[id]"           options={{ href: null, title: 'Detail Kunjungan' }} />
          <Tabs.Screen name="schedule"              options={{ href: null, title: 'Jadwal' }} />
          <Tabs.Screen name="service-reports/index" options={{ href: null, title: 'Berita Acara' }} />
          <Tabs.Screen name="service-reports/[id]"  options={{ href: null, title: 'Detail BA' }} />
          <Tabs.Screen name="expense-claims/index"  options={{ href: null, title: 'Klaim Biaya' }} />
          <Tabs.Screen name="sos"                   options={{ href: null, title: 'SOS' }} />
          <Tabs.Screen name="business-trips/index"  options={{ href: null, title: 'Surat Tugas' }} />
          <Tabs.Screen name="attendance"            options={{ href: null, title: 'Absensi' }} />
          <Tabs.Screen name="leave"                 options={{ href: null, title: 'Cuti & Izin' }} />
          <Tabs.Screen name="schedule-swap"         options={{ href: null, title: 'Tukar Jadwal' }} />
          <Tabs.Screen name="sos-alert"             options={{ href: null, title: 'SOS Alert', tabBarStyle: { display: 'none' } }} />
          <Tabs.Screen name="announcements"         options={{ href: null, title: 'Pengumuman' }} />
          <Tabs.Screen name="attendance-history"    options={{ href: null, title: 'Riwayat Absensi' }} />
          <Tabs.Screen name="attendance-requests-admin" options={{ href: null, title: 'Tinjau Izin Absen' }} />
          <Tabs.Screen name="leave-requests-admin"   options={{ href: null, title: 'Tinjau Pengajuan Cuti' }} />
          <Tabs.Screen name="warning-letters"       options={{ href: null, title: 'Surat Peringatan' }} />
        </Tabs>

        {/* ── FAB Absensi — menonjol di tengah tab bar (gaya QRIS) ─────────── */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: fabBottom,
            alignSelf: 'center',
            alignItems: 'center',
            transform: [{ translateY }],
            zIndex: 99,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push('/(main)/attendance')}
            activeOpacity={0.82}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: fabColor,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: fabColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 12,
              borderWidth: 3,
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
            }}
          >
            <Fingerprint size={26} strokeWidth={1.8} color="#FFF" />
          </TouchableOpacity>
          <RNText style={{
            fontSize: 10,
            fontWeight: '600',
            color: fabColor,
            marginTop: 4,
            letterSpacing: 0.2,
          }}>
            Hadir
          </RNText>
        </Animated.View>
      </View>
    </TabBarContext.Provider>
  );
}
