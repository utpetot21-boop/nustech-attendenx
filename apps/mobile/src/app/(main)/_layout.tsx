import { useColorScheme, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import {
  Home,
  Wrench,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { tasksService } from '@/services/tasks.service';
import { api } from '@/services/api';
import { C } from '@/constants/tokens';

// ── Warna aksen per tab ──────────────────────────────────────────────────────
const TAB_COLORS = {
  index:      C.blue,
  pekerjaan:  C.orange,
  profile:    C.purple,
};

// ── Icon wrapper dengan active pill indicator ────────────────────────────────
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
  const isDark = colorScheme === 'dark';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)';

  // Badge: tugas pending_confirmation yang perlu aksi
  const { data: pendingTasks } = useQuery({
    queryKey: ['tasks', 'pending_confirmation'],
    queryFn: () => tasksService.getMyTasks({ status: 'pending_confirmation' }),
    refetchInterval: 30000,
    select: (d) => d?.total ?? 0,
  });

  // Badge: notif belum dibaca
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data?.count ?? 0),
    refetchInterval: 30000,
  });

  const taskBadge = (pendingTasks ?? 0) > 0 ? pendingTasks : undefined;
  const notifBadge = (unreadCount ?? 0) > 0 ? unreadCount : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 12,
          left: 16,
          right: 16,
          borderRadius: 28,
          height: 76,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: isDark
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(255,255,255,0.90)',
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={isDark ? 85 : 90}
            tint={isDark ? 'dark' : 'systemChromeMaterial'}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarBadge: notifBadge,
          tabBarBadgeStyle: { backgroundColor: C.red, fontSize: 10, minWidth: 16, height: 16 },
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Home} focused={focused} color={color} activeColor={TAB_COLORS.index} />
          ),
        }}
      />
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
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={LayoutGrid} focused={focused} color={color} activeColor={TAB_COLORS.profile} />
          ),
        }}
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
      <Tabs.Screen name="notifications"         options={{ href: null, title: 'Notifikasi' }} />
      <Tabs.Screen name="leave"                 options={{ href: null, title: 'Cuti & Izin' }} />
      <Tabs.Screen name="schedule-swap"         options={{ href: null, title: 'Tukar Jadwal' }} />
      <Tabs.Screen name="sos-alert"             options={{ href: null, title: 'SOS Alert' }} />
    </Tabs>
  );
}
