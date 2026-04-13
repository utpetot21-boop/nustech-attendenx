import { useCallback, useRef, useState as useLocalState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Animated,
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
  TrendingUp,
  Calendar,
  Sun,
  Coffee,
} from 'lucide-react-native';
import WeatherBanner, { getPeriodLabel } from '@/components/home/WeatherBanner';

import { attendanceService, type AttendanceRecord } from '@/services/attendance.service';
import { scheduleService, getCurrentWeekString } from '@/services/schedule.service';
import { useCheckoutTimer } from '@/hooks/useCheckoutTimer';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';

// ── Status theme ─────────────────────────────────────────────────────────────
function getStatusTheme(checkedIn: boolean, checkedOut: boolean, status?: string) {
  if (checkedOut) return {
    dot: C.green, label: 'Selesai', color: C.green,
    bg: (d: boolean) => d ? 'rgba(52,199,89,0.12)' : '#F0FDF4',
    border: (d: boolean) => d ? 'rgba(52,199,89,0.22)' : 'rgba(52,199,89,0.28)',
  };
  if (checkedIn) return {
    dot: status === 'terlambat' ? C.orange : C.blue,
    label: status === 'terlambat' ? 'Terlambat' : 'Hadir',
    color: status === 'terlambat' ? C.orange : C.blue,
    bg: (d: boolean) => d ? 'rgba(0,122,255,0.12)' : '#EFF6FF',
    border: (d: boolean) => d ? 'rgba(0,122,255,0.22)' : 'rgba(0,122,255,0.28)',
  };
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
      if (finished) { setHolding(false); router.push('/(main)/sos' as any); progress.setValue(0); }
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
  icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
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
  icon: Icon, onPress, isDark,
}: {
  label: string; sub: string; accentColor: string;
  icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
  onPress: () => void; isDark: boolean;
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
      <View style={{
        width: 28, height: 28, borderRadius: R.sm - 2,
        backgroundColor: accentColor + '12',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <ChevronRight size={14} strokeWidth={2.2} color={accentColor} />
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

  const { data: user } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const raw = await SecureStore.getItemAsync('user');
      return raw ? JSON.parse(raw) : null;
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

  const todayDate = new Date().toISOString().split('T')[0];
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

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['attendance-today'] });
    qc.invalidateQueries({ queryKey: ['checkout-info'] });
  }, [qc]);

  const greeting = getPeriodLabel;

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const alreadyCheckedIn  = !!attendance?.check_in_at;
  const alreadyCheckedOut = !!attendance?.check_out_at;

  const formatTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
    : null;

  const shiftProgress = (() => {
    if (!attendance?.shift_start || !attendance?.shift_end || !alreadyCheckedIn) return 0;
    const now = new Date();
    const [sh, sm] = attendance.shift_start.split(':').map(Number);
    const [eh, em] = attendance.shift_end.split(':').map(Number);
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
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
          <TouchableOpacity
            onPress={() => router.push('/(main)/attendance' as any)}
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

            {/* Belum check-in CTA */}
            {!alreadyCheckedIn && (
              <View style={{
                backgroundColor: C.orange + '12',
                borderRadius: R.md, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderWidth: B.default, borderColor: C.orange + '22',
                marginTop: 4,
              }}>
                <Fingerprint size={18} strokeWidth={1.8} color={C.orange} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.orange }}>
                  Ketuk untuk check-in sekarang
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── CHECKOUT COUNTDOWN ─────────────────────────────────────────── */}
          {alreadyCheckedIn && !alreadyCheckedOut && (
            <TouchableOpacity
              onPress={() => router.push('/(main)/attendance' as any)}
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

          {/* ── JADWAL HARI INI ────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.push('/(main)/schedule' as any)}
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

          {/* ── BENTO: TUGAS + KUNJUNGAN ───────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Tugas"     value="—"  sub="hari ini"
              accentColor={C.green}  icon={ClipboardList}
              onPress={() => router.push('/(main)/tasks' as any)}
              isDark={isDark}
            />
            <StatCard
              label="Kunjungan" value="—"  sub="bulan ini"
              accentColor={C.orange} icon={MapPin}
              onPress={() => router.push('/(main)/visits' as any)}
              isDark={isDark}
            />
          </View>

          {/* ── BENTO: SALDO CUTI + KLAIM BIAYA ───────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Saldo Cuti"  value="—"  sub="hari tersisa"
              accentColor={C.purple} icon={TrendingUp}
              onPress={() => router.push('/(main)/profile' as any)}
              isDark={isDark}
            />
            <StatCard
              label="Klaim"       value="—"  sub="menunggu"
              accentColor={C.blue}   icon={Wallet}
              onPress={() => router.push('/(main)/expense-claims' as any)}
              isDark={isDark}
            />
          </View>

          {/* ── SOS ──────────────────────────────────────────────────────── */}
          <SosButton isDark={isDark} />
        </View>
      </ScrollView>
    </View>
  );
}
