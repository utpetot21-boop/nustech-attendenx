import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { Users } from 'lucide-react-native';
import { C, R, B, S, cardBg, lPrimary, lSecondary, lTertiary, separator } from '@/constants/tokens';
import { SkeletonBone } from '@/components/ui/SkeletonLoader';
import type { TeamAttendanceRecord } from '@/services/attendance.service';

const SCREEN_W = Dimensions.get('window').width;
const SLIDE_W = SCREEN_W - 32; // padding horizontal beranda 16 each side
const AUTO_MS = 3500;

function formatCheckinTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' WITA';
}

function statusColor(status: TeamAttendanceRecord['status']): string {
  if (status === 'hadir') return C.green;
  if (status === 'terlambat') return C.orange;
  return C.cyan; // dinas
}

function InitialsAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // Warna deterministic dari nama
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 55%, 45%)`;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: '#FFFFFF' }}>
        {initials}
      </Text>
    </View>
  );
}

function Slide({ item, isDark }: { item: TeamAttendanceRecord; isDark: boolean }) {
  const dot = statusColor(item.status);
  const time = formatCheckinTime(item.check_in_at);
  const subText = [
    item.user.position?.name,
    item.user.department?.name,
  ].filter(Boolean).join(' · ') || null;

  return (
    <View style={{
      width: SLIDE_W,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    }}>
      {/* Avatar */}
      {item.user.avatar_url ? (
        <Image
          source={{ uri: item.user.avatar_url }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
          resizeMode="cover"
        />
      ) : (
        <InitialsAvatar name={item.user.full_name} size={48} />
      )}

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}
          numberOfLines={1}
        >
          {item.user.full_name}
        </Text>
        {subText ? (
          <Text
            style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 2 }}
            numberOfLines={1}
          >
            {subText}
          </Text>
        ) : null}
      </View>

      {/* Jam masuk + dot status */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: dot }}>
          {time}
        </Text>
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: dot,
          alignSelf: 'center',
        }} />
      </View>
    </View>
  );
}

function LoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      width: SLIDE_W,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    }}>
      <SkeletonBone width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBone width="60%" height={15} borderRadius={6} />
        <SkeletonBone width="80%" height={12} borderRadius={5} />
      </View>
      <SkeletonBone width={80} height={14} borderRadius={5} />
    </View>
  );
}

function EmptySlide({ isDark }: { isDark: boolean }) {
  return (
    <View style={{
      width: SLIDE_W,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: R.sm,
        backgroundColor: C.green + '18',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Users size={20} strokeWidth={1.8} color={C.green} />
      </View>
      <Text style={{ fontSize: 14, color: lSecondary(isDark) }}>
        Belum ada yang check-in hari ini
      </Text>
    </View>
  );
}

interface Props {
  records: TeamAttendanceRecord[] | undefined;
  isLoading: boolean;
  isDark: boolean;
}

export default function CheckedInCarousel({ records, isLoading, isDark }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<TeamAttendanceRecord>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = records?.length ?? 0;

  const startTimer = (currentIdx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % count;
        try {
          flatListRef.current?.scrollToIndex({ index: next, animated: true });
        } catch { /* ignore if list not ready */ }
        return next;
      });
    }, AUTO_MS);
  };

  useEffect(() => {
    setActiveIndex(0);
    startTimer(0);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [count]);

  const onMomentumScrollEnd = (e: any) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setActiveIndex(newIdx);
    startTimer(newIdx);
  };

  const borderColor = isDark ? C.separator.dark : C.separator.light;
  const cardBgColor = cardBg(isDark);

  return (
    <View style={{
      backgroundColor: cardBgColor,
      borderRadius: R.lg,
      borderWidth: B.default,
      borderColor,
      overflow: 'hidden',
      ...(isDark ? S.cardDark : S.card),
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 8,
        borderBottomWidth: count > 0 && !isLoading ? B.default : 0,
        borderBottomColor: borderColor,
      }}>
        <View style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: C.green,
          marginRight: 8,
        }} />
        <Text style={{
          flex: 1,
          fontSize: 13, fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: 0.8,
          color: lTertiary(isDark),
        }}>
          Hadir Hari Ini
        </Text>
        {!isLoading && count > 0 && (
          <View style={{
            backgroundColor: C.green + '20',
            borderRadius: R.pill,
            paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>
              {count} org
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton isDark={isDark} />
      ) : count === 0 ? (
        <EmptySlide isDark={isDark} />
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={records}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SLIDE_W}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => <Slide item={item} isDark={isDark} />}
            getItemLayout={(_, index) => ({
              length: SLIDE_W,
              offset: SLIDE_W * index,
              index,
            })}
            scrollEventThrottle={16}
          />

          {/* Pagination dots */}
          {count > 1 && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 5,
              paddingBottom: 10,
            }}>
              {Array.from({ length: Math.min(count, 7) }).map((_, i) => {
                const isActive = i === Math.min(activeIndex, 6);
                return (
                  <View
                    key={i}
                    style={{
                      width: isActive ? 14 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: isActive ? C.green : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)'),
                    }}
                  />
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}
