import { useEffect, useState, useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';

interface Props {
  deadline: string; // ISO timestamp
  priority: 'normal' | 'high' | 'urgent';
}

function useCountdown(deadline: string) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return { remaining, minutes, seconds, expired: remaining === 0 };
}

const PRIORITY_COLORS: Record<string, { bar: string; text: string; bg: string; bgDark: string }> = {
  normal: { bar: '#007AFF', text: '#007AFF', bg: '#EFF6FF', bgDark: 'rgba(0,122,255,0.15)' },
  high: { bar: '#FF9F0A', text: '#C2410C', bg: '#FFF7ED', bgDark: 'rgba(255,159,10,0.15)' },
  urgent: { bar: '#FF453A', text: '#FF453A', bg: '#FFF1F0', bgDark: 'rgba(255,69,58,0.15)' },
};

export function ConfirmCountdown({ deadline, priority }: Props) {
  const isDark = useColorScheme() === 'dark';
  const { remaining, minutes, seconds, expired } = useCountdown(deadline);
  const colors = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal;

  // M2: useMemo — totalSeconds hanya berubah jika priority berubah, bukan tiap detik
  const totalSeconds = useMemo(
    () => (priority === 'urgent' ? 900 : priority === 'high' ? 1800 : 3600),
    [priority],
  );
  const pct = Math.max(0, remaining / totalSeconds);

  return (
    <View
      style={{
        backgroundColor: isDark ? colors.bgDark : colors.bg,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: isDark ? `${colors.bar}40` : `${colors.bar}30`,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text
          style={{ fontSize: 12, fontWeight: '600', color: colors.text }}
        >
          {expired ? '⚠️ Waktu Habis' : '⏱ Batas Konfirmasi'}
        </Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: expired ? '#FF453A' : remaining < 300 ? '#FF9F0A' : colors.text,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.5,
          }}
        >
          {expired
            ? '00:00'
            : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 4,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 4,
            width: `${pct * 100}%`,
            backgroundColor:
              expired ? '#FF453A' : remaining < 300 ? '#FF9F0A' : colors.bar,
            borderRadius: 2,
          }}
        />
      </View>

      {!expired && (
        <Text
          style={{
            fontSize: 11,
            color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF',
            marginTop: 6,
          }}
        >
          {remaining < 60
            ? 'Segera konfirmasi atau akan di-assign otomatis'
            : 'Terima atau tolak sebelum waktu habis'}
        </Text>
      )}
    </View>
  );
}
