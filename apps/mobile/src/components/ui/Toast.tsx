'use client';
import { useEffect, useRef } from 'react';
import { Animated, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, AlertCircle, Info, type LucideIcon } from 'lucide-react-native';
import { C, R, B, lPrimary } from '@/constants/tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

const CONFIG: Record<ToastType, { color: string; Icon: LucideIcon }> = {
  success: { color: C.green,  Icon: CheckCircle2 },
  error:   { color: C.red,    Icon: XCircle },
  warning: { color: C.orange, Icon: AlertCircle },
  info:    { color: C.blue,   Icon: Info },
};

export function Toast({ visible, message, type = 'info', onHide, duration = 3000 }: ToastProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, duration);
    } else {
      translateY.setValue(-100);
      opacity.setValue(0);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, message]);

  if (!visible) return null;

  const { color, Icon } = CONFIG[type];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: color + (isDark ? '26' : '14'),
          borderRadius: R.lg,
          borderWidth: B.default,
          borderColor: color + '40',
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Icon size={20} strokeWidth={2} color={color} />
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: '500',
            color: lPrimary(isDark),
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
