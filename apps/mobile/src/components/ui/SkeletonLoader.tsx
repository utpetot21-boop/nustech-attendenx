/**
 * SkeletonLoader — animated shimmer placeholder.
 * Gunakan sebagai bones di dalam skeleton layout tiap screen.
 */
import { useEffect, useRef } from 'react';
import { Animated, View, useColorScheme } from 'react-native';
import { R } from '@/constants/tokens';

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
};

/** Satu "tulang" skeleton dengan pulse animation */
export function SkeletonBone({ width = '100%', height = 16, borderRadius = R.sm, style }: BoneProps) {
  const isDark = useColorScheme() === 'dark';
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
          opacity,
        },
        style,
      ]}
    />
  );
}

// ── TaskCard skeleton ─────────────────────────────────────────────────────────

export function TaskCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderRadius: 20, borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0',
      padding: 18, marginHorizontal: 20, marginBottom: 12, gap: 12,
    }}>
      {/* Title row */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <SkeletonBone width="65%" height={18} borderRadius={6} />
        <SkeletonBone width={60} height={24} borderRadius={10} />
      </View>
      {/* Client */}
      <SkeletonBone width="50%" height={14} borderRadius={5} />
      {/* Status + date */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonBone width={90} height={14} borderRadius={5} />
        <SkeletonBone width={80} height={14} borderRadius={5} />
      </View>
    </View>
  );
}

// ── VisitCard skeleton ────────────────────────────────────────────────────────

export function VisitCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderRadius: 16, borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0',
      padding: 16, marginHorizontal: 16, marginBottom: 10, gap: 10,
    }}>
      {/* Client name + badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkeletonBone width="55%" height={16} borderRadius={5} />
        <SkeletonBone width={70} height={22} borderRadius={12} />
      </View>
      {/* Time */}
      <SkeletonBone width="45%" height={13} borderRadius={4} />
      {/* GPS row */}
      <SkeletonBone width="30%" height={12} borderRadius={4} />
    </View>
  );
}

// ── HomeHero skeleton ─────────────────────────────────────────────────────────

export function HomeHeroSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      marginHorizontal: 20, borderRadius: 24, borderWidth: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0',
      padding: 20, gap: 14,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonBone width={120} height={22} borderRadius={6} />
        <SkeletonBone width={70} height={22} borderRadius={12} />
      </View>
      <View style={{ gap: 8 }}>
        <SkeletonBone width="80%" height={32} borderRadius={6} />
        <SkeletonBone width="60%" height={14} borderRadius={4} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SkeletonBone width="48%" height={52} borderRadius={14} />
        <SkeletonBone width="48%" height={52} borderRadius={14} />
      </View>
    </View>
  );
}
