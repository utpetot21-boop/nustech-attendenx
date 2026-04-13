import { useColorScheme, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import {
  Home,
  Wrench,
  LayoutGrid,
} from 'lucide-react-native';

// ── Warna aksen per tab ──────────────────────────────────────────────────────
const TAB_COLORS = {
  index:      '#007AFF',
  pekerjaan:  '#FF9500',
  profile:    '#AF52DE',
};

// ── Icon wrapper dengan active pill indicator ────────────────────────────────
function TabIcon({
  icon: Icon,
  focused,
  color,
  activeColor,
}: {
  icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
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
        tabBarActiveTintColor: '#007AFF',
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
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Home} focused={focused} color={color} activeColor={TAB_COLORS.index} />
          ),
        }}
      />
      <Tabs.Screen
        name="pekerjaan"
        options={{
          title: 'Pekerjaan',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon={Wrench} focused={focused} color={color} activeColor={TAB_COLORS.pekerjaan} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Saya',
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
    </Tabs>
  );
}
