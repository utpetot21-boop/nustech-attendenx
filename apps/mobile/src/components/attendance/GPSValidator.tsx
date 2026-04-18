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

const BURST_RIPPLES = 3; // ~4.5 detik lalu berhenti

export function GPSValidator({
  isLoading,
  isWithinRadius,
  distanceMeters,
  officeName = 'Kantor',
  accuracy,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Shared values (UI thread)
  const iconScale   = useSharedValue(1);
  const idlePulse   = useSharedValue(1); // denyut halus kontinu
  const ring1Scale  = useSharedValue(1);
  const ring1Op     = useSharedValue(0);
  const ring2Scale  = useSharedValue(1);
  const ring2Op     = useSharedValue(0);
  const cardGlow    = useSharedValue(0);
  const badgeOp     = useSharedValue(0); // "TERVERIFIKASI" badge fade

  const prevInRadius  = useRef<boolean | null>(null);
  const idleStartedRef = useRef(false);

  // Idle pulse — hidup selama dalam radius, stop saat keluar
  useEffect(() => {
    if (isWithinRadius === true && !idleStartedRef.current) {
      idleStartedRef.current = true;
      idlePulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
          withTiming(1,    { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        ),
        -1,
        false,
      );
      badgeOp.value = withTiming(1, { duration: 400, reduceMotion: ReduceMotion.System });
    } else if (isWithinRadius !== true && idleStartedRef.current) {
      idleStartedRef.current = false;
      cancelAnimation(idlePulse);
      idlePulse.value = withTiming(1, { duration: 200 });
      badgeOp.value = withTiming(0, { duration: 200 });
    }
  }, [isWithinRadius, idlePulse, badgeOp]);

  // Burst satu-kali saat transisi masuk radius
  useEffect(() => {
    const enteringValid = isWithinRadius === true && prevInRadius.current !== true;
    prevInRadius.current = isWithinRadius;

    if (!enteringValid) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Icon burst besar
    iconScale.value = withSequence(
      withSpring(1.45, { damping: 6,  stiffness: 180, reduceMotion: ReduceMotion.System }),
      withSpring(1,    { damping: 10, stiffness: 150, reduceMotion: ReduceMotion.System }),
    );

    // Double ripple — ring 1 + ring 2 (delay)
    ring1Op.value = 0.7;
    ring1Scale.value = 1;
    ring1Op.value    = withRepeat(withTiming(0,   { duration: 1400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), BURST_RIPPLES, false);
    ring1Scale.value = withRepeat(withTiming(3.8, { duration: 1400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), BURST_RIPPLES, false);

    ring2Op.value    = withDelay(350, withTiming(0.5, { duration: 0 }));
    ring2Scale.value = withDelay(350, withTiming(1,   { duration: 0 }));
    ring2Op.value    = withDelay(350, withRepeat(withTiming(0,   { duration: 1400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), BURST_RIPPLES, false));
    ring2Scale.value = withDelay(350, withRepeat(withTiming(3.8, { duration: 1400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), BURST_RIPPLES, false));

    // Card glow panjang & terang
    cardGlow.value = withSequence(
      withTiming(1, { duration: 220, reduceMotion: ReduceMotion.System }),
      withDelay(500, withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System })),
    );
  }, [isWithinRadius, iconScale, ring1Scale, ring1Op, ring2Scale, ring2Op, cardGlow]);

  useEffect(() => {
    return () => {
      cancelAnimation(iconScale);
      cancelAnimation(idlePulse);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Op);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Op);
      cancelAnimation(cardGlow);
      cancelAnimation(badgeOp);
    };
  }, [iconScale, idlePulse, ring1Scale, ring1Op, ring2Scale, ring2Op, cardGlow, badgeOp]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value * idlePulse.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Op.value,
    transform: [{ scale: ring1Scale.value }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Op.value,
    transform: [{ scale: ring2Scale.value }],
  }));
  const glowStyle  = useAnimatedStyle(() => ({ opacity: cardGlow.value }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOp.value }));

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
      {/* Glow overlay */}
      {isWithinRadius && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -4, left: -4, right: -4, bottom: -4,
              borderRadius: 18,
              borderWidth: 2.5,
              borderColor: '#34C759',
              shadowColor: '#34C759',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9,
              shadowRadius: 16,
              elevation: 10,
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
        {/* Icon + double ripple ring */}
        <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          {isWithinRadius && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: iconBg },
                  ring1Style,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: iconBg },
                  ring2Style,
                ]}
              />
            </>
          )}
          <Animated.View
            style={[
              {
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: iconBg,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: iconBg,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: isWithinRadius ? 0.5 : 0,
                shadowRadius: 6,
                elevation: isWithinRadius ? 4 : 0,
              },
              iconStyle,
            ]}
          >
            <IconEl size={20} strokeWidth={2.8} color="#FFFFFF" />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: textColor, flexShrink: 1 }}>
              {isWithinRadius
                ? `${officeName} · Dalam radius`
                : `${distanceMeters}m dari ${officeName}`}
            </Text>
            {isWithinRadius && (
              <Animated.View
                style={[
                  {
                    backgroundColor: '#34C759',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                  },
                  badgeStyle,
                ]}
              >
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 }}>
                  AKTIF
                </Text>
              </Animated.View>
            )}
          </View>
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
