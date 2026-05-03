import { useCallback, useMemo, useRef, useState as useLocalState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  Siren,
  CheckCircle2,
  Building2,
  MapPin,
  Fingerprint,
  ClipboardList,
  Wallet,
  Clock,
  ChevronRight,
  Calendar,
  Sun,
  Coffee,
  Palmtree,
  ArrowLeftRight,
  AlarmClock,
  LogOut,
  Hourglass,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';
import WeatherBanner, { getPeriodLabel } from '@/components/home/WeatherBanner';

import { attendanceService, type AttendanceRecord, type TeamAttendanceRecord } from '@/services/attendance.service';
import CheckedInCarousel from '@/components/home/CheckedInCarousel';
import { scheduleService, getCurrentWeekString } from '@/services/schedule.service';
import { attendanceRequestsService, type AttendanceRequest } from '@/services/attendance-requests.service';
import { leaveService, type LeaveBalance } from '@/services/leave.service';
import { api } from '@/services/api';
import { useMutation } from '@tanstack/react-query';
import { currentMonth } from '@/utils/dateFormatter';
import { useCheckoutTimer } from '@/hooks/useCheckoutTimer';
import { useTabBar } from '@/context/TabBarContext';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';

const MONTH_NOW = currentMonth();
const APPROVER_ROLES = ['admin', 'manager', 'super_admin'] as const;
const APPROVER_POSITIONS = ['DIREKTUR', 'DIREKTUR UTAMA'] as const;

const STATUS_SUMMARY = [
  { key: 'hadir',     label: 'Hadir',     color: C.green },
  { key: 'terlambat', label: 'Terlambat', color: C.orange },
  { key: 'alfa',      label: 'Alfa',      color: C.red },
  { key: 'izin',      label: 'Izin',      color: C.blue },
  { key: 'sakit',     label: 'Sakit',     color: C.purple },
  { key: 'dinas',     label: 'Dinas',     color: C.cyan },
] as const;
import { HomeHeroSkeleton } from '@/components/ui/SkeletonLoader';

// ── Status theme ─────────────────────────────────────────────────────────────
function getStatusTheme(checkedIn: boolean, checkedOut: boolean, status?: string) {
  if (checkedOut) return {
    dot: C.green, label: 'Selesai', color: C.green,
    bg: (d: boolean) => d ? 'rgba(52,199,89,0.12)' : '#F0FDF4',
    border: (d: boolean) => d ? 'rgba(52,199,89,0.22)' : 'rgba(52,199,89,0.28)',
  };
  if (checkedIn) {
    const isLate = status === 'terlambat';
    return {
      dot: isLate ? C.orange : C.blue,
      label: isLate ? 'Terlambat' : 'Hadir',
      color: isLate ? C.orange : C.blue,
      bg: (d: boolean) => d ? 'rgba(0,122,255,0.12)' : '#EFF6FF',
      border: (d: boolean) => d ? 'rgba(0,122,255,0.22)' : 'rgba(0,122,255,0.28)',
    };
  }
  return {
    dot: C.orange, label: 'Belum Hadir', color: C.orange,
    bg: (d: boolean) => d ? 'rgba(255,149,0,0.12)' : '#FFF7ED',
    border: (d: boolean) => d ? 'rgba(255,149,0,0.22)' : 'rgba(255,149,0,0.25)',
  };
}

// ── SOS Button ───────────────────────────────────────────────────────────────
function SosButton({ isDark }: { isDark: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useLocalState(false);
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);

  const onPressIn = () => {
    setHolding(true);
    holdAnim.current = Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false });
    holdAnim.current.start(({ finished }) => {
      if (finished) { setHolding(false); router.push('/(main)/sos'); progress.setValue(0); }
    });
  };
  const onPressOut = () => {
    holdAnim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    setHolding(false);
  };
  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <TouchableOpacity
      onPressIn={onPressIn} onPressOut={onPressOut}
      activeOpacity={0.92}
      style={{
        borderRadius: R.lg, overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,59,48,0.10)' : '#FFF1F0',
        borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.18)',
        padding: 18,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }}
    >
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: fillWidth, backgroundColor: 'rgba(255,59,48,0.08)',
      }} />
      <View style={{
        width: 46, height: 46, borderRadius: R.sm,
        backgroundColor: isDark ? 'rgba(255,59,48,0.18)' : 'rgba(255,59,48,0.10)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Siren size={22} strokeWidth={1.8} color={C.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.red, marginBottom: 2 }}>
          {holding ? 'Lepaskan untuk batalkan…' : 'Tombol Darurat / SOS'}
        </Text>
        <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
          {holding ? 'Sedang mengaktifkan SOS' : 'Tahan 3 detik untuk aktifkan'}
        </Text>
      </View>
      <ChevronRight size={15} strokeWidth={2} color={lTertiary(isDark)} />
    </TouchableOpacity>
  );
}

// ── Stat Card (bento 2-col) ───────────────────────────────────────────────────
function StatCard({
  label, value, sub, accentColor,
  icon: Icon, onPress,
  isDark,
}: {
  label: string; value: string; sub: string;
  accentColor: string;
  icon: LucideIcon;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        flex: 1,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg, borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        padding: 16,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: R.sm - 2,
        backgroundColor: accentColor + '18',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}>
        <Icon size={17} strokeWidth={1.8} color={accentColor} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: lTertiary(isDark), marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: accentColor, letterSpacing: -1, lineHeight: 32, marginBottom: 2 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: lSecondary(isDark) }}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Row Nav Card ──────────────────────────────────────────────────────────────
function NavCard({
  label, sub, accentColor,
  icon: Icon, onPress, isDark, badge,
}: {
  label: string; sub: string; accentColor: string;
  icon: LucideIcon;
  onPress: () => void; isDark: boolean; badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg, borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{
        width: 42, height: 42, borderRadius: R.sm,
        backgroundColor: accentColor + '16',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} strokeWidth={1.8} color={accentColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 1 }}>{sub}</Text>
      </View>
      {badge !== undefined && badge > 0 ? (
        <View style={{
          backgroundColor: C.red, borderRadius: 10,
          paddingHorizontal: 7, paddingVertical: 3,
          minWidth: 22, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : (
        <View style={{
          width: 28, height: 28, borderRadius: R.sm - 2,
          backgroundColor: accentColor + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronRight size={14} strokeWidth={2.2} color={accentColor} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Attendance Request Card ───────────────────────────────────────────────────
function AttendanceRequestCard({
  type, request, deadlinePassed, onSubmit, isDark,
}: {
  type: 'late_arrival' | 'early_departure';
  request: AttendanceRequest | null;
  deadlinePassed?: boolean;
  onSubmit: () => void;
  isDark: boolean;
}) {
  const isLate      = type === 'late_arrival';
  const accentColor = isLate ? C.orange : C.purple;
  const label       = isLate ? 'Izin Terlambat' : 'Izin Pulang Awal';
  const sublabel    = isLate
    ? 'Ajukan sebelum 15 menit jam shift'
    : 'Ajukan izin pulang sebelum shift selesai';

  // Status aktif — tampilkan badge
  if (request && request.status !== 'cancelled') {
    const cfg =
      request.status === 'approved' ? { color: C.green,  icon: CheckCircle2, text: 'Disetujui' } :
      request.status === 'rejected' ? { color: C.red,    icon: XCircle,      text: 'Ditolak'   } :
                                      { color: C.orange, icon: Hourglass,    text: 'Menunggu persetujuan' };
    return (
      <View style={{
        backgroundColor: cardBg(isDark), borderRadius: R.lg,
        borderWidth: B.default, borderColor: isDark ? C.separator.dark : C.separator.light,
        padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
        ...(isDark ? S.cardDark : S.card),
      }}>
        <View style={{ width: 42, height: 42, borderRadius: R.sm, backgroundColor: accentColor + '16', alignItems: 'center', justifyContent: 'center' }}>
          {isLate ? <AlarmClock size={20} strokeWidth={1.8} color={accentColor} /> : <LogOut size={20} strokeWidth={1.8} color={accentColor} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <cfg.icon size={12} strokeWidth={2.2} color={cfg.color} />
            <Text style={{ fontSize: 12, color: cfg.color, fontWeight: '600' }}>{cfg.text}</Text>
          </View>
          {request.status === 'rejected' && request.reviewer_note && (
            <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 2 }} numberOfLines={1}>
              {request.reviewer_note}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Belum ada request — tombol ajukan
  const disabled = isLate && !!deadlinePassed;
  return (
    <TouchableOpacity
      onPress={onSubmit}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        backgroundColor: cardBg(isDark), borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: disabled
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
          : (isDark ? `${accentColor}30` : `${accentColor}28`),
        padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
        opacity: disabled ? 0.55 : 1,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{ width: 42, height: 42, borderRadius: R.sm, backgroundColor: accentColor + '16', alignItems: 'center', justifyContent: 'center' }}>
        {isLate ? <AlarmClock size={20} strokeWidth={1.8} color={accentColor} /> : <LogOut size={20} strokeWidth={1.8} color={accentColor} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: disabled ? lTertiary(isDark) : lPrimary(isDark), letterSpacing: -0.2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 1 }}>
          {disabled ? 'Batas pengajuan telah lewat' : sublabel}
        </Text>
      </View>
      <View style={{ width: 28, height: 28, borderRadius: R.sm - 2, backgroundColor: accentColor + '12', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight size={14} strokeWidth={2.2} color={disabled ? lTertiary(isDark) : accentColor} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BerandaScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { onScroll } = useTabBar();

  const storeUser = useAuthStore((s) => s.user);
  const isApprover = !!storeUser?.role?.can_approve
    || APPROVER_ROLES.includes((storeUser?.role?.name?.toLowerCase() ?? '') as typeof APPROVER_ROLES[number])
    || APPROVER_POSITIONS.includes((storeUser?.position?.name?.toUpperCase() ?? '') as typeof APPROVER_POSITIONS[number]);

  const { data: user } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const raw = await SecureStore.getItemAsync('user');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    staleTime: Infinity,
  });

  const { data: attendance, isLoading: loadingAtt } = useQuery<AttendanceRecord | null>({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceService.getToday(),
    refetchInterval: 60_000,
  });

  const { data: checkoutInfo } = useQuery({
    queryKey: ['checkout-info'],
    queryFn: () => attendanceService.getCheckoutInfo(),
    enabled: !!attendance?.check_in_at && !attendance?.check_out_at,
    refetchInterval: 10_000,
  });

  const { data: monthHistory = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance-history', MONTH_NOW],
    queryFn: () => attendanceService.getHistory({ month: MONTH_NOW }),
    staleTime: 5 * 60_000,
  });

  const { data: leaveBalance } = useQuery<LeaveBalance>({
    queryKey: ['leave-balance', 'me'],
    queryFn: () => leaveService.getMyBalance(),
    staleTime: 5 * 60_000,
  });

  const attendanceSummary = STATUS_SUMMARY.map(s => ({
    ...s,
    count: monthHistory.filter(r => r.status === s.key).length,
  }));

  // Total jam kerja real dari check_in_at → check_out_at
  const totalWorkMinutes = monthHistory.reduce((sum, r) => {
    if (!r.check_in_at || !r.check_out_at) return sum;
    const diff = new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime();
    return sum + Math.max(0, Math.floor(diff / 60000));
  }, 0);
  const totalWorkHours = Math.floor(totalWorkMinutes / 60);
  const totalWorkMins  = totalWorkMinutes % 60;

  // Gunakan WITA agar cocok dengan tanggal yang dipakai backend
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  const { data: todaySchedules = [] } = useQuery({
    queryKey: ['schedule-today', todayDate],
    queryFn: () => scheduleService.getMySchedule({ week: getCurrentWeekString() }),
    staleTime: 5 * 60_000,
  });
  const todaySchedule = todaySchedules.find((s) => s.date === todayDate) ?? null;

  const timer = useCheckoutTimer(
    checkoutInfo?.checkoutEarliest ?? attendance?.checkout_earliest ?? null,
    checkoutInfo?.checkedOut ?? !!attendance?.check_out_at,
  );

  // ── Attendance requests (izin terlambat / pulang awal) ────────
  const { data: todayRequests = [], refetch: refetchRequests } = useQuery<AttendanceRequest[]>({
    queryKey: ['attendance-requests-today'],
    queryFn: () => attendanceRequestsService.getMyToday(),
    refetchInterval: 30_000,
  });

  const { data: pendingAttReqCount = 0 } = useQuery<number>({
    queryKey: ['pending-att-req-count'],
    queryFn: () => attendanceRequestsService.adminPendingCount(),
    enabled: isApprover,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pendingLeaveCount = 0 } = useQuery<number>({
    queryKey: ['pending-leave-count'],
    queryFn: () =>
      api.get('/leave/requests', { params: { status: 'pending', page: 1, limit: 1 } })
        .then((r) => (r.data.total ?? 0) as number),
    enabled: isApprover,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: pendingExpenseCount = 0 } = useQuery<number>({
    queryKey: ['pending-expense-count'],
    queryFn: () =>
      api.get('/expense-claims', { params: { status: 'pending' } })
        .then((r) => (Array.isArray(r.data) ? r.data.length : 0) as number),
    enabled: isApprover,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: teamToday, isLoading: loadingTeam } = useQuery<TeamAttendanceRecord[]>({
    queryKey: ['team-attendance-today', todayDate],
    queryFn: () => attendanceService.getTeamToday(todayDate),
    enabled: isApprover,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const lateArrivalRequest    = todayRequests.find(r => r.type === 'late_arrival')    ?? null;
  const earlyDepartureRequest = todayRequests.find(r => r.type === 'early_departure') ?? null;

  const [showRequestModal, setShowRequestModal]   = useLocalState(false);
  const [requestModalType, setRequestModalType]   = useLocalState<'late_arrival' | 'early_departure'>('late_arrival');
  const [requestReason, setRequestReason]         = useLocalState('');
  const [requestEstTime, setRequestEstTime]       = useLocalState('');

  const submitRequestMutation = useMutation({
    mutationFn: () => attendanceRequestsService.submit({
      type: requestModalType,
      reason: requestReason.trim(),
      estimated_time: requestEstTime.trim() || undefined,
    }),
    onSuccess: () => {
      setShowRequestModal(false);
      setRequestReason('');
      setRequestEstTime('');
      refetchRequests();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Gagal mengajukan permohonan';
      alert(typeof msg === 'string' ? msg : 'Gagal mengajukan permohonan');
    },
  });

  // Hitung window visibility untuk kedua card
  const { showLateCard, lateDeadlinePassed, showEarlyCard } = useMemo(() => {
    const alreadyIn  = !!attendance?.check_in_at;
    const alreadyOut = !!attendance?.check_out_at;
    const start = todaySchedule?.start_time ?? null;
    const end   = todaySchedule?.end_time   ?? null;
    const now   = Date.now();

    let showLate = false, deadlinePassed = false;
    if (start && !alreadyIn) {
      const [sh, sm] = start.split(':').map(Number);
      const shiftMs  = new Date().setHours(sh, sm, 0, 0);
      showLate      = now >= shiftMs - 6 * 60 * 60 * 1000;
      deadlinePassed = now >= shiftMs - 15 * 60 * 1000;
    }
    // Tampilkan juga jika sudah ada request (agar status badge terlihat)
    if (!showLate && lateArrivalRequest && !alreadyIn) showLate = true;

    let showEarly = false;
    if (alreadyIn && !alreadyOut) {
      if (earlyDepartureRequest) {
        // Sudah ada request — selalu tampilkan agar status bisa dilihat
        showEarly = true;
      } else if (end) {
        const [eh, em] = end.split(':').map(Number);
        const shiftEnd = new Date().setHours(eh, em, 0, 0);
        showEarly = now < shiftEnd;
      } else {
        // Tidak ada jadwal tersimpan tapi user sudah check-in → tetap tampilkan
        showEarly = true;
      }
    }

    return { showLateCard: showLate, lateDeadlinePassed: deadlinePassed, showEarlyCard: showEarly };
  }, [todaySchedule, attendance, lateArrivalRequest, earlyDepartureRequest]);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['attendance-today'] });
    qc.invalidateQueries({ queryKey: ['checkout-info'] });
    qc.invalidateQueries({ queryKey: ['attendance-history', MONTH_NOW] });
    refetchRequests();
  }, [qc, refetchRequests]);

  const greeting = getPeriodLabel;

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Asia/Makassar',
  });

  const alreadyCheckedIn  = !!attendance?.check_in_at;
  const alreadyCheckedOut = !!attendance?.check_out_at;

  const formatTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
    : null;

  const shiftProgress = (() => {
    if (!attendance?.shift_start || !attendance?.shift_end || !alreadyCheckedIn) return 0;
    const now = new Date();
    const sParts = attendance.shift_start.split(':').map(Number);
    const eParts = attendance.shift_end.split(':').map(Number);
    const sh = sParts[0] ?? 0, sm = sParts[1] ?? 0;
    const eh = eParts[0] ?? 0, em = eParts[1] ?? 0;
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 0;
    const start = new Date(); start.setHours(sh, sm, 0, 0);
    const end   = new Date(); end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    const total   = end.getTime() - start.getTime();
    const elapsed = Math.min(now.getTime() - start.getTime(), total);
    return Math.max(0, elapsed / total);
  })();

  const st = getStatusTheme(alreadyCheckedIn, alreadyCheckedOut, attendance?.status);
  const initials = (user?.full_name ?? 'A')
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={loadingAtt}
            onRefresh={onRefresh}
            tintColor={C.blue}
          />
        }
      >
        {/* ── HERO BANNER (Weather Animated) ───────────────────────────────── */}
        <WeatherBanner
          initials={initials}
          fullName={user?.full_name?.split(' ').slice(0, 2).join(' ') ?? 'Karyawan'}
          greeting={greeting()}
          todayStr={todayStr}
          avatarUrl={user?.avatar_url ?? null}
        >
          {/* Status badge di hero */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 8,
            borderWidth: B.glass, borderColor: 'rgba(255,255,255,0.14)',
            alignSelf: 'flex-start',
          }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.dot }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.1 }}>
              {st.label}
              {alreadyCheckedIn && !alreadyCheckedOut && ` · ${formatTime(attendance?.check_in_at)}`}
            </Text>
            {alreadyCheckedIn && !alreadyCheckedOut && attendance?.shift_end && (
              <>
                <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                <Clock size={12} strokeWidth={2} color="rgba(255,255,255,0.60)" />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)' }}>
                  s/d {attendance.shift_end.slice(0, 5)}
                </Text>
              </>
            )}
          </View>
        </WeatherBanner>

        {/* ── CARDS — overlap banner ────────────────────────────────────────── */}
        <View style={{ marginTop: -20, paddingHorizontal: 16, gap: 10 }}>

          {/* ── STATUS ABSENSI ────────────────────────────────────────────── */}
          {loadingAtt && !attendance ? (
            <HomeHeroSkeleton isDark={isDark} />
          ) : (
          <TouchableOpacity
            onPress={() => router.push('/(main)/attendance')}
            activeOpacity={0.85}
            style={{
              backgroundColor: cardBg(isDark),
              borderRadius: R.xl, borderWidth: B.default,
              borderColor: isDark ? C.separator.dark : C.separator.light,
              padding: 20,
              ...(isDark ? S.cardDark : S.card),
            }}
          >
            {/* Top row: label + icon */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: lTertiary(isDark), marginBottom: 7 }}>
                  Status Kehadiran
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.dot }} />
                  <Text style={{ fontSize: 19, fontWeight: '800', color: st.color, letterSpacing: -0.3 }}>
                    {st.label}
                    {alreadyCheckedIn && !alreadyCheckedOut && ` · ${formatTime(attendance?.check_in_at)}`}
                  </Text>
                </View>
              </View>
              <View style={{
                width: 46, height: 46, borderRadius: R.md,
                backgroundColor: st.dot + '16',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {alreadyCheckedOut
                  ? <CheckCircle2 size={24} strokeWidth={1.8} color={st.dot} />
                  : alreadyCheckedIn
                  ? <Building2   size={24} strokeWidth={1.8} color={st.dot} />
                  : <MapPin      size={24} strokeWidth={1.8} color={st.dot} />
                }
              </View>
            </View>

            {/* Shift info */}
            {attendance?.shift_start && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: alreadyCheckedIn && !alreadyCheckedOut ? 14 : 0 }}>
                <Clock size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: lSecondary(isDark) }}>
                  Shift {attendance.shift_start.slice(0, 5)} – {attendance.shift_end?.slice(0, 5)} WITA
                </Text>
              </View>
            )}

            {/* Progress bar saat sedang kerja */}
            {alreadyCheckedIn && !alreadyCheckedOut && (
              <View>
                <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <View style={{ height: '100%', width: `${Math.round(shiftProgress * 100)}%`, backgroundColor: C.blue, borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>{attendance.shift_start?.slice(0, 5)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: C.blue }}>{Math.round(shiftProgress * 100)}% selesai</Text>
                  <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>{attendance.shift_end?.slice(0, 5)}</Text>
                </View>
              </View>
            )}

            {/* Hint check-in — arahkan ke FAB di nav bawah */}
            {!alreadyCheckedIn && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
              }}>
                <Fingerprint size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
                <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
                  Gunakan tombol sidik jari di bawah untuk check-in
                </Text>
              </View>
            )}

            {/* ── Ringkasan bulan ini ── */}
            {monthHistory.length > 0 && (
              <View style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: B.default,
                borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: lTertiary(isDark) }}>
                    Bulan Ini
                  </Text>
                  {totalWorkMinutes > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Clock size={11} strokeWidth={2} color={C.green} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>
                        {totalWorkHours}j{totalWorkMins > 0 ? ` ${totalWorkMins}m` : ''} kerja
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {attendanceSummary.filter(s => s.count > 0).map(({ key, label, color, count }) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        backgroundColor: color + '14',
                        borderRadius: 8, borderWidth: B.default,
                        borderColor: color + '28',
                        paddingHorizontal: 8, paddingVertical: 5,
                      }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{count}</Text>
                      <Text style={{ fontSize: 11, color: lSecondary(isDark) }}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Saldo Cuti ── */}
            {leaveBalance && (
              <View style={{
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: B.default,
                borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: lTertiary(isDark) }}>
                    Cuti Tahun {leaveBalance.year}
                  </Text>
                  <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>
                    +{leaveBalance.accrued_monthly}/bulan
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{
                    flex: 1,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: C.blue + '14',
                    borderRadius: R.md, borderWidth: B.default,
                    borderColor: C.blue + '28',
                    paddingHorizontal: 10, paddingVertical: 8,
                  }}>
                    <Palmtree size={16} strokeWidth={2} color={C.blue} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: lTertiary(isDark), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Saldo
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.blue, letterSpacing: -0.2 }}>
                        {leaveBalance.balance_days} hari
                      </Text>
                    </View>
                  </View>
                  <View style={{
                    flex: 1,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: C.purple + '14',
                    borderRadius: R.md, borderWidth: B.default,
                    borderColor: C.purple + '28',
                    paddingHorizontal: 10, paddingVertical: 8,
                  }}>
                    <Coffee size={16} strokeWidth={2} color={C.purple} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: lTertiary(isDark), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Terpakai
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.purple, letterSpacing: -0.2 }}>
                        {leaveBalance.used_days} hari
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
          )}

          {/* ── CHECKOUT COUNTDOWN ─────────────────────────────────────────── */}
          {alreadyCheckedIn && !alreadyCheckedOut && (
            <TouchableOpacity
              onPress={() => router.push('/(main)/attendance')}
              activeOpacity={0.85}
              style={{
                backgroundColor: cardBg(isDark),
                borderRadius: R.xl, borderWidth: B.default,
                borderColor: isDark ? C.separator.dark : C.separator.light,
                padding: 20,
                ...(isDark ? S.cardDark : S.card),
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: lTertiary(isDark), marginBottom: 10 }}>
                Check-Out
              </Text>
              {timer.canCheckout ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: R.sm - 2, backgroundColor: C.green + '16', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={20} strokeWidth={2} color={C.green} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: C.green }}>
                    Siap checkout sekarang
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 44, fontWeight: '800', color: C.orange, letterSpacing: -2, lineHeight: 48 }}>
                      {timer.displayTime}
                    </Text>
                    <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 4 }}>
                      Tersedia pukul {checkoutInfo?.checkoutEarliest
                        ? new Date(checkoutInfo.checkoutEarliest).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
                        : '—'} WITA
                    </Text>
                  </View>
                  <View style={{ width: 38, height: 38, borderRadius: R.sm - 2, backgroundColor: C.orange + '14', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} strokeWidth={1.8} color={C.orange} />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* ── PERLU DITINJAU (approver only) ───────────────────────────── */}
          {isApprover && (
            <>
              <Text style={{
                fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
                letterSpacing: 1, color: lTertiary(isDark), marginTop: 4,
              }}>
                Perlu Ditinjau
              </Text>
              <NavCard
                label="Tinjau Izin Absen"
                sub="Izin terlambat & pulang awal karyawan"
                accentColor={C.orange}
                icon={AlarmClock}
                onPress={() => router.push('/(main)/attendance-requests-admin' as never)}
                isDark={isDark}
                badge={pendingAttReqCount}
              />
              <NavCard
                label="Tinjau Pengajuan Cuti"
                sub="Cuti tahunan, izin, & sakit karyawan"
                accentColor={C.blue}
                icon={Calendar}
                onPress={() => router.push('/(main)/leave-requests-admin' as never)}
                isDark={isDark}
                badge={pendingLeaveCount}
              />
              <NavCard
                label="Tinjau Klaim Biaya"
                sub="Tinjau pengajuan reimbursement karyawan"
                accentColor={C.green}
                icon={Wallet}
                onPress={() => router.push('/(main)/expense-claims')}
                isDark={isDark}
                badge={pendingExpenseCount}
              />
            </>
          )}

          {/* ── HADIR HARI INI (approver only) ──────────────────────────── */}
          {isApprover && (
            <CheckedInCarousel
              records={teamToday}
              isLoading={loadingTeam && !teamToday}
              isDark={isDark}
            />
          )}

          {/* ── JADWAL HARI INI ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.push('/(main)/schedule')}
            activeOpacity={0.85}
            style={{
              backgroundColor: cardBg(isDark),
              borderRadius: R.lg, borderWidth: B.default,
              borderColor: isDark ? C.separator.dark : C.separator.light,
              padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              ...(isDark ? S.cardDark : S.card),
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: R.sm,
              backgroundColor: C.purple + '18',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {todaySchedule?.is_holiday
                ? <Sun      size={20} strokeWidth={1.8} color={C.red}    />
                : todaySchedule?.is_day_off
                ? <Coffee   size={20} strokeWidth={1.8} color={lTertiary(isDark)} />
                : <Calendar size={20} strokeWidth={1.8} color={C.purple} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: lTertiary(isDark), marginBottom: 2 }}>
                Jadwal Hari Ini
              </Text>
              {!todaySchedule ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: lSecondary(isDark) }}>Tidak ada jadwal</Text>
              ) : todaySchedule.is_holiday ? (
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Hari Libur Nasional</Text>
              ) : todaySchedule.is_day_off ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: lSecondary(isDark) }}>Hari Libur</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: lPrimary(isDark) }}>
                    {todaySchedule.shift_type?.name ?? (todaySchedule.schedule_type === 'office_hours' ? 'Office Hours' : 'Shift')}
                  </Text>
                  {todaySchedule.start_time && (
                    <>
                      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: lTertiary(isDark) }} />
                      <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
                        {todaySchedule.start_time.slice(0, 5)} – {todaySchedule.end_time?.slice(0, 5)} WITA
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
            <View style={{
              width: 26, height: 26, borderRadius: R.sm - 2,
              backgroundColor: C.purple + '12',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronRight size={13} strokeWidth={2.2} color={C.purple} />
            </View>
          </TouchableOpacity>

          {/* ── IZIN TERLAMBAT / PULANG AWAL ─────────────────────────────── */}
          {showLateCard && (
            <AttendanceRequestCard
              type="late_arrival"
              request={lateArrivalRequest}
              deadlinePassed={lateDeadlinePassed}
              onSubmit={() => { setRequestModalType('late_arrival'); setShowRequestModal(true); }}
              isDark={isDark}
            />
          )}
          {showEarlyCard && (
            <AttendanceRequestCard
              type="early_departure"
              request={earlyDepartureRequest}
              onSubmit={() => { setRequestModalType('early_departure'); setShowRequestModal(true); }}
              isDark={isDark}
            />
          )}

          {/* ── TUKAR JADWAL ──────────────────────────────────────────────── */}
          <NavCard
            label="Tukar Jadwal"
            sub="Tukar hari kerja dengan rekan atau hari libur"
            accentColor={C.orange}
            icon={ArrowLeftRight}
            onPress={() => router.push('/(main)/schedule-swap')}
            isDark={isDark}
          />

          {/* ── CUTI & IZIN ───────────────────────────────────────────────── */}
          <NavCard
            label="Cuti & Izin"
            sub="Ajukan cuti, izin, dan lihat saldo"
            accentColor={C.blue}
            icon={Palmtree}
            onPress={() => router.push('/(main)/leave')}
            isDark={isDark}
          />

          {/* ── BENTO: TUGAS + KUNJUNGAN ───────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Tugas"     value="—"  sub="hari ini"
              accentColor={C.green}  icon={ClipboardList}
              onPress={() => router.push('/(main)/pekerjaan')}
              isDark={isDark}
            />
            <StatCard
              label="Kunjungan" value="—"  sub="bulan ini"
              accentColor={C.orange} icon={MapPin}
              onPress={() => router.push('/(main)/visits')}
              isDark={isDark}
            />
          </View>

          {/* ── KLAIM BIAYA ───────────────────────────────────────────────── */}
          {/* Saldo Cuti dipindah ke /(main)/leave (single source of truth). */}
          <NavCard
            label="Klaim Biaya"
            sub="Ajukan reimbursement biaya operasional"
            accentColor={C.blue}
            icon={Wallet}
            onPress={() => router.push('/(main)/expense-claims')}
            isDark={isDark}
          />

          {/* ── SOS ──────────────────────────────────────────────────────── */}
          <SosButton isDark={isDark} />
        </View>
      </ScrollView>

      {/* ── MODAL AJUKAN IZIN ──────────────────────────────────────────────── */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowRequestModal(false)}
          />
          <View style={{
            backgroundColor: cardBg(isDark),
            borderTopLeftRadius: R.xl + 4,
            borderTopRightRadius: R.xl + 4,
            borderTopWidth: B.default,
            borderLeftWidth: B.default,
            borderRightWidth: B.default,
            borderColor: isDark ? C.separator.dark : C.separator.light,
            padding: 24,
            paddingBottom: insets.bottom + 24,
            ...(isDark ? S.cardDark : S.card),
          }}>
            {/* Handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
              alignSelf: 'center', marginBottom: 20,
            }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{
                width: 44, height: 44, borderRadius: R.sm,
                backgroundColor: (requestModalType === 'late_arrival' ? C.orange : C.purple) + '16',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {requestModalType === 'late_arrival'
                  ? <AlarmClock size={22} strokeWidth={1.8} color={C.orange} />
                  : <LogOut     size={22} strokeWidth={1.8} color={C.purple} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.3 }}>
                  {requestModalType === 'late_arrival' ? 'Ajukan Izin Terlambat' : 'Ajukan Izin Pulang Awal'}
                </Text>
                <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                  {requestModalType === 'late_arrival'
                    ? 'Permohonan akan diproses oleh admin'
                    : 'Izin meninggalkan kantor lebih awal'}
                </Text>
              </View>
            </View>

            {/* Alasan */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 8 }}>
              Alasan <Text style={{ color: C.red }}>*</Text>
            </Text>
            <TextInput
              value={requestReason}
              onChangeText={setRequestReason}
              placeholder="Tulis alasan Anda..."
              placeholderTextColor={lTertiary(isDark)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: isDark ? C.separator.dark : C.separator.light,
                padding: 12,
                fontSize: 15, color: lPrimary(isDark),
                minHeight: 80,
                marginBottom: 16,
              }}
            />

            {/* Estimasi waktu (opsional) */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 8 }}>
              {requestModalType === 'late_arrival' ? 'Estimasi jam tiba (misal 08:30)' : 'Estimasi jam pulang (misal 15:00)'}
              <Text style={{ color: lTertiary(isDark), fontWeight: '400' }}> · opsional</Text>
            </Text>
            <TextInput
              value={requestEstTime}
              onChangeText={setRequestEstTime}
              placeholder="HH:MM"
              placeholderTextColor={lTertiary(isDark)}
              keyboardType="numbers-and-punctuation"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: isDark ? C.separator.dark : C.separator.light,
                padding: 12,
                fontSize: 15, color: lPrimary(isDark),
                marginBottom: 24,
              }}
            />

            {/* Tombol */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowRequestModal(false); setRequestReason(''); setRequestEstTime(''); }}
                style={{
                  flex: 1, padding: 14, borderRadius: R.lg,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: lSecondary(isDark) }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (submitRequestMutation.isPending || !requestReason.trim()) return;
                  submitRequestMutation.mutate();
                }}
                disabled={submitRequestMutation.isPending || !requestReason.trim()}
                style={{
                  flex: 2, padding: 14, borderRadius: R.lg,
                  backgroundColor: requestModalType === 'late_arrival' ? C.orange : C.purple,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: (submitRequestMutation.isPending || !requestReason.trim()) ? 0.6 : 1,
                }}
              >
                {submitRequestMutation.isPending
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Kirim Permohonan</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
