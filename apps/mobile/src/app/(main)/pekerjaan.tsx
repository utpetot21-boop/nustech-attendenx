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
  Clock,
  MapPin,
  PauseCircle,
  ArrowUpRight,
  Play,
  AlertCircle,
  ClipboardList,
  Navigation,
} from 'lucide-react-native';

import { tasksService, type TaskSummary } from '@/services/tasks.service';
import { visitsService, type VisitSummary } from '@/services/visits.service';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary, separator } from '@/constants/tokens';

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
        colors={isDark ? ['#1A2A1A', '#0F1F0F', '#1A1A0A'] : ['#064E3B', '#065F46', '#047857']}
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
  icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
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

  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();

  useEffect(() => {
    let mounted = true; // P3-11: cegah setState setelah unmount
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
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
    });
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
      qc.invalidateQueries({ queryKey: ['tasks-all'] });
      Alert.alert('Berhasil', 'Tugas diterima. Silakan lakukan check-in saat tiba di lokasi.');
    },
    onError: (err: Error) => Alert.alert('Gagal', err.message),
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
            <View style={{
              width: 48, height: 48, borderRadius: R.md,
              backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF7ED',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Wrench size={24} strokeWidth={1.8} color={C.orange} />
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={C.orange} />
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

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}
