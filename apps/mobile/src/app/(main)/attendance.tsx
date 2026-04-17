/**
 * M-06 · SCREEN ABSENSI KANTOR
 * Check-in via Face ID / Fingerprint → GPS → Server
 * Jika biometrik gagal 3x → PIN 6 digit fallback
 * Checkout terkunci sampai 8 jam sejak check-in
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Lock, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { attendanceService, type AttendanceRecord } from '@/services/attendance.service';
import { useBiometric } from '@/hooks/useBiometric';
import { useGPS } from '@/hooks/useGPS';
import { useCheckoutTimer } from '@/hooks/useCheckoutTimer';
import { PINInput } from '@/components/attendance/PINInput';
import { GPSValidator } from '@/components/attendance/GPSValidator';
import api from '@/services/api';
import { scheduleService, getCurrentWeekString } from '@/services/schedule.service';
import { BackHeader } from '@/components/ui/BackHeader';

type UIState = 'idle' | 'verifying_biometric' | 'show_pin' | 'checking_gps' | 'confirming' | 'done';

export default function AttendanceScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [uiState, setUiState] = useState<UIState>('idle');
  const [pendingMethod, setPendingMethod] = useState<string>('face_id');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsResult, setGpsResult] = useState<{ isWithinRadius: boolean; distanceMeters: number; accuracy: number | null } | null>(null);
  const [pinError, setPinError] = useState<string | undefined>(undefined);

  // ── Late note modal ───────────────────────────────────────────
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateNote, setLateNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState<{ method: string; lat: number | null; lng: number | null } | null>(null);

  const { verify: verifyBiometric, isVerifying } = useBiometric();
  const { validateGeofence, isLoading: gpsLoading } = useGPS();

  // Queries
  const { data: attendance, isLoading: loadingAttendance } = useQuery<AttendanceRecord | null>({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceService.getToday(),
    refetchInterval: 30_000,
  });

  const { data: checkoutInfo } = useQuery({
    queryKey: ['checkout-info'],
    queryFn: () => attendanceService.getCheckoutInfo(),
    enabled: !!attendance?.check_in_at && !attendance?.check_out_at,
    refetchInterval: 5_000,
  });

  const timer = useCheckoutTimer(
    checkoutInfo?.checkoutEarliest ?? attendance?.checkout_earliest ?? null,
    checkoutInfo?.checkedOut ?? !!attendance?.check_out_at,
  );

  // Jadwal hari ini — sebagai fallback untuk deteksi terlambat sebelum attendance record ada
  const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  const { data: todaySchedules = [] } = useQuery({
    queryKey: ['schedule-today-checkin', todayDateStr],
    queryFn: () => scheduleService.getMySchedule({ week: getCurrentWeekString() }),
    staleTime: 5 * 60_000,
    enabled: !attendance?.check_in_at, // hanya butuh jadwal jika belum check-in
  });
  const todaySchedule = todaySchedules.find((s) => s.date === todayDateStr) ?? null;

  // Hitung apakah user sudah melewati toleransi keterlambatan saat ini
  const computeIsLate = useCallback((): { isLate: boolean; lateMin: number } => {
    const shiftStart = attendance?.shift_start ?? todaySchedule?.start_time ?? null;
    const tolerance = attendance?.tolerance_minutes ?? todaySchedule?.tolerance_minutes ?? 0;
    if (!shiftStart) return { isLate: false, lateMin: 0 };
    const [h, m] = shiftStart.split(':').map(Number);
    const toleranceEnd = new Date();
    toleranceEnd.setHours(h, m + tolerance, 0, 0);
    const diffMin = Math.floor((new Date().getTime() - toleranceEnd.getTime()) / 60000);
    return { isLate: diffMin > 0, lateMin: diffMin };
  }, [attendance, todaySchedule]);

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: (payload: { method: string; lat: number | null; lng: number | null; notes?: string }) =>
      attendanceService.checkIn(payload),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['checkout-info'] });
      setUiState('done');
      setShowLateModal(false);
      setLateNote('');
      setPendingPayload(null);
      Alert.alert('Check-in Berhasil ✓', 'Absensi Anda telah tercatat.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.message ?? 'Check-in gagal. Coba lagi.';
      Alert.alert('Gagal', typeof msg === 'string' ? msg : 'Check-in gagal');
      setUiState('idle');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceService.checkOut({ method: 'manual' }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['checkout-info'] });
      Alert.alert('Check-out Berhasil ✓', 'Sampai jumpa besok!');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const data = err?.response?.data;
      if (data?.canCheckout === false) {
        const h = Math.floor(data.remainingSeconds / 3600);
        const m = Math.floor((data.remainingSeconds % 3600) / 60);
        Alert.alert('Belum Bisa Checkout', `Tersedia dalam ${h}j ${m}m lagi.`);
      } else {
        Alert.alert('Gagal', 'Checkout gagal. Coba lagi.');
      }
    },
  });

  // ── Flow check-in ─────────────────────────────────────────────
  const startCheckIn = useCallback(async () => {
    if (uiState !== 'idle') return; // P1-3: cegah double-tap
    setUiState('verifying_biometric');
    const result = await verifyBiometric();

    if (result.success) {
      // Biometrik OK → cek GPS
      await proceedWithGPS(result.method);
    } else if (result.fallbackToPin) {
      setUiState('show_pin');
    } else {
      Alert.alert('Verifikasi Gagal', result.error);
      setUiState('idle');
    }
  }, [verifyBiometric]);

  const handlePINComplete = useCallback(async (pin: string) => {
    if (uiState !== 'show_pin') return; // P1-3: cegah re-entry
    setUiState('checking_gps');         // langsung lock agar tidak bisa submit lagi
    setPinError(undefined);
    try {
      await api.post('/auth/verify-pin', { pin });
      await proceedWithGPS('pin');
    } catch (err: any) {
      setUiState('show_pin'); // kembalikan agar user bisa coba lagi
      // P1-5: pesan error spesifik per status HTTP
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        setPinError('PIN salah. Coba lagi.');
      } else if (status === 429) {
        setPinError('Terlalu banyak percobaan. Tunggu beberapa menit.');
      } else if (!status) {
        setPinError('Tidak dapat terhubung ke server. Periksa koneksi internet.');
      } else {
        setPinError('Gagal verifikasi. Coba lagi.');
      }
    }
  }, [uiState]);

  const proceedWithGPS = useCallback(async (method: string) => {
    setPendingMethod(method);
    setUiState('checking_gps');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // GPS wajib — izin ditolak, tolak check-in dan minta user aktifkan GPS
        Alert.alert(
          'GPS Diperlukan',
          'Izin lokasi diperlukan untuk check-in. Aktifkan GPS dan coba lagi.',
          [{ text: 'OK', onPress: () => setUiState('idle') }],
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = parseFloat(loc.coords.latitude.toFixed(6));
      const lng = parseFloat(loc.coords.longitude.toFixed(6));
      setPendingCoords({ lat, lng });

      // Cek apakah terlambat melebihi toleransi — wajib isi alasan
      const { isLate } = computeIsLate();
      if (isLate) {
        setPendingPayload({ method, lat, lng });
        setLateNote('');
        setUiState('idle');
        setShowLateModal(true);
        return;
      }

      checkInMutation.mutate({ method, lat, lng });
      setUiState('idle');
    } catch {
      // GPS wajib — jika gagal ambil koordinat, tolak check-in
      Alert.alert(
        'GPS Tidak Tersedia',
        'Tidak dapat mengambil lokasi saat ini. Pastikan GPS aktif, sinyal baik, lalu coba lagi.',
        [{ text: 'OK', onPress: () => setUiState('idle') }],
      );
    }
  }, [checkInMutation, computeIsLate]);

  // ── Render helpers ────────────────────────────────────────────
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statusColor = !attendance?.check_in_at
    ? { bg: isDark ? `${C.orange}18` : '#FFF7ED', border: isDark ? `${C.orange}35` : `${C.orange}30`, text: C.orange }
    : attendance.check_out_at
    ? { bg: isDark ? `${C.green}14` : '#F0FDF4',  border: isDark ? `${C.green}35`  : `${C.green}30`,  text: C.green  }
    : { bg: isDark ? `${C.blue}18`  : '#EFF6FF',  border: isDark ? `${C.blue}35`   : `${C.blue}28`,   text: C.blue   };

  const statusLabel = !attendance?.check_in_at
    ? 'Belum Check-In'
    : attendance.check_out_at
    ? 'Selesai'
    : attendance.status === 'terlambat' ? 'Terlambat' : 'Hadir';

  const formatTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
    : '—';

  const alreadyCheckedIn = !!attendance?.check_in_at;
  const alreadyCheckedOut = !!attendance?.check_out_at;

  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <View style={{ position: 'absolute', inset: 0, backgroundColor: pageBg(isDark) }} />

      {/* Back navigation */}
      <BackHeader title="Absensi" subtitle="Kantor" accentColor={C.blue} />

      {/* Toolbar */}
      <BlurView
        intensity={isDark ? 70 : 75}
        tint={isDark ? 'dark' : 'light'}
        style={{
          marginHorizontal: 16, marginTop: 4, marginBottom: 10,
          borderRadius: 18, overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.95)',
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: isDark ? '#FFFFFF' : '#111111', letterSpacing: -0.3 }}>
            Absensi Kantor
          </Text>
          <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280', marginTop: 2 }}>
            {today}
          </Text>
        </View>
      </BlurView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* ── Status Card ─────────────────────────────────────── */}
        <View style={{
          marginBottom: 12,
          backgroundColor: statusColor.bg,
          borderRadius: R.lg, borderWidth: B.default, borderColor: statusColor.border,
          padding: 18,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: lTertiary(isDark) }}>
              Status Hari Ini
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: statusColor.text }}>
              {loadingAttendance ? '...' : statusLabel}
            </Text>
          </View>

          {attendance?.shift_start && (
            <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.70)' : '#374151', marginBottom: 4 }}>
              {attendance.schedule_type === 'shift' ? 'Shift' : 'Office Hours'} · {attendance.shift_start?.slice(0, 5)} – {attendance.shift_end?.slice(0, 5)} WITA
            </Text>
          )}
          {attendance?.tolerance_minutes && !alreadyCheckedIn && (
            <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280' }}>
              Toleransi s/d {(() => {
                if (!attendance.shift_start) return '—';
                const [h, m] = attendance.shift_start.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m + attendance.tolerance_minutes, 0, 0);
                return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });
              })()} WITA
            </Text>
          )}
          {alreadyCheckedIn && (
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
              <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
                Check-in: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#111111' }}>{formatTime(attendance?.check_in_at)}</Text>
              </Text>
              {alreadyCheckedOut && (
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
                  Check-out: <Text style={{ fontWeight: '600', color: isDark ? '#FFFFFF' : '#111111' }}>{formatTime(attendance?.check_out_at)}</Text>
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Show PIN input ───────────────────────────────────── */}
        {uiState === 'show_pin' && (
          <View style={{ marginBottom: 10 }}>
            <PINInput
              onComplete={handlePINComplete}
              onCancel={() => setUiState('idle')}
              error={pinError}
            />
          </View>
        )}

        {/* ── Biometric / Check-in card ────────────────────────── */}
        {!alreadyCheckedIn && uiState !== 'show_pin' && (
          <BlurView
            intensity={isDark ? 25 : 0}
            tint={isDark ? 'dark' : 'light'}
            style={{
              marginBottom: 12,
              borderRadius: 20, overflow: 'hidden',
              borderWidth: 0.5,
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.07)',
            }}
          >
            <View style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
              padding: 28,
              alignItems: 'center',
            }}>
              {/* Lock icon */}
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: isDark ? 'rgba(0,122,255,0.20)' : '#EFF6FF',
                borderWidth: 0.5,
                borderColor: isDark ? 'rgba(0,122,255,0.40)' : '#BFDBFE',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <Lock size={32} strokeWidth={1.6} color="#007AFF" />
              </View>

              <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#FFFFFF' : '#111111', marginBottom: 6, letterSpacing: -0.3 }}>
                Face ID / Fingerprint
              </Text>
              <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280', textAlign: 'center', marginBottom: 28 }}>
                Verifikasi identitas untuk check-in kantor
              </Text>

              {/* FAB check-in */}
              <TouchableOpacity
                onPress={startCheckIn}
                disabled={uiState === 'verifying_biometric' || checkInMutation.isPending}
                style={{
                  width: '100%', height: 56, borderRadius: 16,
                  backgroundColor: 'rgba(0,122,255,0.90)',
                  borderWidth: 0.5, borderColor: 'rgba(0,122,255,0.60)',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#007AFF', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
                  opacity: (uiState === 'verifying_biometric' || checkInMutation.isPending) ? 0.60 : 1,
                }}
                activeOpacity={0.85}
              >
                {(uiState === 'verifying_biometric' || checkInMutation.isPending) ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
                    Verifikasi Sekarang
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setUiState('show_pin')}
                style={{ marginTop: 16 }}
              >
                <Text style={{ fontSize: 15, color: '#007AFF' }}>
                  Tidak bisa? Gunakan PIN 6 digit
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}

        {/* ── GPS status ───────────────────────────────────────── */}
        <View style={{ marginBottom: 12 }}>
          <GPSValidator
            isLoading={uiState === 'checking_gps'}
            isWithinRadius={gpsResult?.isWithinRadius ?? null}
            distanceMeters={gpsResult?.distanceMeters ?? null}
            accuracy={gpsResult?.accuracy}
          />
        </View>

        {/* ── Checkout card ────────────────────────────────────── */}
        {alreadyCheckedIn && !alreadyCheckedOut && (
          <View style={{
            marginBottom: 12,
            backgroundColor: isDark ? `${C.orange}12` : '#FEFCE8',
            borderRadius: R.lg, borderWidth: B.default,
            borderColor: isDark ? `${C.orange}28` : `${C.orange}30`,
            padding: 20,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: lTertiary(isDark), marginBottom: 8 }}>
              Check-Out
            </Text>

            {timer.canCheckout ? (
              <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.70)' : '#374151', marginBottom: 14 }}>
                Siap checkout sekarang
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.70)' : '#374151', marginBottom: 6 }}>
                  Tersedia pukul {checkoutInfo?.checkoutEarliest
                    ? new Date(checkoutInfo.checkoutEarliest).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })
                    : '—'} WITA
                </Text>
                <Text style={{
                  fontSize: 32, fontWeight: '700',
                  color: isDark ? '#FCD34D' : '#D97706',
                  letterSpacing: -1, marginBottom: 14,
                }}>
                  {timer.displayTime}
                </Text>
              </>
            )}

            <TouchableOpacity
              onPress={() => checkOutMutation.mutate()}
              disabled={!timer.canCheckout || checkOutMutation.isPending}
              style={{
                height: 56, borderRadius: 16,
                backgroundColor: timer.canCheckout
                  ? 'rgba(0,122,255,0.90)'
                  : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                borderWidth: 0.5,
                borderColor: timer.canCheckout ? 'rgba(0,122,255,0.60)' : 'rgba(0,0,0,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}
              activeOpacity={0.85}
            >
              {checkOutMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{
                  fontSize: 17, fontWeight: '700',
                  color: timer.canCheckout ? '#FFFFFF' : isDark ? 'rgba(255,255,255,0.30)' : '#9CA3AF',
                }}>
                  {timer.canCheckout ? 'Check-Out Sekarang' : 'Menunggu 8 Jam...'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sudah checkout ───────────────────────────────────── */}
        {alreadyCheckedOut && (
          <View style={{
            marginBottom: 12,
            backgroundColor: isDark ? `${C.green}12` : '#F0FDF4',
            borderRadius: R.lg, borderWidth: B.default,
            borderColor: isDark ? `${C.green}30` : `${C.green}28`,
            padding: 24, alignItems: 'center',
          }}>
            <View style={{ marginBottom: 8 }}>
              <CheckCircle2 size={40} strokeWidth={1.8} color={C.green} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.green }}>
              Absensi Selesai
            </Text>
            <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280', marginTop: 6 }}>
              {formatTime(attendance?.check_in_at)} – {formatTime(attendance?.check_out_at)}
              {attendance?.overtime_minutes ? ` · Lembur ${attendance.overtime_minutes}m` : ''}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Modal Alasan Terlambat ────────────────────────────────── */}
      <Modal
        visible={showLateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowLateModal(false);
          setLateNote('');
          setPendingPayload(null);
          setUiState('idle');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          {/* Backdrop semi-transparan */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => {
              setShowLateModal(false);
              setLateNote('');
              setPendingPayload(null);
              setUiState('idle');
            }}
          />

          <View style={{
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: insets.bottom + 24,
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          }}>
            {/* Handle bar */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: `${C.orange}18`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={22} strokeWidth={1.8} color={C.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#FFFFFF' : '#111111', letterSpacing: -0.3 }}>
                  Anda Terlambat
                </Text>
                <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280', marginTop: 2 }}>
                  {(() => {
                    const { lateMin } = computeIsLate();
                    return `${lateMin} menit melewati batas toleransi`;
                  })()}
                </Text>
              </View>
            </View>

            {/* Info */}
            <View style={{
              backgroundColor: isDark ? `${C.orange}14` : '#FFF7ED',
              borderRadius: R.md, borderWidth: B.default,
              borderColor: isDark ? `${C.orange}28` : `${C.orange}22`,
              padding: 12, marginBottom: 16,
            }}>
              <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.70)' : '#92400E', lineHeight: 18 }}>
                Sesuai aturan perusahaan, check-in melebihi batas toleransi wajib disertai keterangan alasan keterlambatan.
              </Text>
            </View>

            {/* TextInput alasan */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.60)' : '#374151', marginBottom: 8 }}>
              Alasan keterlambatan <Text style={{ color: C.red }}>*</Text>
            </Text>
            <TextInput
              value={lateNote}
              onChangeText={setLateNote}
              placeholder="Contoh: Macet di jalan tol, ban bocor, urusan keluarga mendadak…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F9FAFB',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: lateNote.length > 0
                  ? (isDark ? 'rgba(0,122,255,0.45)' : 'rgba(0,122,255,0.35)')
                  : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
                padding: 12, fontSize: 15,
                color: isDark ? '#FFFFFF' : '#111111',
                minHeight: 90,
                marginBottom: 6,
              }}
            />
            <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.30)' : '#9CA3AF', textAlign: 'right', marginBottom: 20 }}>
              {lateNote.length}/300
            </Text>

            {/* Tombol kirim */}
            <TouchableOpacity
              onPress={() => {
                if (!pendingPayload) return;
                checkInMutation.mutate({ ...pendingPayload, notes: lateNote.trim() });
              }}
              disabled={lateNote.trim().length < 5 || checkInMutation.isPending}
              style={{
                height: 56, borderRadius: 16,
                backgroundColor: lateNote.trim().length >= 5 ? C.orange : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'),
                alignItems: 'center', justifyContent: 'center',
                opacity: checkInMutation.isPending ? 0.6 : 1,
              }}
              activeOpacity={0.85}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{
                  fontSize: 17, fontWeight: '700',
                  color: lateNote.trim().length >= 5 ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF'),
                }}>
                  Kirim Absensi
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
