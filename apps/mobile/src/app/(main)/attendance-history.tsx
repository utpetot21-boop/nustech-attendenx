/**
 * Riwayat Absensi — daftar catatan check-in/out karyawan.
 * Filter bulan. iOS 26 Liquid Glass.
 */
import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  useColorScheme,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock,
  LogIn,
  LogOut,
  AlarmClock,
  Hourglass,
  FileX,
} from 'lucide-react-native';
import { C, R, B, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState } from '@/components/ui/EmptyState';
import { attendanceService, AttendanceRecord } from '@/services/attendance.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  alfa: 'Alfa',
  izin: 'Izin',
  sakit: 'Sakit',
  dinas: 'Dinas',
};

const STATUS_COLOR: Record<string, string> = {
  hadir: C.green,
  terlambat: C.orange,
  alfa: C.red,
  izin: C.purple,
  sakit: C.teal,
  dinas: C.indigo,
};

const METHOD_LABEL: Record<string, string> = {
  face_id: 'Face ID',
  fingerprint: 'Fingerprint',
  pin: 'PIN',
  qr: 'QR',
  manual: 'Manual',
  gps: 'GPS',
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtDayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('id-ID', { weekday: 'long' }),
    date: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function getMonthOptions(count = 6) {
  const now = new Date();
  const opts: { label: string; value: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ label, value });
  }
  return opts;
}

// ── Record Card ──────────────────────────────────────────────────────────────

function RecordCard({ rec, isDark }: { rec: AttendanceRecord; isDark: boolean }) {
  const { weekday, date } = fmtDayDate(rec.date);
  const statusColor = STATUS_COLOR[rec.status] ?? C.orange;
  const statusLabel = STATUS_LABEL[rec.status] ?? rec.status;

  return (
    <View
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
        padding: 14,
        marginBottom: 10,
      }}
    >
      {/* Header: date + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>
            {weekday}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>
            {date}
          </Text>
        </View>
        <StatusBadge label={statusLabel} color={statusColor} />
      </View>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.08)',
          marginBottom: 10,
        }}
      />

      {/* Check-in / Check-out row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: R.xs, backgroundColor: C.green + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <LogIn size={14} strokeWidth={2} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: lTertiary(isDark), fontWeight: '600' }}>Masuk</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>
              {fmtTime(rec.check_in_at)}
            </Text>
            {rec.check_in_method && (
              <Text style={{ fontSize: 10, color: lTertiary(isDark), marginTop: 1 }}>
                {METHOD_LABEL[rec.check_in_method] ?? rec.check_in_method}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: R.xs, backgroundColor: C.blue + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={14} strokeWidth={2} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: lTertiary(isDark), fontWeight: '600' }}>Pulang</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>
              {fmtTime(rec.check_out_at)}
            </Text>
            {rec.check_out_method && (
              <Text style={{ fontSize: 10, color: lTertiary(isDark), marginTop: 1 }}>
                {METHOD_LABEL[rec.check_out_method] ?? rec.check_out_method}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Metrics row — only when relevant */}
      {(rec.late_minutes > 0 || rec.overtime_minutes > 0 || rec.shift_start) && (
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.06)',
            flexWrap: 'wrap',
          }}
        >
          {rec.shift_start && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={11} strokeWidth={2} color={lTertiary(isDark)} />
              <Text style={{ fontSize: 11, color: lSecondary(isDark) }}>
                Jadwal {rec.shift_start}–{rec.shift_end ?? '—'}
              </Text>
            </View>
          )}
          {rec.late_minutes > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AlarmClock size={11} strokeWidth={2} color={C.orange} />
              <Text style={{ fontSize: 11, color: C.orange, fontWeight: '700' }}>
                Terlambat {rec.late_minutes}m
              </Text>
            </View>
          )}
          {rec.overtime_minutes > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Hourglass size={11} strokeWidth={2} color={C.indigo} />
              <Text style={{ fontSize: 11, color: C.indigo, fontWeight: '700' }}>
                Lembur {rec.overtime_minutes}m
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function AttendanceHistoryScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const monthOptions = useMemo(() => getMonthOptions(6), []);
  const [month, setMonth] = useState<string | undefined>(monthOptions[0]?.value);

  const { data, isLoading, isRefetching, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history', month],
    queryFn: () => attendanceService.getHistory(month ? { month } : {}),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const records = data ?? [];
  const stats = useMemo(() => {
    const total = records.length;
    const hadir = records.filter((r) => r.status === 'hadir').length;
    const terlambat = records.filter((r) => r.status === 'terlambat').length;
    const alfa = records.filter((r) => r.status === 'alfa').length;
    return { total, hadir, terlambat, alfa };
  }, [records]);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <BackHeader
        title="Riwayat Absensi"
        subtitle={month ? `${stats.total} catatan bulan ini` : `${stats.total} catatan`}
        accentColor={C.blue}
      />

      {/* Month filter */}
      <FilterChips
        options={[
          { label: 'Semua', value: undefined as any },
          ...monthOptions.map((o) => ({ label: o.label, value: o.value })),
        ]}
        value={month}
        onChange={(v) => setMonth(v)}
        accentColor={C.blue}
        isDark={isDark}
      />

      {/* Stats summary */}
      {records.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
          {[
            { label: 'Hadir', value: stats.hadir, color: C.green },
            { label: 'Terlambat', value: stats.terlambat, color: C.orange },
            { label: 'Alfa', value: stats.alfa, color: C.red },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: cardBg(isDark),
                borderRadius: R.md,
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                padding: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '800', color: s.color, letterSpacing: -0.5 }}>
                {s.value}
              </Text>
              <Text style={{ fontSize: 11, color: lSecondary(isDark), marginTop: 2, fontWeight: '600' }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={C.blue} style={{ marginTop: 48 }} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={FileX}
            iconColor={C.blue}
            title="Belum ada riwayat"
            message={month ? 'Tidak ada catatan absensi di bulan ini.' : 'Catatan absensi akan muncul setelah kamu check-in.'}
          />
        ) : (
          records.map((rec) => <RecordCard key={rec.id} rec={rec} isDark={isDark} />)
        )}
      </ScrollView>
    </View>
  );
}
