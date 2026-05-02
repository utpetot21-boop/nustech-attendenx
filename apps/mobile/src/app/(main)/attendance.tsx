/**
 * M-06 · SCREEN ABSENSI KANTOR
 * Check-in via Face ID / Fingerprint → GPS → Server
 * Jika biometrik gagal 3x → PIN 6 digit fallback
 * Checkout terkunci sampai 8 jam sejak check-in
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { BlurView } from 'expo-blur';
import {
  Lock, CheckCircle2, AlarmClock, LogOut, Hourglass, XCircle,
  ChevronRight, ClipboardList, ChevronDown, History,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { attendanceService, type AttendanceRecord, type OfficeGeofence } from '@/services/attendance.service';
import {
  attendanceRequestsService,
  type AttendanceRequest,
  type AttendanceRequestType,
} from '@/services/attendance-requests.service';
import { useBiometric } from '@/hooks/useBiometric';
import { useCheckoutTimer } from '@/hooks/useCheckoutTimer';
import { PINInput } from '@/components/attendance/PINInput';
import { GPSValidator } from '@/components/attendance/GPSValidator';
import { HoldButton } from '@/components/attendance/HoldButton';
import api from '@/services/api';
import { scheduleService, getCurrentWeekString } from '@/services/schedule.service';
import { BackHeader } from '@/components/ui/BackHeader';

type UIState = 'idle' | 'verifying_biometric' | 'show_pin' | 'checking_gps' | 'confirming' | 'done';

// ── Sub-components ──────────────────────────────────────────────
function RequestActionCard({
  type, request, disabled, onPress, isDark,
}: {
  type: AttendanceRequestType;
  request: AttendanceRequest | null;
  disabled?: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const isLate = type === 'late_arrival';
  const accent = isLate ? C.orange : C.purple;
  const label  = isLate ? 'Izin Terlambat' : 'Izin Pulang Awal';
  const Icon   = isLate ? AlarmClock : LogOut;

  // Ada request aktif → tampilkan status
  if (request && request.status !== 'cancelled') {
    const cfg =
      request.status === 'approved' ? { color: C.green,  StatusIcon: CheckCircle2, text: 'Disetujui' } :
      request.status === 'rejected' ? { color: C.red,    StatusIcon: XCircle,      text: 'Ditolak'   } :
                                      { color: C.orange, StatusIcon: Hourglass,    text: 'Menunggu persetujuan' };
    const SIcon = cfg.StatusIcon;
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 10, paddingHorizontal: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        borderRadius: R.md,
        borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }}>
        <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: accent + '16', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} strokeWidth={1.8} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: lPrimary(isDark) }}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <SIcon size={11} strokeWidth={2.2} color={cfg.color} />
            <Text style={{ fontSize: 12, color: cfg.color, fontWeight: '600' }}>{cfg.text}</Text>
          </View>
          {request.status === 'rejected' && request.reviewer_note && (
            <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 2 }} numberOfLines={2}>
              {request.reviewer_note}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Tidak ada request → tombol ajukan
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 10, paddingHorizontal: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        borderRadius: R.md,
        borderWidth: B.default,
        borderColor: disabled
          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
          : accent + '30',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: accent + '16', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} strokeWidth={1.8} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: disabled ? lTertiary(isDark) : lPrimary(isDark) }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}>
          {disabled
            ? (isLate ? 'Sudah check-in' : 'Check-in dahulu')
            : 'Ketuk untuk ajukan'}
        </Text>
      </View>
      <ChevronRight size={16} strokeWidth={2} color={disabled ? lTertiary(isDark) : accent} />
    </TouchableOpacity>
  );
}

function HistoryRow({ req, isDark }: { req: AttendanceRequest; isDark: boolean }) {
  const isLate = req.type === 'late_arrival';
  const accent = isLate ? C.orange : C.purple;
  const Icon   = isLate ? AlarmClock : LogOut;

  const statusCfg =
    req.status === 'approved'  ? { color: C.green,  text: 'Disetujui' } :
    req.status === 'rejected'  ? { color: C.red,    text: 'Ditolak'   } :
    req.status === 'cancelled' ? { color: lTertiary(isDark), text: 'Dibatalkan' } :
                                 { color: C.orange, text: 'Menunggu'  };

  const dateLabel = new Date(req.date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar',
  });

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      paddingVertical: 8, paddingHorizontal: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderRadius: R.sm,
    }}>
      <View style={{ width: 28, height: 28, borderRadius: R.sm - 2, backgroundColor: accent + '14', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} strokeWidth={1.8} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: lPrimary(isDark) }}>
            {isLate ? 'Izin Terlambat' : 'Izin Pulang Awal'}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: statusCfg.color }}>
            {statusCfg.text}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 1 }}>
          {dateLabel}{req.estimated_time ? ` · Est. ${req.estimated_time.slice(0, 5)}` : ''}
        </Text>
        <Text style={{ fontSize: 11, color: lSecondary(isDark), marginTop: 2 }} numberOfLines={2}>
          {req.reason}
        </Text>
      </View>
    </View>
  );
}

export default function AttendanceScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // Terima param dari notifikasi tap (openHistory=1 → auto-expand riwayat permohonan)
  const { openHistory: openHistoryParam } = useLocalSearchParams<{ openHistory?: string }>();

  const [uiState, setUiState] = useState<UIState>('idle');
  const [pendingMethod, setPendingMethod] = useState<string>('face_id');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsResult, setGpsResult] = useState<{ isWithinRadius: boolean; distanceMeters: number; accuracy: number | null } | null>(null);
  const [pinError, setPinError] = useState<string | undefined>(undefined);

  // ── Late note modal ───────────────────────────────────────────
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateNote, setLateNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState<{ method: string; lat: number | null; lng: number | null } | null>(null);

  // ── Permohonan izin (terlambat / pulang awal) ────────────────
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestModalType, setRequestModalType] = useState<AttendanceRequestType>('late_arrival');
  const [requestReason, setRequestReason] = useState('');
  const [requestEstTime, setRequestEstTime] = useState('');
  const [checkOutGpsLoading, setCheckOutGpsLoading] = useState(false);
  const [checkOutGpsResult, setCheckOutGpsResult] = useState<{ isWithinRadius: boolean; distanceMeters: number; accuracy: number | null } | null>(null);
  // openHistoryParam dari notifikasi tap auto-expand riwayat
  const [showHistory, setShowHistory] = useState(openHistoryParam === '1');
  useEffect(() => {
    if (openHistoryParam === '1') setShowHistory(true);
  }, [openHistoryParam]);

  const { verify: verifyBiometric, failCount: biometricFailCount } = useBiometric();

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

  // Koordinat kantor untuk client-side geofence display (cached 10 menit)
  const { data: myOffice } = useQuery<OfficeGeofence>({
    queryKey: ['attendance-my-office'],
    queryFn: () => attendanceService.getMyOffice(),
    staleTime: 10 * 60_000,
  });

  const timer = useCheckoutTimer(
    checkoutInfo?.checkoutEarliest ?? attendance?.checkout_earliest ?? null,
    checkoutInfo?.checkedOut ?? !!attendance?.check_out_at,
  );

  // Permohonan izin — hari ini + riwayat 30 hari terakhir
  const { data: todayRequests = [], refetch: refetchTodayReqs } = useQuery<AttendanceRequest[]>({
    queryKey: ['attendance-requests-today'],
    queryFn: () => attendanceRequestsService.getMyToday(),
    refetchInterval: 30_000,
  });
  const lateRequest  = todayRequests.find(r => r.type === 'late_arrival')    ?? null;
  const earlyRequest = todayRequests.find(r => r.type === 'early_departure') ?? null;

  const { data: historyRequests = [], isLoading: historyLoading } = useQuery<AttendanceRequest[]>({
    queryKey: ['attendance-requests-history'],
    queryFn: () => attendanceRequestsService.getMyRequests(),
    enabled: showHistory,
    staleTime: 60_000,
  });

  const submitRequestMutation = useMutation({
    mutationFn: () => attendanceRequestsService.submit({
      type: requestModalType,
      reason: requestReason.trim(),
      estimated_time: requestEstTime.trim() || undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRequestModal(false);
      setRequestReason('');
      setRequestEstTime('');
      refetchTodayReqs();
      qc.invalidateQueries({ queryKey: ['attendance-requests-history'] });
      qc.invalidateQueries({ queryKey: ['attendance-requests-today'] }); // Beranda juga pakai ini
      Alert.alert('Permohonan Terkirim', 'Menunggu persetujuan admin.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.message ?? 'Gagal mengajukan permohonan';
      Alert.alert('Gagal', typeof msg === 'string' ? msg : 'Gagal mengajukan permohonan');
    },
  });

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
  // Pakai aritmatika UTC+8 (WITA) agar tidak tergantung timezone device
  const computeIsLate = useCallback((): { isLate: boolean; lateMin: number; tolerance: number; shiftStart: string | null } => {
    const shiftStart = attendance?.shift_start ?? todaySchedule?.start_time ?? null;
    const tolerance = attendance?.tolerance_minutes ?? todaySchedule?.tolerance_minutes ?? 0;
    if (!shiftStart) return { isLate: false, lateMin: 0, tolerance, shiftStart: null };
    const parts = shiftStart.split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    if (!Number.isFinite(h) || !Number.isFinite(m)) return { isLate: false, lateMin: 0, tolerance, shiftStart: null };
    // Menit saat ini dalam WITA (UTC+8)
    const witaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const nowMin = witaNow.getUTCHours() * 60 + witaNow.getUTCMinutes();
    const toleranceEndMin = h * 60 + m + tolerance;
    const diffMin = Math.floor(nowMin - toleranceEndMin);
    return { isLate: diffMin > 0, lateMin: Math.max(0, diffMin), tolerance, shiftStart };
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
    onError: (err: any, variables) => {
      const msg = err?.response?.data?.message ?? '';
      // Backend detect terlambat tapi frontend belum (selisih jam device vs server)
      // → tampilkan late modal agar user bisa isi alasan, bukan error alert
      const isLateError = typeof msg === 'string' &&
        (msg.includes('terlambat') || msg.includes('alasan keterlambatan'));

      if (isLateError) {
        setPendingPayload({ method: variables.method, lat: variables.lat, lng: variables.lng });
        setLateNote('');
        setGpsResult(null);
        setUiState('idle');
        setShowLateModal(true);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Gagal', typeof msg === 'string' && msg ? msg : 'Check-in gagal. Coba lagi.');
        setUiState('idle');
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (coords: { lat: number; lng: number }) =>
      attendanceService.checkOut({ method: 'manual', lat: coords.lat, lng: coords.lng }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
      qc.invalidateQueries({ queryKey: ['checkout-info'] });
      setCheckOutGpsResult(null);
      Alert.alert('Check-out Berhasil ✓', 'Sampai jumpa besok!');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCheckOutGpsResult(null);
      const data = err?.response?.data;
      if (data?.canCheckout === false) {
        const h = Math.floor(data.remainingSeconds / 3600);
        const m = Math.floor((data.remainingSeconds % 3600) / 60);
        Alert.alert('Belum Bisa Checkout', `Tersedia dalam ${h}j ${m}m lagi.`);
      } else {
        const msg = data?.message ?? 'Checkout gagal. Coba lagi.';
        Alert.alert('Gagal', typeof msg === 'string' ? msg : 'Checkout gagal. Coba lagi.');
      }
    },
  });

  const handleCheckOut = useCallback(async () => {
    if (checkOutGpsLoading || checkOutMutation.isPending) return;
    setCheckOutGpsLoading(true);
    setCheckOutGpsResult(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'GPS Diperlukan',
          'Izin lokasi diperlukan untuk check-out. Aktifkan GPS dan coba lagi.',
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      if ((loc as any).mocked === true) {
        Alert.alert(
          'GPS Tidak Valid',
          'Terdeteksi penggunaan GPS palsu (mock location). Matikan "Allow mock locations" di developer options dan coba lagi.',
        );
        return;
      }

      const lat = parseFloat(loc.coords.latitude.toFixed(6));
      const lng = parseFloat(loc.coords.longitude.toFixed(6));
      const accuracy = loc.coords.accuracy ?? 999;

      if (accuracy > 150) {
        Alert.alert(
          'Sinyal GPS Lemah',
          `Akurasi GPS tidak cukup (${Math.round(accuracy)}m). Pindah ke area terbuka dan coba lagi.`,
        );
        return;
      }

      // Tampilkan GPSValidator (sama seperti check-in)
      if (myOffice?.lat != null && myOffice?.lng != null) {
        const { calculateDistance } = await import('@nustech/shared');
        const distanceMeters = Math.round(calculateDistance(lat, lng, myOffice.lat, myOffice.lng));
        setCheckOutGpsResult({ isWithinRadius: distanceMeters <= myOffice.radius_meter, distanceMeters, accuracy });
      } else {
        setCheckOutGpsResult({ isWithinRadius: true, distanceMeters: 0, accuracy });
      }

      checkOutMutation.mutate({ lat, lng });
    } catch {
      Alert.alert(
        'GPS Tidak Tersedia',
        'Tidak dapat mengambil lokasi saat ini. Pastikan GPS aktif, sinyal baik, lalu coba lagi.',
      );
    } finally {
      setCheckOutGpsLoading(false);
    }
  }, [checkOutGpsLoading, checkOutMutation, myOffice]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyBiometric]); // proceedWithGPS diakses via closure — didefinisikan setelah callback ini

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState]); // proceedWithGPS diakses via closure — didefinisikan setelah callback ini

  const proceedWithGPS = useCallback(async (method: string) => {
    setPendingMethod(method);
    setUiState('checking_gps');
    setGpsResult(null);

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

      // Deteksi mock location (Android developer options)
      if ((loc as any).mocked === true) {
        Alert.alert(
          'GPS Tidak Valid',
          'Terdeteksi penggunaan GPS palsu (mock location). Matikan "Allow mock locations" di developer options dan coba lagi.',
          [{ text: 'OK', onPress: () => setUiState('idle') }],
        );
        return;
      }

      const lat = parseFloat(loc.coords.latitude.toFixed(6));
      const lng = parseFloat(loc.coords.longitude.toFixed(6));
      const accuracy = loc.coords.accuracy ?? 999;

      // Tolak jika sinyal GPS terlalu lemah (>150m accuracy)
      if (accuracy > 150) {
        Alert.alert(
          'Sinyal GPS Lemah',
          `Akurasi GPS tidak cukup (${Math.round(accuracy)}m). Pindah ke area terbuka dan coba lagi.`,
          [{ text: 'OK', onPress: () => setUiState('idle') }],
        );
        return;
      }

      setPendingCoords({ lat, lng });

      // Client-side geofence display (backend tetap authoritative)
      if (myOffice?.lat != null && myOffice?.lng != null) {
        const { calculateDistance } = await import('@nustech/shared');
        const distanceMeters = Math.round(calculateDistance(lat, lng, myOffice.lat, myOffice.lng));
        setGpsResult({
          isWithinRadius: distanceMeters <= myOffice.radius_meter,
          distanceMeters,
          accuracy,
        });
      } else {
        // Tidak ada config geofence di backend — tampilkan sekedar "GPS acquired"
        setGpsResult({ isWithinRadius: true, distanceMeters: 0, accuracy });
      }

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
  }, [checkInMutation, computeIsLate, myOffice]);

  // ── Render helpers ────────────────────────────────────────────
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Makassar',
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

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const ms = new Date(iso).getTime();
    if (isNaN(ms)) return '—';
    const w = new Date(ms + 8 * 60 * 60 * 1000);
    return `${String(w.getUTCHours()).padStart(2, '0')}:${String(w.getUTCMinutes()).padStart(2, '0')}`;
  };

  const alreadyCheckedIn = !!attendance?.check_in_at;
  const alreadyCheckedOut = !!attendance?.check_out_at;

  // Hitung deadline pengajuan izin terlambat (15 menit sebelum shift)
  // Pakai aritmatika UTC+8 (WITA) agar tidak tergantung timezone device
  const lateDeadlineInfo = useMemo(() => {
    if (alreadyCheckedIn) return null;
    const shiftStart = attendance?.shift_start ?? todaySchedule?.start_time ?? null;
    if (!shiftStart) return null;
    const [h, m] = shiftStart.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const witaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const nowMin = witaNow.getUTCHours() * 60 + witaNow.getUTCMinutes();
    const deadlineMin = h * 60 + m - 15;
    const passed = nowMin >= deadlineMin;
    const dh = Math.floor(((deadlineMin % 1440) + 1440) % 1440 / 60);
    const dm = ((deadlineMin % 60) + 60) % 60;
    const deadlineStr = `${String(dh).padStart(2, '0')}:${String(dm).padStart(2, '0')}`;
    return { passed, deadlineStr };
  }, [attendance, todaySchedule, alreadyCheckedIn]);

  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: pageBg(isDark) }} />

      {/* Back navigation */}
      <BackHeader title="Absensi" subtitle="Kantor" accentColor={C.blue} />

      {/* Toolbar */}
      <BlurView
        intensity={isDark ? 70 : 75}
        tint={isDark ? 'dark' : 'light'}
        style={{
          marginHorizontal: 16, marginTop: 4, marginBottom: 10,
          borderRadius: 18, overflow: 'hidden',
          borderWidth: B.glass,
          borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.95)',
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: lPrimary(isDark), letterSpacing: -0.3 }}>
            Absensi Kantor
          </Text>
          <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
            {today}
          </Text>
        </View>
      </BlurView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
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
            <Text style={{ fontSize: 14, color: lSecondary(isDark) }}>
              Toleransi s/d {(() => {
                if (!attendance.shift_start) return '—';
                const [h, m] = attendance.shift_start.split(':').map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return '—';
                // shift_start sudah WITA — cukup tambah menit toleransi, tanpa Date object
                const totalMin = ((h * 60 + m + (attendance.tolerance_minutes ?? 0)) % 1440 + 1440) % 1440;
                const th = Math.floor(totalMin / 60);
                const tm = totalMin % 60;
                return `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`;
              })()} WITA
            </Text>
          )}
          {alreadyCheckedIn && (
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
              <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
                Check-in: <Text style={{ fontWeight: '600', color: lPrimary(isDark) }}>{formatTime(attendance?.check_in_at)}</Text>
              </Text>
              {alreadyCheckedOut && (
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
                  Check-out: <Text style={{ fontWeight: '600', color: lPrimary(isDark) }}>{formatTime(attendance?.check_out_at)}</Text>
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
              borderRadius: R.lg, overflow: 'hidden',
              borderWidth: B.glass,
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
                backgroundColor: isDark ? C.blue + '33' : C.blue + '14',
                borderWidth: B.glass,
                borderColor: isDark ? C.blue + '66' : C.blue + '40',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <Lock size={32} strokeWidth={1.6} color={C.blue} />
              </View>

              <Text style={{ fontSize: 18, fontWeight: '600', color: lPrimary(isDark), marginBottom: 6, letterSpacing: -0.3 }}>
                Face ID / Fingerprint
              </Text>
              <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280', textAlign: 'center', marginBottom: biometricFailCount > 0 ? 14 : 28 }}>
                Verifikasi identitas untuk check-in kantor
              </Text>

              {/* Biometric attempt dots */}
              {biometricFailCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={{
                        width: 10, height: 10, borderRadius: 5,
                        backgroundColor: i < biometricFailCount ? C.red : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                      }}
                    />
                  ))}
                  <Text style={{ fontSize: 12, color: C.red, fontWeight: '600', marginLeft: 4 }}>
                    {3 - biometricFailCount} percobaan tersisa
                  </Text>
                </View>
              )}

              {/* FAB check-in — hold press */}
              <HoldButton
                onComplete={startCheckIn}
                disabled={uiState === 'verifying_biometric' || checkInMutation.isPending}
                loading={uiState === 'verifying_biometric' || checkInMutation.isPending}
                label="Absen Masuk"
                sublabel="Tahan untuk absen"
                color={C.blue}
                isDark={isDark}
              />

              <TouchableOpacity
                onPress={() => { setPinError(undefined); setUiState('show_pin'); }}
                style={{ marginTop: 8 }}
              >
                <Text style={{ fontSize: 15, color: C.blue }}>
                  Tidak bisa? Gunakan PIN 6 digit
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}

        {/* ── GPS status ───────────────────────────────────────── */}
        {(uiState === 'checking_gps' || gpsResult) && !alreadyCheckedIn && (
          <View style={{ marginBottom: 12 }}>
            <GPSValidator
              isLoading={uiState === 'checking_gps'}
              isWithinRadius={gpsResult?.isWithinRadius ?? null}
              distanceMeters={gpsResult?.distanceMeters ?? null}
              accuracy={gpsResult?.accuracy}
              officeName={myOffice?.office_name ?? 'Kantor'}
            />
          </View>
        )}

        {/* ── Checkout card ────────────────────────────────────── */}
        {alreadyCheckedIn && !alreadyCheckedOut && (() => {
          // Trust server override — kalau izin pulang awal approved, BE return canCheckout=true
          // walau belum 8 jam. FE tidak boleh lock berdasarkan timer lokal saja.
          const canCheckout = checkoutInfo?.canCheckout === true || timer.canCheckout;
          const approvedEarly = checkoutInfo?.canCheckout === true && !timer.canCheckout;
          return (
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

            {canCheckout ? (
              <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.70)' : '#374151', marginBottom: 14 }}>
                {approvedEarly ? 'Izin pulang awal disetujui · siap checkout' : 'Siap checkout sekarang'}
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.70)' : '#374151', marginBottom: 6 }}>
                  Tersedia pukul {checkoutInfo?.checkoutEarliest
                    ? formatTime(checkoutInfo.checkoutEarliest)
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

            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <HoldButton
                onComplete={handleCheckOut}
                disabled={!canCheckout || checkOutMutation.isPending || checkOutGpsLoading}
                loading={checkOutMutation.isPending || checkOutGpsLoading}
                label={canCheckout ? 'Absen Pulang' : 'Menunggu 8 Jam...'}
                sublabel={canCheckout ? 'Tahan untuk absen' : undefined}
                color={canCheckout ? C.blue : (isDark ? 'rgba(255,255,255,0.25)' : '#9CA3AF')}
                isDark={isDark}
              />
            </View>
          </View>
          );
        })()}

        {/* ── GPS status check-out ────────────────────────────── */}
        {(checkOutGpsLoading || checkOutGpsResult) && alreadyCheckedIn && !alreadyCheckedOut && (
          <View style={{ marginBottom: 12 }}>
            <GPSValidator
              isLoading={checkOutGpsLoading}
              isWithinRadius={checkOutGpsResult?.isWithinRadius ?? null}
              distanceMeters={checkOutGpsResult?.distanceMeters ?? null}
              accuracy={checkOutGpsResult?.accuracy}
              officeName={myOffice?.office_name ?? 'Kantor'}
            />
          </View>
        )}

        {/* ── Permohonan Izin Absen ───────────────────────────── */}
        <View style={{
          marginBottom: 12,
          backgroundColor: cardBg(isDark),
          borderRadius: R.lg,
          borderWidth: B.default,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          padding: 16,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
            letterSpacing: 1, color: lTertiary(isDark), marginBottom: 12,
          }}>
            Permohonan Izin Absen
          </Text>

          {/* Card: Izin Terlambat */}
          <RequestActionCard
            type="late_arrival"
            request={lateRequest}
            disabled={alreadyCheckedIn}
            onPress={() => {
              if (lateDeadlineInfo?.passed) {
                Alert.alert(
                  'Batas Waktu Terlewat',
                  `Izin terlambat hanya bisa diajukan sebelum pukul ${lateDeadlineInfo.deadlineStr} (15 menit sebelum shift). Pengajuan sekarang kemungkinan akan ditolak.`,
                  [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Tetap Ajukan', onPress: () => { setRequestModalType('late_arrival'); setRequestReason(''); setRequestEstTime(''); setShowRequestModal(true); } },
                  ],
                );
                return;
              }
              setRequestModalType('late_arrival');
              setRequestReason('');
              setRequestEstTime('');
              setShowRequestModal(true);
            }}
            isDark={isDark}
          />
          {/* Hint deadline — tampil hanya jika belum check-in dan ada jadwal */}
          {!alreadyCheckedIn && lateDeadlineInfo && !lateRequest && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, paddingHorizontal: 4 }}>
              <AlarmClock size={11} strokeWidth={2} color={lateDeadlineInfo.passed ? C.red : lTertiary(isDark)} />
              <Text style={{ fontSize: 11, color: lateDeadlineInfo.passed ? C.red : lTertiary(isDark), fontWeight: lateDeadlineInfo.passed ? '700' : '400' }}>
                {lateDeadlineInfo.passed
                  ? `Batas pengajuan terlewat (sebelum ${lateDeadlineInfo.deadlineStr})`
                  : `Ajukan sebelum pukul ${lateDeadlineInfo.deadlineStr} WITA`}
              </Text>
            </View>
          )}

          {/* Card: Izin Pulang Awal */}
          <View style={{ marginTop: 8 }}>
            <RequestActionCard
              type="early_departure"
              request={earlyRequest}
              disabled={!alreadyCheckedIn || alreadyCheckedOut}
              onPress={() => {
                setRequestModalType('early_departure');
                setRequestReason('');
                setRequestEstTime('');
                setShowRequestModal(true);
              }}
              isDark={isDark}
            />
          </View>

          {/* Toggle Riwayat */}
          <TouchableOpacity
            onPress={() => setShowHistory(v => !v)}
            activeOpacity={0.7}
            style={{
              marginTop: 14, paddingTop: 12,
              borderTopWidth: B.default,
              borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={14} strokeWidth={2} color={lSecondary(isDark)} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>
                Riwayat Permohonan
              </Text>
            </View>
            <ChevronDown
              size={16} strokeWidth={2} color={lTertiary(isDark)}
              style={{ transform: [{ rotate: showHistory ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {/* Riwayat list */}
          {showHistory && (
            <View style={{ marginTop: 10, gap: 8 }}>
              {historyLoading ? (
                <ActivityIndicator color={C.blue} style={{ paddingVertical: 16 }} />
              ) : historyRequests.length === 0 ? (
                <Text style={{ fontSize: 13, color: lTertiary(isDark), textAlign: 'center', paddingVertical: 16 }}>
                  Belum ada permohonan.
                </Text>
              ) : (
                historyRequests.slice(0, 30).map((req) => (
                  <HistoryRow key={req.id} req={req} isDark={isDark} />
                ))
              )}
            </View>
          )}
        </View>

        {/* ── Link Riwayat Absensi ──────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/(main)/attendance-history')}
          activeOpacity={0.7}
          style={{
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cardBg(isDark),
            borderRadius: R.lg,
            borderWidth: B.default,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{
            width: 38, height: 38, borderRadius: R.sm,
            backgroundColor: C.blue + '1F',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <History size={18} strokeWidth={2} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: lPrimary(isDark), letterSpacing: -0.2 }}>
              Riwayat Absensi
            </Text>
            <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 2 }}>
              Lihat catatan check-in & check-out bulan-bulan sebelumnya
            </Text>
          </View>
          <ChevronRight size={16} strokeWidth={2} color={lTertiary(isDark)} />
        </TouchableOpacity>

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
            <Text style={{ fontSize: 14, color: lSecondary(isDark), marginTop: 6 }}>
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
          setGpsResult(null);
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
              setGpsResult(null);
              setUiState('idle');
            }}
          />

          <View style={{
            backgroundColor: cardBg(isDark),
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
                <Text style={{ fontSize: 18, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.3 }}>
                  Anda Terlambat
                </Text>
                <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                  {(() => {
                    const { lateMin, tolerance, shiftStart } = computeIsLate();
                    const scheduleInfo = shiftStart ? ` · jadwal ${shiftStart}` : '';
                    return `Terlambat ${lateMin} menit (toleransi ${tolerance}m${scheduleInfo})`;
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
                color: lPrimary(isDark),
                minHeight: 90,
                marginBottom: 6,
              }}
            />
            <Text style={{ fontSize: 11, color: lTertiary(isDark), textAlign: 'right', marginBottom: 20 }}>
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
                  color: lateNote.trim().length >= 5 ? '#FFFFFF' : lTertiary(isDark),
                }}>
                  Kirim Absensi
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Permohonan Izin ───────────────────────────────── */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => setShowRequestModal(false)}
          />
          <View style={{
            backgroundColor: cardBg(isDark),
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: insets.bottom + 24,
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: (requestModalType === 'late_arrival' ? C.orange : C.purple) + '16',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {requestModalType === 'late_arrival'
                  ? <AlarmClock size={22} strokeWidth={1.8} color={C.orange} />
                  : <LogOut     size={22} strokeWidth={1.8} color={C.purple} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.3 }}>
                  {requestModalType === 'late_arrival' ? 'Ajukan Izin Terlambat' : 'Ajukan Izin Pulang Awal'}
                </Text>
                <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                  Permohonan akan diproses oleh admin
                </Text>
              </View>
            </View>

            {/* Constraint info */}
            {requestModalType === 'late_arrival' && lateDeadlineInfo && (
              <View style={{
                backgroundColor: lateDeadlineInfo.passed
                  ? (isDark ? `${C.red}14` : '#FFF1F2')
                  : (isDark ? `${C.orange}14` : '#FFF7ED'),
                borderRadius: R.md, borderWidth: B.default,
                borderColor: lateDeadlineInfo.passed
                  ? (isDark ? `${C.red}28` : `${C.red}22`)
                  : (isDark ? `${C.orange}28` : `${C.orange}22`),
                padding: 10, marginBottom: 14,
                flexDirection: 'row', alignItems: 'flex-start', gap: 8,
              }}>
                <View style={{ marginTop: 1 }}>
                  <AlarmClock size={14} strokeWidth={2} color={lateDeadlineInfo.passed ? C.red : C.orange} />
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: lateDeadlineInfo.passed
                  ? (isDark ? '#FCA5A5' : '#991B1B')
                  : (isDark ? '#FCD34D' : '#92400E'), lineHeight: 17 }}>
                  {lateDeadlineInfo.passed
                    ? `Batas pengajuan telah lewat (sebelum ${lateDeadlineInfo.deadlineStr} WITA). Permohonan kemungkinan ditolak oleh admin.`
                    : `Ajukan sebelum pukul ${lateDeadlineInfo.deadlineStr} WITA (15 menit sebelum shift). Permohonan yang masuk tepat waktu lebih mudah disetujui.`}
                </Text>
              </View>
            )}
            {requestModalType === 'early_departure' && (
              <View style={{
                backgroundColor: isDark ? `${C.purple}14` : '#FAF5FF',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: isDark ? `${C.purple}28` : `${C.purple}22`,
                padding: 10, marginBottom: 14,
                flexDirection: 'row', alignItems: 'flex-start', gap: 8,
              }}>
                <View style={{ marginTop: 1 }}>
                  <LogOut size={14} strokeWidth={2} color={C.purple} />
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#E9D5FF' : '#6B21A8', lineHeight: 17 }}>
                  Permohonan izin pulang awal perlu disetujui admin sebelum checkout. Pastikan alasan valid dan estimasi waktu diisi.
                </Text>
              </View>
            )}

            {/* Alasan */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 8 }}>
              Alasan <Text style={{ color: C.red }}>*</Text>
            </Text>
            <TextInput
              value={requestReason}
              onChangeText={setRequestReason}
              placeholder="Contoh: Ada urusan keluarga mendadak"
              placeholderTextColor={lTertiary(isDark)}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F9FAFB',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                padding: 12, fontSize: 15, color: lPrimary(isDark),
                minHeight: 80,
                marginBottom: 16,
              }}
            />

            {/* Estimasi waktu */}
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
              maxLength={5}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F9FAFB',
                borderRadius: R.md, borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                padding: 12, fontSize: 15, color: lPrimary(isDark),
                marginBottom: 24,
              }}
            />

            {/* Tombol */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}
                disabled={submitRequestMutation.isPending}
                style={{
                  flex: 1, height: 52, borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: lSecondary(isDark) }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => submitRequestMutation.mutate()}
                disabled={submitRequestMutation.isPending || requestReason.trim().length < 5}
                style={{
                  flex: 2, height: 52, borderRadius: 16,
                  backgroundColor: requestModalType === 'late_arrival' ? C.orange : C.purple,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: (submitRequestMutation.isPending || requestReason.trim().length < 5) ? 0.5 : 1,
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
