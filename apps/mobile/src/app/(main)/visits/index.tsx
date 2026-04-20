/**
 * M-05 — Riwayat Kunjungan Lapangan
 * List semua kunjungan dengan filter status.
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Navigation,
} from 'lucide-react-native';
import { visitsService, type VisitSummary } from '@/services/visits.service';
import { C, R, B, T, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { VisitCardSkeleton } from '@/components/ui/SkeletonLoader';

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  ongoing:     { label: 'Berlangsung',    color: C.blue   },
  completed:   { label: 'Selesai',        color: C.green  },
  on_hold:     { label: 'Ditahan',        color: C.orange },
  rescheduled: { label: 'Dijadwal Ulang', color: C.purple },
};

const FILTERS = [
  { label: 'Semua',       value: undefined     },
  { label: 'Berlangsung', value: 'ongoing'      },
  { label: 'Selesai',     value: 'completed'    },
  { label: 'Ditahan',     value: 'on_hold'      },
];

// ─────────────────────────────────────────────────────────────────────────────
// Visit Card
// ─────────────────────────────────────────────────────────────────────────────

function VisitCard({ visit, onPress }: { visit: VisitSummary; onPress: () => void }) {
  const isDark    = useColorScheme() === 'dark';
  const meta      = STATUS_META[visit.status] ?? STATUS_META.ongoing;
  const isOngoing = visit.status === 'ongoing';

  const checkInTime = new Date(visit.check_in_at).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.80}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isOngoing
          ? isDark ? 'rgba(0,122,255,0.35)' : 'rgba(0,122,255,0.22)'
          : isDark ? C.separator.dark : C.separator.light,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 10,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      {/* Row 1 — client + status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.3 }} numberOfLines={1}>
            {visit.client?.name ?? '—'}
          </Text>
          {visit.client?.pic_name && (
            <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
              PIC: {visit.client.pic_name}
            </Text>
          )}
        </View>
        <StatusBadge label={meta.label} color={meta.color} dot={isOngoing} />
      </View>

      {/* Row 2 — time + duration */}
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
          <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>{checkInTime} WITA</Text>
        </View>
        {(visit.duration_minutes ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Timer size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
              {Math.floor(visit.duration_minutes! / 60)}j {visit.duration_minutes! % 60}m
            </Text>
          </View>
        )}
      </View>

      {/* Row 3 — GPS + chevron */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {visit.gps_valid
            ? <CheckCircle2 size={12} strokeWidth={2} color={C.green} />
            : <AlertTriangle size={12} strokeWidth={2} color={C.orange} />
          }
          <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
            {visit.gps_valid ? 'GPS valid' : `Deviasi ${visit.gps_deviation_meter}m`}
          </Text>
        </View>
        <ChevronRight size={14} strokeWidth={2} color={lTertiary(isDark)} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function VisitsListScreen() {
  const isDark  = useColorScheme() === 'dark';
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['visits', statusFilter],
    queryFn:  () => visitsService.getMyVisits({ status: statusFilter }),
  });

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const ongoingVisit = data?.items.find((v) => v.status === 'ongoing');
  // Kunjungan berlangsung sudah ditampilkan sebagai banner biru di atas —
  // keluarkan dari daftar agar tidak dobel (hanya saat filter "Semua" atau "Berlangsung").
  const listItems = ongoingVisit
    ? (data?.items ?? []).filter((v) => v.id !== ongoingVisit.id)
    : (data?.items ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={C.blue} />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ ...T.title1, color: lPrimary(isDark) }}>
                Kunjungan
              </Text>
              <Text style={{ ...T.footnote, color: lSecondary(isDark), marginTop: 3 }}>
                {data?.total ?? 0} kunjungan tercatat
              </Text>
            </View>

            <View style={{
              width: 48, height: 48, borderRadius: R.md,
              backgroundColor: isDark ? 'rgba(0,122,255,0.15)' : '#EFF6FF',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={24} strokeWidth={1.8} color={C.blue} />
            </View>
          </View>
        </View>

        {/* Filter chips */}
        <FilterChips
          options={FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          isDark={isDark}
        />

        {/* Ongoing banner */}
        {ongoingVisit && (
          <TouchableOpacity
            onPress={() => router.push(`/(main)/visits/${ongoingVisit.id}` as Href)}
            activeOpacity={0.88}
            style={{
              marginHorizontal: 16, marginBottom: 12,
              backgroundColor: C.blue,
              borderRadius: R.lg, padding: 16,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              shadowColor: C.blue,
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 8,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: R.sm, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={22} strokeWidth={2} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Kunjungan Berlangsung</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
                {ongoingVisit.client?.name} · Ketuk untuk lanjutkan
              </Text>
            </View>
            <ChevronRight size={18} strokeWidth={2.5} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}

        {/* List */}
        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <VisitCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : listItems.length === 0 ? (
          ongoingVisit ? null : (
            <EmptyState
              icon={MapPin}
              iconColor={C.blue}
              title="Belum ada kunjungan"
              message="Kunjungan lapangan akan muncul di sini setelah check-in dimulai dari halaman Pekerjaan."
            />
          )
        ) : (
          listItems.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onPress={() => router.push(`/(main)/visits/${visit.id}` as Href)}
            />
          ))
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>
    </View>
  );
}
