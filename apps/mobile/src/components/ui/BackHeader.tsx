import { TouchableOpacity, View, Text, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { lPrimary, lSecondary, C } from '@/constants/tokens';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  /** Warna aksen untuk judul & tombol kembali, default C.blue */
  accentColor?: string;
  /** Elemen kanan opsional (misal tombol tambah) */
  right?: React.ReactNode;
}

export function BackHeader({ title, subtitle, accentColor = C.blue, right }: BackHeaderProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 6,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Tombol kembali */}
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={22} strokeWidth={2.2} color={accentColor} />
      </TouchableOpacity>

      {/* Title + subtitle */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '800',
            color: lPrimary(isDark),
            letterSpacing: -0.4,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Slot kanan */}
      {right ?? null}
    </View>
  );
}
