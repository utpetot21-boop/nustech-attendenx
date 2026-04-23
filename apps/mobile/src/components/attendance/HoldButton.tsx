/**
 * HoldButton — tombol lingkaran hold-press dengan SVG fingerprint + progress arc.
 * Tekan & tahan selama `holdDuration` ms → onComplete() dipanggil.
 * Lepas sebelum penuh → dibatalkan.
 */
import { useRef, useCallback } from 'react';
import { Animated, View, Text, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  onComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
  holdDuration?: number;
  isDark?: boolean;
}

const STROKE = 6;
const DEFAULT_SIZE = 148;

export function HoldButton({
  onComplete,
  disabled = false,
  loading = false,
  label,
  sublabel,
  color = '#007AFF',
  size = DEFAULT_SIZE,
  holdDuration = 2000,
  isDark = false,
}: Props) {
  const progress    = useRef(new Animated.Value(0)).current;
  const scale       = useRef(new Animated.Value(1)).current;
  const anim        = useRef<Animated.CompositeAnimation | null>(null);
  const hapticRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef    = useRef(false);

  const radius  = (size - STROKE * 2) / 2;
  const cx      = size / 2;
  const cy      = size / 2;
  const circum  = 2 * Math.PI * radius;

  const strokeDashoffset = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [circum, 0],
  });

  const startHold = useCallback(() => {
    if (disabled || loading) return;
    firedRef.current = false;

    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 10 }).start();

    hapticRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 120);

    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: holdDuration,
      useNativeDriver: false,
    });

    anim.current.start(({ finished }) => {
      if (hapticRef.current) clearInterval(hapticRef.current);
      if (finished && !firedRef.current) {
        firedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
      }
      Animated.spring(scale,  { toValue: 1, useNativeDriver: true }).start();
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    });
  }, [disabled, loading, holdDuration, onComplete, progress, scale]);

  const cancelHold = useCallback(() => {
    if (hapticRef.current) clearInterval(hapticRef.current);
    anim.current?.stop();
    Animated.spring(scale,   { toValue: 1, useNativeDriver: true }).start();
    Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
  }, [progress, scale]);

  const fillColor   = disabled ? (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB') : `${color}18`;
  const iconColor   = disabled ? (isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF') : color;
  const labelColor  = disabled ? (isDark ? 'rgba(255,255,255,0.30)' : '#9CA3AF') : (isDark ? '#FFFFFF' : '#1C1C1E');

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          disabled={disabled || loading}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Background circle */}
          <View style={{
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            backgroundColor: fillColor,
          }} />

          {/* SVG progress arc */}
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            {/* Track */}
            <Circle
              cx={cx} cy={cy} r={radius}
              stroke={disabled ? 'transparent' : `${color}22`}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Progress */}
            <AnimatedCircle
              cx={cx} cy={cy} r={radius}
              stroke={color}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={circum}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${cx}, ${cy}`}
            />
          </Svg>

          {/* Fingerprint SVG icon atau loading */}
          {loading ? (
            <ActivityIndicator color={color} size="large" />
          ) : (
            <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
              {/* Fingerprint paths — hand-crafted concentric arcs */}
              {/* Center dot */}
              <Path d="M28 26 C28 24.9 28.9 24 30 24 C31.1 24 32 24.9 32 26 C32 28.5 30.5 30.8 28 32" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Ring 1 */}
              <Path d="M22 26 C22 22.7 24.7 20 28 20 C31.3 20 34 22.7 34 26 C34 30.5 31.5 34.5 28 37" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Ring 2 */}
              <Path d="M17 26 C17 20 21.9 15 28 15 C34.1 15 39 20 39 26 C39 32 36 37.5 31 41" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Ring 3 */}
              <Path d="M12.5 27 C12.5 17.3 19.4 9.5 28 9.5 C36.6 9.5 43.5 17.3 43.5 27 C43.5 33 41 38.5 37 42.5" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Ring 4 outer */}
              <Path d="M8 27.5 C8 14.8 16.8 5 28 5 C39.2 5 48 14.8 48 27.5 C48 35.5 44.5 42.5 39 47" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              {/* Left entry */}
              <Path d="M19 21 C20.5 18.5 24 17 28 17" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </Svg>
          )}
        </Pressable>
      </Animated.View>

      {/* Labels */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: labelColor, letterSpacing: -0.3 }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280', textAlign: 'center' }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
