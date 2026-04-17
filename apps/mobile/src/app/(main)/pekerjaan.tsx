/**
 * M-04/05 — Pekerjaan (Unified Work Hub)
 * Menggabungkan alur Tugas → Kunjungan dalam satu layar.
 * Alur: Terima tugas → Check-in → Visit aktif (timer) → Check-out
 * iOS 26 Liquid Glass design
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  Wrench,
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  PauseCircle,
  Play,
  AlertCircle,
  ClipboardList,
  Navigation,
  Plus,
  User,
  Search,
  X,
  Briefcase,
  type LucideIcon,
} from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { tasksService, type TaskSummary } from '@/services/tasks.service';
import { visitsService, type VisitSummary } from '@/services/visits.service';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary, separator, gradients } from '@/constants/tokens';
import { TaskCardSkeleton } from '@/components/ui/SkeletonLoader';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type PickerMode = 'employee' | 'client' | null;
interface EmployeeItem { id: string; full_name: string; employee_id?: string }
interface ClientItem   { id: string; name: string; address?: string }

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Rendah',   color: C.green  },
  { value: 'normal', label: 'Normal',   color: C.blue   },
  { value: 'high',   label: 'Tinggi',   color: C.orange },
  { value: 'urgent', label: 'Mendesak', color: C.red    },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useElapsedTimer(startIso: string | null) {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!startIso) return;
    const tick = () => {
      const diff = Date.now() - new Date(startIso).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return elapsed;
}

function distanceLabel(lat?: number, lng?: number, userLat?: number, userLng?: number) {
  if (!lat || !lng || !userLat || !userLng) return null;
  const R_earth = 6371000;
  const dLat = ((lat - userLat) * Math.PI) / 180;
  const dLng = ((lng - userLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const d = R_earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Visit Card
// ─────────────────────────────────────────────────────────────────────────────

function ActiveVisitCard({ visit, onPress }: { visit: VisitSummary; onPress: () => void }) {
  const elapsed = useElapsedTimer(visit.check_in_at);
  const isDark = useColorScheme() === 'dark';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ marginHorizontal: 16, marginBottom: 10 }}>
      <LinearGradient
        colors={isDark ? gradients.heroWorkDark : gradients.heroWorkLight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: R.xl, padding: 20, overflow: 'hidden' }}
      >
        {/* Decorative circle */}
        <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.04)' }} />

        {/* Live badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.green, letterSpacing: 1, textTransform: 'uppercase' }}>
            Kunjungan Berlangsung
          </Text>
        </View>

        {/* Client */}
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 4 }} numberOfLines={1}>
          {visit.client?.name ?? '—'}
        </Text>
        {visit.client?.pic_name && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>
            PIC: {visit.client.pic_name}
          </Text>
        )}

        {/* Timer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={15} strokeWidth={2} color="rgba(255,255,255,0.55)" />
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
              {elapsed}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Buka Detail</Text>
            <ChevronRight size={14} strokeWidth={2.5} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  label, count, color, icon: Icon,
}: {
  label: string; count: number; color: string;
  icon: LucideIcon;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, paddingBottom: 10 }}>
      <Icon size={13} strokeWidth={2.5} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '700', color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color }}>{count}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: color + '28', borderRadius: 1, marginLeft: 2 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Work Card
// ─────────────────────────────────────────────────────────────────────────────

function TaskWorkCard({
  task, isDark, onAccept, onDetail, onCheckin, userLat, userLng,
}: {
  task: TaskSummary;
  isDark: boolean;
  onAccept?: () => void;
  onDetail: () => void;
  onCheckin?: () => void;
  userLat?: number;
  userLng?: number;
}) {
  const isPending = task.status === 'pending_confirmation';
  const isAssigned = task.status === 'assigned';
  const isOnHold   = task.status === 'on_hold';

  const distLabel = distanceLabel(
    task.client?.lat ?? undefined,
    task.client?.lng ?? undefined,
    userLat, userLng,
  );

  const deadlineStr = task.confirm_deadline
    ? new Date(task.confirm_deadline).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
      })
    : null;

  return (
    <TouchableOpacity
      onPress={onDetail}
      activeOpacity={0.82}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        overflow: 'hidden',
        ...(isDark ? S.cardDark : S.card),
        opacity: isOnHold ? 0.65 : 1,
      }}
    >
      {/* Urgent accent bar */}
      {task.is_emergency && (
        <View style={{ height: 3, backgroundColor: C.red }} />
      )}

      <View style={{ padding: 16 }}>
        {/* Priority badge + title */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          {task.is_emergency && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.red + '18', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 3 }}>
              <Zap size={10} strokeWidth={2.5} color={C.red} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.red, letterSpacing: 0.5 }}>DARURAT</Text>
            </View>
          )}
          {task.priority === 'high' && !task.is_emergency && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange, marginTop: 5 }} />
          )}
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }} numberOfLines={2}>
            {task.title}
          </Text>
        </View>

        {/* Client */}
        {task.client && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MapPin size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark), flex: 1 }} numberOfLines={1}>
              {task.client.name}
              {task.client.address ? ` · ${task.client.address}` : ''}
            </Text>
            {distLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.blue + '12', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Navigation size={10} strokeWidth={2} color={C.blue} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.blue }}>{distLabel}</Text>
              </View>
            )}
          </View>
        )}

        {/* Deadline warning */}
        {isPending && deadlineStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <AlertCircle size={12} strokeWidth={2} color={C.orange} />
            <Text style={{ fontSize: 12, color: C.orange, fontWeight: '600' }}>
              Konfirmasi sebelum {deadlineStr} WITA
            </Text>
          </View>
        )}

        {/* Scheduled */}
        {task.scheduled_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 12, color: lSecondary(isDark) }}>
              {new Date(task.scheduled_at).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
              })} WITA
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {isPending && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={onAccept}
              style={{
                flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: C.green, borderRadius: R.sm, paddingVertical: 11,
              }}
            >
              <CheckCircle2 size={15} strokeWidth={2.2} color="#FFF" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Terima</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDetail}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: R.sm, paddingVertical: 11,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: lSecondary(isDark) }}>Detail</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAssigned && (
          <TouchableOpacity
            onPress={onCheckin ?? onDetail}
            style={{
              marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: C.orange + '18',
              borderRadius: R.sm, paddingVertical: 12,
              borderWidth: B.default, borderColor: C.orange + '35',
            }}
          >
            <Play size={15} strokeWidth={2.2} color={C.orange} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.orange }}>Check-in Sekarang</Text>
          </TouchableOpacity>
        )}

        {isOnHold && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <PauseCircle size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lTertiary(isDark) }}>Menunggu persetujuan penundaan</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PekerjaanScreen() {
  const isDark    = useColorScheme() === 'dark';
  const router    = useRouter();
  const qc        = useQueryClient();
  const insets    = useSafeAreaInsets();
  const user      = useAuthStore((s) => s.user);
  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.role?.name ?? '');

  const [showCreate, setShowCreate] = useState(false);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();

  useEffect(() => {
    let mounted = true; // P3-11: cegah setState setelah unmount
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted' && mounted) {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then((loc) => {
              if (mounted) {
                setUserLat(loc.coords.latitude);
                setUserLng(loc.coords.longitude);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tasksData, isLoading: loadingTasks, isRefetching: refetchingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks-all'],
    queryFn: () => tasksService.getMyTasks(),
    refetchInterval: 20_000,
  });

  const { data: visitsData, isLoading: loadingVisits, isRefetching: refetchingVisits, refetch: refetchVisits } = useQuery({
    queryKey: ['visits-ongoing'],
    queryFn: () => visitsService.getMyVisits({ status: 'ongoing' }),
    refetchInterval: 15_000,
  });

  const isRefetching = refetchingTasks || refetchingVisits;
  const onRefresh = useCallback(() => { refetchTasks(); refetchVisits(); }, [refetchTasks, refetchVisits]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: (id: string) => tasksService.accept(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks-all'] });
      Alert.alert('Berhasil', 'Tugas diterima. Silakan lakukan check-in saat tiba di lokasi.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const allTasks = tasksData?.items ?? [];
  const activeVisit = (visitsData?.items ?? []).find((v) => v.status === 'ongoing') ?? null;

  const urgentPending  = allTasks.filter((t) => t.status === 'pending_confirmation' && t.is_emergency);
  const normalPending  = allTasks.filter((t) => t.status === 'pending_confirmation' && !t.is_emergency);
  const assignedTasks  = allTasks.filter((t) => t.status === 'assigned');
  const onHoldTasks    = allTasks.filter((t) => t.status === 'on_hold');

  const pendingAll = [...urgentPending, ...normalPending];
  const totalActive = pendingAll.length + assignedTasks.length + onHoldTasks.length + (activeVisit ? 1 : 0);
  const isLoading = loadingTasks || loadingVisits;

  const goToTask  = (id: string) => router.push(`/(main)/tasks/${id}` as never);
  const goToVisit = (id: string) => router.push(`/(main)/visits/${id}` as never);

  const handleAccept = (task: TaskSummary) => {
    Alert.alert('Terima Tugas?', `Anda akan menerima tugas "${task.title}".`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Terima', onPress: () => acceptMutation.mutate(task.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.orange} />
        }
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 30, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.8 }}>
                Pekerjaan
              </Text>
              <Text style={{ fontSize: 14, color: lSecondary(isDark), marginTop: 3 }}>
                {isLoading
                  ? 'Memuat…'
                  : totalActive === 0
                  ? 'Tidak ada pekerjaan aktif'
                  : `${totalActive} item perlu perhatian`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => isManager ? setShowCreate(true) : router.push('/(main)/visits' as never)}
              activeOpacity={0.8}
              style={{
                width: 48, height: 48, borderRadius: R.md,
                backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF7ED',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: C.orange, shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
              }}
              accessibilityLabel={isManager ? 'Buat tugas baru' : 'Riwayat kunjungan'}
            >
              {isManager
                ? <Plus size={24} strokeWidth={2.5} color={C.orange} />
                : <Wrench size={24} strokeWidth={1.8} color={C.orange} />
              }
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <TaskCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : (
          <>
            {/* ── ACTIVE VISIT ────────────────────────────────────────────── */}
            {activeVisit && (
              <ActiveVisitCard
                visit={activeVisit}
                onPress={() => goToVisit(activeVisit.id)}
              />
            )}

            {/* ── PERLU KONFIRMASI ────────────────────────────────────────── */}
            {pendingAll.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <SectionHeader
                  label="Perlu Konfirmasi"
                  count={pendingAll.length}
                  color={C.red}
                  icon={Zap}
                />
                {pendingAll.map((task) => (
                  <TaskWorkCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    onAccept={() => handleAccept(task)}
                    onDetail={() => goToTask(task.id)}
                    userLat={userLat}
                    userLng={userLng}
                  />
                ))}
              </View>
            )}

            {/* ── SIAP DIKERJAKAN ─────────────────────────────────────────── */}
            {assignedTasks.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <SectionHeader
                  label="Siap Dikerjakan"
                  count={assignedTasks.length}
                  color={C.orange}
                  icon={Play}
                />
                {assignedTasks.map((task) => (
                  <TaskWorkCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    onDetail={() => goToTask(task.id)}
                    onCheckin={() => goToTask(task.id)}
                    userLat={userLat}
                    userLng={userLng}
                  />
                ))}
              </View>
            )}

            {/* ── DITUNDA ─────────────────────────────────────────────────── */}
            {onHoldTasks.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <SectionHeader
                  label="Ditunda"
                  count={onHoldTasks.length}
                  color={lTertiary(isDark)}
                  icon={PauseCircle}
                />
                {onHoldTasks.map((task) => (
                  <TaskWorkCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    onDetail={() => goToTask(task.id)}
                    userLat={userLat}
                    userLng={userLng}
                  />
                ))}
              </View>
            )}

            {/* ── EMPTY STATE ─────────────────────────────────────────────── */}
            {totalActive === 0 && (
              <View style={{ paddingTop: 48, alignItems: 'center', paddingHorizontal: 32 }}>
                <View style={{
                  width: 80, height: 80, borderRadius: R.xl,
                  backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : '#DCFCE7',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                }}>
                  <CheckCircle2 size={40} strokeWidth={1.4} color={C.green} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), textAlign: 'center', marginBottom: 8 }}>
                  Semua beres!
                </Text>
                <Text style={{ fontSize: 15, color: lSecondary(isDark), textAlign: 'center', lineHeight: 22 }}>
                  Tidak ada tugas aktif atau kunjungan yang perlu ditindaklanjuti.
                </Text>
              </View>
            )}

            {/* ── FOOTER LINKS ────────────────────────────────────────────── */}
            <View style={{ marginHorizontal: 16, marginTop: 20, gap: 10 }}>
              {/* Lihat semua tugas */}
              <TouchableOpacity
                onPress={() => router.push('/(main)/tasks' as never)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: cardBg(isDark),
                  borderRadius: R.lg, borderWidth: B.default,
                  borderColor: isDark ? C.separator.dark : C.separator.light,
                  padding: 14,
                  ...(isDark ? S.cardDark : S.card),
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: R.sm - 2, backgroundColor: C.green + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={18} strokeWidth={1.8} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark) }}>Semua Tugas</Text>
                  <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}>
                    {tasksData?.total ?? 0} total tugas
                  </Text>
                </View>
                <ChevronRight size={15} strokeWidth={2} color={lTertiary(isDark)} />
              </TouchableOpacity>

              {/* Lihat semua kunjungan */}
              <TouchableOpacity
                onPress={() => router.push('/(main)/visits' as never)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: cardBg(isDark),
                  borderRadius: R.lg, borderWidth: B.default,
                  borderColor: isDark ? C.separator.dark : C.separator.light,
                  padding: 14,
                  ...(isDark ? S.cardDark : S.card),
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: R.sm - 2, backgroundColor: C.blue + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} strokeWidth={1.8} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark) }}>Riwayat Kunjungan</Text>
                  <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}>Lihat semua kunjungan lapangan</Text>
                </View>
                <ChevronRight size={15} strokeWidth={2} color={lTertiary(isDark)} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* ── Create Task Sheet (manager only) ── */}
      <CreateTaskSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ['tasks-all'] });
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateTaskSheet
// ─────────────────────────────────────────────────────────────────────────────

function CreateTaskSheet({
  visible, onClose, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isDark  = useColorScheme() === 'dark';
  const insets  = useSafeAreaInsets();

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [search, setSearch]         = useState('');
  const [employee, setEmployee]     = useState<EmployeeItem | null>(null);
  const [client, setClient]         = useState<ClientItem | null>(null);
  const [priority, setPriority]     = useState<Priority>('normal');
  const [notes, setNotes]           = useState('');

  const bg      = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardCol = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const prim    = lPrimary(isDark);
  const ter     = lTertiary(isDark);

  const { data: employees = [], isFetching: loadingEmp } = useQuery({
    queryKey: ['colleagues-picker', search],
    queryFn: () => api.get('/users/colleagues', { params: { search } }).then((r) => r.data.items as EmployeeItem[]),
    enabled: visible && pickerMode === 'employee',
    staleTime: 30_000,
  });

  const { data: clients = [], isFetching: loadingCli } = useQuery({
    queryKey: ['clients-picker', search],
    queryFn: () => api.get('/clients', { params: { search } }).then((r) => r.data as ClientItem[]),
    enabled: visible && pickerMode === 'client',
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => tasksService.createVisitTask({
      title: client ? `Kunjungan ke ${client.name}` : 'Tugas Kunjungan',
      assigned_to: employee!.id,
      client_id: client?.id,
      priority,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onSuccess();
      Alert.alert('Berhasil', 'Tugas dikirim ke karyawan.');
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan.');
    },
  });

  const resetForm = () => {
    setPickerMode(null); setSearch('');
    setEmployee(null); setClient(null);
    setPriority('normal'); setNotes('');
  };

  const handleClose = () => { resetForm(); onClose(); };
  const openPicker = (mode: PickerMode) => { setSearch(''); setPickerMode(mode); };

  const renderPicker = () => {
    const isEmp  = pickerMode === 'employee';
    const items  = isEmp ? employees : clients;
    const loading = isEmp ? loadingEmp : loadingCli;

    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
          <TouchableOpacity onPress={() => { setPickerMode(null); setSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={22} strokeWidth={2} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: prim, flex: 1 }}>
            {isEmp ? 'Pilih Karyawan' : 'Pilih Client'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF5', borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Search size={15} strokeWidth={2} color={ter} />
          <TextInput value={search} onChangeText={setSearch} placeholder={isEmp ? 'Cari nama karyawan...' : 'Cari client...'} placeholderTextColor={ter} style={{ flex: 1, fontSize: 15, color: prim }} autoFocus />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>}
        </View>
        {loading ? <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} /> : (
          <FlatList
            data={items as (EmployeeItem | ClientItem)[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: ter, marginTop: 32, fontSize: 14 }}>{search ? 'Tidak ada hasil' : 'Belum ada data'}</Text>}
            renderItem={({ item }) => {
              const name = isEmp ? (item as EmployeeItem).full_name : (item as ClientItem).name;
              const sub  = isEmp ? (item as EmployeeItem).employee_id : (item as ClientItem).address;
              return (
                <TouchableOpacity
                  onPress={() => isEmp ? (setEmployee(item as EmployeeItem), setPickerMode(null), setSearch('')) : (setClient(item as ClientItem), setPickerMode(null), setSearch(''))}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, marginBottom: 8 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                    {isEmp ? <User size={18} strokeWidth={1.8} color={C.blue} /> : <Briefcase size={18} strokeWidth={1.8} color={C.blue} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: prim }} numberOfLines={1}>{name}</Text>
                    {sub && <Text style={{ fontSize: 12, color: ter, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
                  </View>
                  <ChevronRight size={14} strokeWidth={2} color={ter} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  };

  const renderForm = () => (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
      {/* Karyawan */}
      <Text style={{ fontSize: 12, fontWeight: '700', color: ter, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Karyawan *</Text>
      <TouchableOpacity onPress={() => openPicker('employee')} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: employee ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: employee ? (isDark ? 'rgba(0,122,255,0.20)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7'), alignItems: 'center', justifyContent: 'center' }}>
          <User size={18} strokeWidth={1.8} color={employee ? C.blue : ter} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, color: employee ? prim : ter, fontWeight: employee ? '600' : '400' }}>{employee?.full_name ?? 'Pilih karyawan...'}</Text>
        <ChevronRight size={16} strokeWidth={2} color={ter} />
      </TouchableOpacity>

      {/* Client */}
      <Text style={{ fontSize: 12, fontWeight: '700', color: ter, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Lokasi / Client *</Text>
      <TouchableOpacity onPress={() => openPicker('client')} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: client ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: client ? (isDark ? 'rgba(0,122,255,0.20)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7'), alignItems: 'center', justifyContent: 'center' }}>
          <Briefcase size={18} strokeWidth={1.8} color={client ? C.blue : ter} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, color: client ? prim : ter, fontWeight: client ? '600' : '400' }}>{client?.name ?? 'Pilih client / lokasi...'}</Text>
        <ChevronRight size={16} strokeWidth={2} color={ter} />
      </TouchableOpacity>

      {/* Prioritas */}
      <Text style={{ fontSize: 12, fontWeight: '700', color: ter, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Prioritas</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {PRIORITY_OPTIONS.map((opt) => {
          const active = priority === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => setPriority(opt.value as Priority)} activeOpacity={0.78}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.sm, backgroundColor: active ? opt.color + '20' : cardCol, borderWidth: active ? 1.5 : B.default, borderColor: active ? opt.color : border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? opt.color : ter }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Catatan */}
      <Text style={{ fontSize: 12, fontWeight: '700', color: ter, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Catatan</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Instruksi atau catatan tambahan..." placeholderTextColor={ter} multiline numberOfLines={3} textAlignVertical="top"
        style={{ backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, padding: 14, fontSize: 15, color: prim, minHeight: 90, marginBottom: 24 }} />

      {/* Submit */}
      <TouchableOpacity
        onPress={() => createMut.mutate()}
        disabled={!employee || !client || createMut.isPending}
        activeOpacity={0.85}
        style={{ paddingVertical: 16, borderRadius: R.md, backgroundColor: employee && client ? C.orange : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
      >
        {createMut.isPending
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Briefcase size={18} strokeWidth={2} color={employee && client ? '#FFF' : ter} />
        }
        <Text style={{ fontSize: 16, fontWeight: '700', color: employee && client ? '#FFF' : ter }}>
          {createMut.isPending ? 'Membuat Tugas…' : 'Buat & Kirim Tugas'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg }}>
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
        </View>

        {/* Header */}
        {!pickerMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.orange + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={18} strokeWidth={1.8} color={C.orange} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: prim }}>Buat Tugas Kunjungan</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} strokeWidth={2.2} color={prim} />
            </TouchableOpacity>
          </View>
        )}

        {pickerMode ? renderPicker() : renderForm()}
      </KeyboardAvoidingView>
    </Modal>
  );
}
