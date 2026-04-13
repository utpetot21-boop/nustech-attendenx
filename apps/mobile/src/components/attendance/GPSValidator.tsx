import { View, Text, useColorScheme, ActivityIndicator } from 'react-native';

interface Props {
  isLoading: boolean;
  isWithinRadius: boolean | null;
  distanceMeters: number | null;
  officeName?: string;
  accuracy?: number | null;
}

export function GPSValidator({
  isLoading,
  isWithinRadius,
  distanceMeters,
  officeName = 'Kantor',
  accuracy,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (isLoading) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
          borderRadius: 14,
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
          padding: 12,
          marginHorizontal: 10,
        }}
      >
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
          Mendapatkan lokasi GPS...
        </Text>
      </View>
    );
  }

  if (isWithinRadius === null) return null;

  const bgColor = isWithinRadius
    ? isDark ? 'rgba(52,199,89,0.14)' : '#F0FDF4'
    : isDark ? 'rgba(255,159,10,0.14)' : '#FFF7ED';
  const borderColor = isWithinRadius
    ? isDark ? 'rgba(52,199,89,0.35)' : '#BBF7D0'
    : isDark ? 'rgba(255,159,10,0.35)' : '#FED7AA';
  const dotColor = isWithinRadius ? '#34C759' : '#FF9F0A';
  const textColor = isWithinRadius
    ? isDark ? '#86EFAC' : '#15803D'
    : isDark ? '#FCD34D' : '#C2410C';

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: 14,
        borderWidth: 0.5,
        borderColor,
        padding: 12,
        marginHorizontal: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>
          {isWithinRadius
            ? `${officeName} · Dalam radius`
            : `${distanceMeters}m dari ${officeName}`}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280', paddingLeft: 16 }}>
        {isWithinRadius
          ? `GPS aktif · ${accuracy ? `Akurasi ${Math.round(accuracy)}m · ` : ''}Siap check-in`
          : 'Di luar radius. Scan QR atau konfirmasi alasan.'}
      </Text>
    </View>
  );
}
