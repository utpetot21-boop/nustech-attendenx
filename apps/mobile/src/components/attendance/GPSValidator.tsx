import { useEffect, useRef } from 'react';
import { View, Text, useColorScheme, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
  ReduceMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  isLoading: boolean;
  isWithinRadius: boolean | null;
  distanceMeters: number | null;
  officeName?: string;
  accuracy?: number | null;
}

const PULSE_ITERATIONS = 3; // ~4.5 detik lalu berhenti otomatis — hemat battery

export function GPSValidator({
  isLoading,
  isWithinRadius,
  distanceMeters,
  officeName = 'Kantor',
  accuracy,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Shared values (UI thread — tidak lewat JS bridge)
  const dotScale    = useSharedValue(1);
  const ringScale   = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  const prevInRadius = useRef<boolean | null>(null);

  useEffect(() => {
    // Trigger hanya saat transisi ke valid (dari null/false → true)
    const enteringValid = isWithinRadius === true && prevInRadius.current !== true;
    prevInRadius.current = isWithinRadius;

    if (!enteringValid) return;

    // Haptic tick ringan — affirmation sistem mendeteksi lokasi valid
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Dot: bounce spring sekali (~400ms)
    dotScale.value = withSequence(
      withSpring(1.3, { damping: 8,  stiffness: 220, reduceMotion: ReduceMotion.System }),
      withSpring(1,   { damping: 12, stiffness: 180, reduceMotion: ReduceMotion.System }),
    );

    // Ring: pulse finite 3x lalu berhenti (fade + scale keluar)
    ringOpacity.value = 0.55;
    ringScale.value   = 1;
    ringOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, reduceMotion: ReduceMotion.System }),
      PULSE_ITERATIONS,
      false,
    );
    ringScale.value = withRepeat(
      withTiming(2.6, { duration: 1500, reduceMotion: ReduceMotion.System }),
      PULSE_ITERATIONS,
      false,
    );
  }, [isWithinRadius, dotScale, ringScale, ringOpacity]);

  // Cleanup saat unmount — pastikan worklet berhenti
  useEffect(() => {
    return () => {
      cancelAnimation(dotScale);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
    };
  }, [dotScale, ringScale, ringOpacity]);

  const dotStyle  = useAnimatedStyle(() => ({ transform: [{ scale: dotScale.value  }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

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
        {/* Dot container — relative supaya ring halo bisa absolute overlay */}
        <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
          {isWithinRadius && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: dotColor,
                },
                ringStyle,
              ]}
            />
          )}
          <Animated.View
            style={[
              { width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor },
              isWithinRadius ? dotStyle : undefined,
            ]}
          />
        </View>

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
