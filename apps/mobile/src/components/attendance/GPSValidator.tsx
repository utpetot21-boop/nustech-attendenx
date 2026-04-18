import { useEffect, useRef } from 'react';
import { View, Text, useColorScheme, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
  ReduceMotion,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check, AlertCircle } from 'lucide-react-native';

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
  const iconScale   = useSharedValue(1);
  const ringScale   = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const cardGlow    = useSharedValue(0);

  const prevInRadius = useRef<boolean | null>(null);

  useEffect(() => {
    const enteringValid = isWithinRadius === true && prevInRadius.current !== true;
    prevInRadius.current = isWithinRadius;

    if (!enteringValid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Icon bounce
    iconScale.value = withSequence(
      withSpring(1.25, { damping: 7,  stiffness: 220, reduceMotion: ReduceMotion.System }),
      withSpring(1,    { damping: 12, stiffness: 180, reduceMotion: ReduceMotion.System }),
    );

    // Halo ring pulse — finite 3x
    ringOpacity.value = 0.55;
    ringScale.value   = 1;
    ringOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
      PULSE_ITERATIONS,
      false,
    );
    ringScale.value = withRepeat(
      withTiming(3.2, { duration: 1500, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
      PULSE_ITERATIONS,
      false,
    );

    // Card glow sekali — fade in cepat, fade out 600ms
    cardGlow.value = withSequence(
      withTiming(1, { duration: 180, reduceMotion: ReduceMotion.System }),
      withTiming(0, { duration: 800, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
    );
  }, [isWithinRadius, iconScale, ringScale, ringOpacity, cardGlow]);

  useEffect(() => {
    return () => {
      cancelAnimation(iconScale);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      cancelAnimation(cardGlow);
    };
  }, [iconScale, ringScale, ringOpacity, cardGlow]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: cardGlow.value,
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
  const iconBg = isWithinRadius ? '#34C759' : '#FF9F0A';
  const textColor = isWithinRadius
    ? isDark ? '#86EFAC' : '#15803D'
    : isDark ? '#FCD34D' : '#C2410C';

  const IconEl = isWithinRadius ? Check : AlertCircle;

  return (
    <View style={{ marginHorizontal: 10, position: 'relative' }}>
      {/* Glow overlay — fade in/out saat masuk radius */}
      {isWithinRadius && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -3, left: -3, right: -3, bottom: -3,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: '#34C759',
              shadowColor: '#34C759',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 8,
            },
            glowStyle,
          ]}
        />
      )}

      <View
        style={{
          backgroundColor: bgColor,
          borderRadius: 14,
          borderWidth: 0.5,
          borderColor,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Icon + halo ring */}
        <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          {isWithinRadius && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: iconBg,
                },
                ringStyle,
              ]}
            />
          )}
          <Animated.View
            style={[
              {
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: iconBg,
                alignItems: 'center',
                justifyContent: 'center',
              },
              isWithinRadius ? iconStyle : undefined,
            ]}
          >
            <IconEl size={18} strokeWidth={2.8} color="#FFFFFF" />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: textColor, marginBottom: 1 }}>
            {isWithinRadius
              ? `${officeName} · Dalam radius`
              : `${distanceMeters}m dari ${officeName}`}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280' }}>
            {isWithinRadius
              ? `GPS aktif · ${accuracy ? `Akurasi ${Math.round(accuracy)}m · ` : ''}Siap check-in`
              : 'Di luar radius. Scan QR atau konfirmasi alasan.'}
          </Text>
        </View>
      </View>
    </View>
  );
}
