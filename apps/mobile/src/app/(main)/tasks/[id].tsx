/**
 * M-04b — Detail Tugas
 * Info lengkap tugas: status, klien, deadline konfirmasi, aksi Terima/Tolak/Tunda/Limpahkan
 */
import { useState, useCallback, Component, type ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, StatusBar, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, AlertTriangle, Calendar, Clock, FileText,
  Building2, MapPin, ArrowUpCircle, ArrowDownCircle, MinusCircle,
  Zap, PauseCircle, CheckCircle2, XCircle, CornerUpRight,
  Search, User, ChevronDown, Check, X as XIcon, Ban, Trash2,
  UserPlus, Target, Radio, Play, Camera, ImagePlus,
  type LucideIcon,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { C, R, B, pageBg, cardBg as tokenCardBg, lPrimary, lSecondary, lTertiary, gradients } from '@/constants/tokens';
import { tasksService, type TaskSummary } from '@/services/tasks.service';
import { visitsService } from '@/services/visits.service';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

interface EmployeeOption { id: string; full_name: string; employee_id?: string; department?: { name?: string } | null }
import { ConfirmCountdown } from '@/components/tasks/ConfirmCountdown';
import NavigationButton from '@/components/tasks/NavigationButton';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<string, { label: string; color: string; bg: string; bgDark: string; Icon: LucideIcon }> = {
  low:    { label: 'Rendah',    color: '#8E8E93', bg: '#8E8E93' + '15', bgDark: '#8E8E93' + '26', Icon: ArrowDownCircle },
  normal: { label: 'Normal',   color: C.blue,   bg: C.blue + '15',   bgDark: C.blue + '26',   Icon: MinusCircle     },
  high:   { label: 'Penting',  color: C.orange, bg: C.orange + '15', bgDark: C.orange + '26', Icon: ArrowUpCircle   },
  urgent: { label: 'Mendadak', color: C.red,    bg: C.red + '15',    bgDark: C.red + '26',    Icon: Zap             },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
  pending_confirmation: { label: 'Menunggu Konfirmasi', color: C.orange, bg: C.orange + '15', bgDark: C.orange + '26' },
  assigned:    { label: 'Ditugaskan',      color: C.blue,   bg: C.blue + '15',   bgDark: C.blue + '26' },
  in_progress: { label: 'Sedang Dikerjakan', color: C.teal, bg: C.teal + '15',   bgDark: C.teal + '26' },
  on_hold:     { label: 'Ditunda',         color: C.orange, bg: C.orange + '15', bgDark: C.orange + '26' },
  rescheduled: { label: 'Dijadwal Ulang',  color: C.purple, bg: C.purple + '15', bgDark: C.purple + '26' },
  completed:   { label: 'Selesai',         color: C.green,  bg: C.green + '15',  bgDark: C.green + '26' },
  cancelled:   { label: 'Dibatalkan',      color: C.red,    bg: C.red + '15',    bgDark: C.red + '26' },
  unassigned:  { label: 'Belum Ditugaskan', color: '#8E8E93', bg: '#8E8E9315', bgDark: '#8E8E9326' },
};

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
class TaskDetailErrorBoundary extends Component<
  { children: ReactNode; onBack: () => void },
  { hasError: boolean; error: string }
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refs: Record<string, any> = {};
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, error: e?.message ?? 'Unknown error' };
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.red, marginBottom: 12, textAlign: 'center' }}>
          Gagal memuat detail tugas
        </Text>
        <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          {this.state.error}
        </Text>
        <TouchableOpacity
          onPress={this.props.onBack}
          style={{ backgroundColor: C.blue, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const HOLD_REASON_LABELS: Record<string, string> = {
  client_absent:        'Klien/PIC tidak ada di lokasi',
  access_denied:        'Tidak bisa masuk gedung/area',
  equipment_broken:     'Peralatan rusak di lokasi',
  material_unavailable: 'Spare part/material belum tersedia',
  client_cancel:        'Klien batalkan sepihak',
  weather:              'Cuaca ekstrem',
  technician_sick:      'Teknisi sakit mendadak',
  other:                'Alasan lain',
};

const HOLD_REASONS = Object.entries(HOLD_REASON_LABELS).map(([value, label]) => ({ value, label }));

// ── Main Screen ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ErrorBoundaryCompat = TaskDetailErrorBoundary as any;
export default function TaskDetailScreen() {
  const _router = useRouter();
  return (
    <ErrorBoundaryCompat onBack={() => _router.back()}>
      <TaskDetailInner />
    </ErrorBoundaryCompat>
  );
}

function TaskDetailInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMode, setAssignMode] = useState<'direct' | 'broadcast'>('direct');
  const [assignUser, setAssignUser] = useState<EmployeeOption | null>(null);
  const [assignUserPickerOpen, setAssignUserPickerOpen] = useState(false);
  const [assignUserSearch, setAssignUserSearch] = useState('');
  const [assignDeptId, setAssignDeptId] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [holdReasonType, setHoldReasonType] = useState('client_absent');
  const [holdNotes, setHoldNotes] = useState('');
  const [holdEvidenceUris, setHoldEvidenceUris] = useState<string[]>([]);
  const [holdEvidenceUrls, setHoldEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [delegateEmployee, setDelegateEmployee] = useState<EmployeeOption | null>(null);
  const [delegateReason, setDelegateReason] = useState('');
  const [delegatePickerOpen, setDelegatePickerOpen] = useState(false);
  const [delegateSearch, setDelegateSearch] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const userRole     = useAuthStore((s) => s.user?.role?.name);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canCancelTask = userRole === 'admin' || userRole === 'super_admin';
  const canDeleteTask = userRole === 'super_admin';
  const canAssignTask = userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager';

  const bg = pageBg(isDark);
  const cardBg = tokenCardBg(isDark);
  const cardBorder = isDark ? C.separator.dark : C.separator.light;
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const inputBorder = isDark ? C.separator.dark : C.separator.light;

  const { data: task, isLoading, refetch } = useQuery({
    queryKey: ['task-detail', id],
    queryFn: () => tasksService.getDetail(id!),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const { data: holds = [] } = useQuery({
    queryKey: ['task-holds', id],
    queryFn: () => tasksService.getHolds(id!),
    enabled: !!id && (task?.status === 'on_hold' || task?.status === 'assigned'),
  });

  // Cek apakah task ini sedang dalam kunjungan berlangsung — tombol "Mulai Kunjungan"
  // diganti "Lanjutkan Kunjungan" agar tidak dobel check-in.
  const { data: ongoingVisitsData } = useQuery({
    queryKey: ['visits-ongoing'],
    queryFn: () => visitsService.getMyVisits({ status: 'ongoing' }),
    enabled: !!id,
  });
  const activeVisitForTask = (ongoingVisitsData?.items ?? []).find((v) => v.task_id === id) ?? null;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['task-detail', id] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  }, [qc, id]);

  const acceptMut = useMutation({
    mutationFn: () => tasksService.accept(id!),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      Alert.alert('Berhasil', 'Tugas berhasil diterima.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const rejectMut = useMutation({
    mutationFn: () => tasksService.reject(id!, rejectReason || undefined),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      setShowRejectModal(false);
      setRejectReason('');
      router.back();
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const holdMut = useMutation({
    mutationFn: () => tasksService.holdTask(id!, {
      reason_type: holdReasonType,
      reason_notes: holdNotes.trim(),
      evidence_urls: holdEvidenceUrls,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      setShowHoldModal(false);
      setHoldNotes('');
      setHoldEvidenceUris([]);
      setHoldEvidenceUrls([]);
      Alert.alert('Penundaan Diajukan', 'Permintaan penundaan telah dikirim ke manajer.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => tasksService.cancelTask(id!, cancelReason.trim()),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setShowCancelModal(false);
      setCancelReason('');
      Alert.alert('Tugas Dibatalkan', 'Tugas telah dibatalkan dan teknisi telah dinotifikasi.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => tasksService.deleteTask(id!),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowDeleteModal(false);
      setDeleteConfirm('');
      Alert.alert('Tugas Dihapus', 'Tugas telah dihapus permanen.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.');
    },
  });

  const assignMut = useMutation({
    mutationFn: (body: { user_id?: string; dept_id?: string }) =>
      tasksService.assignTask(id!, body),
    onSuccess: (_, body) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setShowAssignModal(false);
      setAssignUser(null);
      setAssignUserSearch('');
      setAssignUserPickerOpen(false);
      setAssignDeptId('');
      Alert.alert(
        body.dept_id ? 'Broadcast Terkirim' : 'Tugas Ditugaskan',
        body.dept_id
          ? 'Semua anggota departemen akan menerima notifikasi.'
          : 'Teknisi akan menerima notifikasi untuk mengkonfirmasi tugas.',
      );
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.');
    },
  });

  const { data: assignUsers = [], isFetching: loadingAssignUsers } = useQuery<EmployeeOption[]>({
    queryKey: ['assign-users', assignUserSearch],
    queryFn: () =>
      api
        .get('/users/colleagues', { params: { search: assignUserSearch || undefined } })
        .then((r) => r.data?.items ?? r.data ?? []),
    enabled: showAssignModal && assignMode === 'direct' && assignUserPickerOpen,
    staleTime: 30_000,
  });

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data?.items ?? r.data ?? []),
    enabled: showAssignModal && assignMode === 'broadcast',
    staleTime: 60_000,
  });

  const delegateMut = useMutation({
    mutationFn: () => tasksService.delegate(id!, {
      to_user_id: delegateEmployee?.id ?? '',
      reason: delegateReason.trim(),
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setShowDelegateModal(false);
      setDelegateEmployee(null);
      setDelegateReason('');
      setDelegateSearch('');
      setDelegatePickerOpen(false);
      Alert.alert('Delegasi Dikirim', 'Permintaan delegasi telah dikirim ke manajer untuk disetujui.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const { data: colleagues = [], isFetching: loadingColleagues } = useQuery<EmployeeOption[]>({
    queryKey: ['delegate-colleagues', delegateSearch],
    queryFn: () =>
      api
        .get('/users/colleagues', { params: { search: delegateSearch || undefined } })
        .then((r) => r.data?.items ?? r.data ?? []),
    enabled: showDelegateModal && delegatePickerOpen,
    staleTime: 30_000,
  });

  // ── Check-in Visit (mulai kunjungan) ──────────────────────────────────────
  const checkInMut = useMutation({
    mutationFn: async () => {
      if (!task?.client?.id) throw new Error('Tugas ini tidak memiliki klien. Hubungi manajer untuk penugasan ulang.');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Izin lokasi ditolak. Aktifkan izin GPS di pengaturan.');

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      return visitsService.checkIn({
        task_id: task.id,
        client_id: task.client.id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    },
    onSuccess: (visit) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks-all'] });
      qc.invalidateQueries({ queryKey: ['visits-ongoing'] });
      router.replace(`/(main)/visits/${visit.id}` as never);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal Check-in', err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.');
    },
  });

  const handleStartVisit = useCallback(() => {
    if (!task) return;
    if (!task.client?.id) {
      Alert.alert('Tidak Ada Klien', 'Tugas ini tidak memiliki klien. Hubungi manajer untuk penugasan ulang.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Mulai Kunjungan?',
      `Anda akan check-in di ${task.client.name}.\n\nPastikan Anda sudah tiba di lokasi klien. Koordinat GPS akan tercatat dan tidak bisa diubah.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Mulai', onPress: () => checkInMut.mutate() },
      ],
    );
  }, [task, checkInMut]);

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading || !task) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        {isDark && (
          <LinearGradient colors={gradients.heroTask} style={{ position: 'absolute', inset: 0 }} />
        )}
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  const pm = PRIORITY_META[task.priority] ?? PRIORITY_META.normal;
  const sm = STATUS_META[task.status] ?? STATUS_META.unassigned;
  const isPending = task.status === 'pending_confirmation';
  const isAssigned = task.status === 'assigned';
  const isInProgress = task.status === 'in_progress';
  const isOnHold = task.status === 'on_hold';
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const isAssignee  = task.assignee?.id === currentUserId;
  const cancellable = canCancelTask && !isInProgress && !isCompleted && !isCancelled;
  const assignable  = canAssignTask && task.status === 'unassigned';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {isDark && (
        <LinearGradient
          colors={gradients.heroTask}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>

        {/* ── Back bar ──────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}
          >
            <ChevronLeft size={18} strokeWidth={2.5} color={C.green} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.green }}>Tugas</Text>
          </TouchableOpacity>
        </View>

        {/* ── Header card ───────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 24, borderWidth: 1.5, borderColor: cardBorder, padding: 20 }}>
            {/* Emergency banner */}
            {task.is_emergency && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? C.red + '26' : C.red + '12', borderRadius: 12, padding: 10, marginBottom: 14 }}>
                <AlertTriangle size={16} strokeWidth={2} color={C.red} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.red, flex: 1 }}>Tugas Darurat — Segera Ditangani</Text>
              </View>
            )}

            {/* Priority + Status badges */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? pm.bgDark : pm.bg }}>
                <pm.Icon size={13} strokeWidth={2} color={pm.color} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: pm.color }}>{pm.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? sm.bgDark : sm.bg }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: sm.color }}>{sm.label}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5, lineHeight: 30, marginBottom: 8 }}>
              {task.title}
            </Text>

            {/* Type */}
            {task.type && (
              <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 4 }}>
                Tipe: {task.type}
              </Text>
            )}

            {/* Scheduled */}
            {task.scheduled_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Calendar size={14} strokeWidth={1.8} color={textSecondary as string} />
                <Text style={{ fontSize: 14, color: textSecondary }}>
                  {new Date(task.scheduled_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Makassar',
                    weekday: 'short', day: '2-digit', month: 'long',
                    hour: '2-digit', minute: '2-digit',
                  })} WITA
                </Text>
              </View>
            )}

            {/* Created */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Clock size={14} strokeWidth={1.8} color={textSecondary as string} />
              <Text style={{ fontSize: 13, color: textSecondary }}>
                Dibuat {new Date(task.created_at).toLocaleDateString('id-ID', {
                  timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Confirm countdown ──────────────────────── */}
        {isPending && task.confirm_deadline && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <ConfirmCountdown
              deadline={task.confirm_deadline}
              priority={task.priority as 'normal' | 'high' | 'urgent'}
            />
          </View>
        )}

        {/* ── Description ───────────────────────────── */}
        {task.description && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? C.blue + '33' : C.blue + '14', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} strokeWidth={1.8} color={C.blue} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deskripsi</Text>
              </View>
              <Text style={{ fontSize: 15, color: textPrimary, lineHeight: 22 }}>{task.description}</Text>
            </View>
          </View>
        )}

        {/* ── Client info ───────────────────────────── */}
        {task.client && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? C.orange + '33' : C.orange + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} strokeWidth={1.8} color={C.orange} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Klien</Text>
              </View>

              <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, marginBottom: 4 }}>
                {task.client.name}
              </Text>
              {task.client.address && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                  <MapPin size={14} strokeWidth={1.8} color={textSecondary as string} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 14, color: textSecondary, flex: 1, lineHeight: 20 }}>{task.client.address}</Text>
                </View>
              )}

              {/* Navigation button — sembunyikan saat tugas sudah selesai atau dibatalkan */}
              {task.client.lat && task.client.lng && !isCompleted && !isCancelled && (
                <View style={{ marginTop: 14 }}>
                  <NavigationButton
                    lat={Number(task.client.lat)}
                    lng={Number(task.client.lng)}
                    label={`Navigasi ke ${task.client.name}`}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Pemberi Tugas ─────────────────────────── */}
        {task.creator && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? C.purple + '33' : C.purple + '14', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} strokeWidth={1.8} color={C.purple} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pemberi Tugas</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: textPrimary }}>
                {task.creator.full_name}
              </Text>
              {task.creator.employee_id && (
                <Text style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
                  {task.creator.employee_id}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Escalation info ───────────────────────── */}
        {task.escalated_from && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? C.orange + '1A' : C.orange + '0D', borderRadius: 16, borderWidth: 1.5, borderColor: C.orange + '4D', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ArrowUpCircle size={18} strokeWidth={1.8} color={C.orange} />
              <Text style={{ fontSize: 14, color: C.orange, fontWeight: '600', flex: 1 }}>
                Dieskalasi dari {task.escalated_from}
                {task.escalated_at && ` · ${new Date(task.escalated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' })}`}
              </Text>
            </View>
          </View>
        )}

        {/* ── Hold history ──────────────────────────── */}
        {holds.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? C.orange + '33' : C.orange + '0D', alignItems: 'center', justifyContent: 'center' }}>
                  <PauseCircle size={16} strokeWidth={1.8} color={C.orange} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Riwayat Penundaan</Text>
              </View>
              {holds.map((h, i) => {
                const statusColor = h.review_status === 'approved' ? C.green : h.review_status === 'rejected' ? C.red : C.orange;
                return (
                  <View key={h.id} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary, flex: 1 }}>
                        {HOLD_REASON_LABELS[h.reason_type] ?? h.reason_type}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${statusColor}20` }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor, textTransform: 'capitalize' }}>
                          {h.is_auto_approved ? 'Auto Approved' : h.review_status}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 4, lineHeight: 18 }}>{h.reason_notes}</Text>
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8' }}>
                      {new Date(h.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                      {h.reschedule_date ? ` → Dijadwal ulang ke ${h.reschedule_date}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── In Progress Banner ───────────────────── */}
        {isInProgress && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? C.teal + '1A' : C.teal + '14', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.teal + '4D' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: task.assignee ? 8 : 0 }}>
                <Play size={20} strokeWidth={2} color={C.teal} />
                <Text style={{ color: C.teal, fontWeight: '700', fontSize: 16 }}>Sedang Dikerjakan</Text>
              </View>
              {task.assignee ? (
                <Text style={{ fontSize: 14, color: textPrimary, lineHeight: 20 }}>
                  Teknisi: {task.assignee.full_name}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Action buttons ────────────────────────── */}
        {isPending && (
          <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('Terima Tugas?', `Anda akan menerima tugas "${task.title}".`, [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Terima', onPress: () => acceptMut.mutate() },
                ]);
              }}
              disabled={acceptMut.isPending}
              style={{ backgroundColor: C.green, borderRadius: 18, paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}
            >
              {acceptMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <CheckCircle2 size={20} strokeWidth={2} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Terima Tugas</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowRejectModal(true); }}
              style={{ backgroundColor: isDark ? C.red + '1F' : C.red + '12', borderRadius: 18, paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.red + '59' }}
            >
              <XCircle size={20} strokeWidth={2} color={C.red} />
              <Text style={{ color: C.red, fontWeight: '700', fontSize: 16 }}>Tolak Tugas</Text>
            </TouchableOpacity>
          </View>
        )}

        {isInProgress && isAssignee && (
          <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 14 }}>
            {activeVisitForTask && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace(`/(main)/visits/${activeVisitForTask.id}` as never);
                }}
                activeOpacity={0.85}
                style={{
                  backgroundColor: C.blue, borderRadius: 18, paddingVertical: 17,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  shadowColor: C.blue, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
                }}
              >
                <Play size={20} strokeWidth={2.2} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Lanjutkan Kunjungan</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowHoldModal(true); }}
              style={{ backgroundColor: isDark ? C.orange + '1F' : C.orange + '0D', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.orange + '59' }}
            >
              <PauseCircle size={20} strokeWidth={2} color={C.orange} />
              <Text style={{ color: C.orange, fontWeight: '700', fontSize: 16 }}>Tunda Pekerjaan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDelegateModal(true)}
              style={{ backgroundColor: isDark ? C.purple + '1F' : C.purple + '12', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.purple + '59' }}
            >
              <CornerUpRight size={20} strokeWidth={2} color={C.purple} />
              <Text style={{ color: C.purple, fontWeight: '700', fontSize: 16 }}>Limpahkan Tugas</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAssigned && isAssignee && (
          <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 14 }}>
            {/* Primary: Mulai Kunjungan ATAU Lanjutkan (jika sudah ada kunjungan aktif) */}
            {activeVisitForTask ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace(`/(main)/visits/${activeVisitForTask.id}` as never);
                }}
                activeOpacity={0.85}
                style={{
                  backgroundColor: C.blue, borderRadius: 18, paddingVertical: 17,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  shadowColor: C.blue, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
                }}
              >
                <Play size={20} strokeWidth={2.2} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                  Lanjutkan Kunjungan
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleStartVisit}
                disabled={checkInMut.isPending}
                activeOpacity={0.85}
                style={{
                  backgroundColor: C.green, borderRadius: 18, paddingVertical: 17,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
                  opacity: checkInMut.isPending ? 0.7 : 1,
                }}
              >
                {checkInMut.isPending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Play size={20} strokeWidth={2.2} color="#FFF" />
                }
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                  {checkInMut.isPending ? 'Mengambil lokasi…' : 'Mulai Kunjungan'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Secondary actions */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowHoldModal(true); }}
              style={{ backgroundColor: isDark ? C.orange + '1F' : C.orange + '0D', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.orange + '59' }}
            >
              <PauseCircle size={20} strokeWidth={2} color={C.orange} />
              <Text style={{ color: C.orange, fontWeight: '700', fontSize: 16 }}>Tunda Pekerjaan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDelegateModal(true)}
              style={{ backgroundColor: isDark ? C.purple + '1F' : C.purple + '12', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.purple + '59' }}
            >
              <CornerUpRight size={20} strokeWidth={2} color={C.purple} />
              <Text style={{ color: C.purple, fontWeight: '700', fontSize: 16 }}>Limpahkan Tugas</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? C.green + '1A' : C.green + '14', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.green + '4D' }}>
              <CheckCircle2 size={22} strokeWidth={2} color={C.green} />
              <Text style={{ color: C.green, fontWeight: '700', fontSize: 16 }}>Tugas Selesai</Text>
            </View>
          </View>
        )}

        {/* ── Cancelled banner ──────────────────────── */}
        {isCancelled && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? C.red + '1A' : C.red + '12', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.red + '4D' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: task.cancel_reason ? 8 : 0 }}>
                <Ban size={20} strokeWidth={2} color={C.red} />
                <Text style={{ color: C.red, fontWeight: '700', fontSize: 16 }}>Tugas Dibatalkan</Text>
              </View>
              {task.cancel_reason && (
                <Text style={{ fontSize: 14, color: textPrimary, lineHeight: 20, marginBottom: 4 }}>
                  {task.cancel_reason}
                </Text>
              )}
              {task.cancelled_at && (
                <Text style={{ fontSize: 12, color: textSecondary }}>
                  {task.canceller?.full_name ? `Oleh ${task.canceller.full_name} · ` : ''}
                  {new Date(task.cancelled_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })} WITA
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Admin: Tugaskan ───────────────────────── */}
        {assignable && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setAssignMode('direct');
                setAssignUser(null);
                setAssignUserSearch('');
                setAssignUserPickerOpen(false);
                setAssignDeptId('');
                setShowAssignModal(true);
              }}
              style={{ backgroundColor: C.blue, borderRadius: 18, paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: C.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}
            >
              <UserPlus size={20} strokeWidth={2} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Tugaskan</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: textSecondary, textAlign: 'center', marginTop: 8 }}>
              Pilih individu atau departemen untuk menerima tugas.
            </Text>
          </View>
        )}

        {/* ── Admin: Batalkan Tugas ─────────────────── */}
        {cancellable && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCancelModal(true); }}
              style={{ backgroundColor: isDark ? C.red + '1F' : C.red + '0D', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.red + '59' }}
            >
              <Ban size={20} strokeWidth={2} color={C.red} />
              <Text style={{ color: C.red, fontWeight: '700', fontSize: 16 }}>Batalkan Tugas</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: textSecondary, textAlign: 'center', marginTop: 8 }}>
              Hanya admin / super admin. Tindakan ini akan memberitahu teknisi.
            </Text>
          </View>
        )}

        {/* ── Super Admin: Hapus Permanen ─────────────────── */}
        {canDeleteTask && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowDeleteModal(true); setDeleteConfirm(''); }}
              style={{ backgroundColor: '#DC2626', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              <Trash2 size={20} strokeWidth={2.2} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Hapus Permanen</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: textSecondary, textAlign: 'center', marginTop: 8 }}>
              Hanya super admin. Tugas akan dihapus dari database, tidak dapat dikembalikan.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 6 }}>Tolak Tugas</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Sampaikan alasan penolakan kepada manajer.</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Alasan penolakan (opsional)..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              multiline numberOfLines={3} textAlignVertical="top"
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginBottom: 18 }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowRejectModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => rejectMut.mutate()}
                disabled={rejectMut.isPending}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: C.red, alignItems: 'center' }}
              >
                {rejectMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Tolak Tugas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Hold Modal ────────────────────────────────────────────────────── */}
      <Modal visible={showHoldModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, maxHeight: '82%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 4 }}>Tunda Pekerjaan</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Pilih alasan. Manajer akan dinotifikasi segera.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {HOLD_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setHoldReasonType(r.value)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: holdReasonType === r.value ? C.orange : isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB', backgroundColor: holdReasonType === r.value ? C.orange : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {holdReasonType === r.value && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' }} />}
                  </View>
                  <Text style={{ fontSize: 15, color: textPrimary, flex: 1 }}>{r.label}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                value={holdNotes}
                onChangeText={setHoldNotes}
                placeholder="Keterangan detail (wajib)..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
                multiline numberOfLines={3} textAlignVertical="top"
                style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginTop: 16, marginBottom: 16 }}
              />

              {/* Foto Bukti */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 }}>
                Foto Bukti <Text style={{ fontWeight: '400', textTransform: 'none' }}>(opsional, maks. 3)</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {/* Kamera */}
                <TouchableOpacity
                  disabled={holdEvidenceUris.length >= 3 || evidenceUploading}
                  onPress={async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Izin Diperlukan', 'Akses kamera diperlukan.'); return; }
                    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
                    if (result.canceled || !result.assets[0]) return;
                    const uri = result.assets[0].uri;
                    setEvidenceUploading(true);
                    try {
                      const url = await tasksService.uploadEvidence(uri);
                      setHoldEvidenceUris((p) => [...p, uri]);
                      setHoldEvidenceUrls((p) => [...p, url]);
                    } catch {
                      Alert.alert('Gagal Upload', 'Foto tidak bisa diunggah. Coba lagi.');
                    } finally {
                      setEvidenceUploading(false);
                    }
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', opacity: holdEvidenceUris.length >= 3 ? 0.4 : 1 }}
                >
                  <Camera size={16} strokeWidth={2} color={textSecondary} />
                  <Text style={{ fontSize: 13, color: textPrimary, fontWeight: '600' }}>Kamera</Text>
                </TouchableOpacity>
                {/* Galeri */}
                <TouchableOpacity
                  disabled={holdEvidenceUris.length >= 3 || evidenceUploading}
                  onPress={async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Izin Diperlukan', 'Akses galeri diperlukan.'); return; }
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
                    if (result.canceled || !result.assets[0]) return;
                    const uri = result.assets[0].uri;
                    setEvidenceUploading(true);
                    try {
                      const url = await tasksService.uploadEvidence(uri);
                      setHoldEvidenceUris((p) => [...p, uri]);
                      setHoldEvidenceUrls((p) => [...p, url]);
                    } catch {
                      Alert.alert('Gagal Upload', 'Foto tidak bisa diunggah. Coba lagi.');
                    } finally {
                      setEvidenceUploading(false);
                    }
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', opacity: holdEvidenceUris.length >= 3 ? 0.4 : 1 }}
                >
                  <ImagePlus size={16} strokeWidth={2} color={textSecondary} />
                  <Text style={{ fontSize: 13, color: textPrimary, fontWeight: '600' }}>Galeri</Text>
                </TouchableOpacity>
                {evidenceUploading && <ActivityIndicator color={C.orange} style={{ marginLeft: 4 }} />}
              </View>
              {/* Thumbnail strip */}
              {holdEvidenceUris.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {holdEvidenceUris.map((uri, idx) => (
                    <View key={idx} style={{ position: 'relative' }}>
                      <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                      <TouchableOpacity
                        onPress={() => {
                          setHoldEvidenceUris((p) => p.filter((_, i) => i !== idx));
                          setHoldEvidenceUrls((p) => p.filter((_, i) => i !== idx));
                        }}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <XIcon size={11} strokeWidth={2.5} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowHoldModal(false);
                    setHoldEvidenceUris([]);
                    setHoldEvidenceUrls([]);
                  }}
                  style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}
                >
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!holdNotes.trim()) { Alert.alert('Keterangan Wajib', 'Isi keterangan detail sebelum submit.'); return; }
                    holdMut.mutate();
                  }}
                  disabled={holdMut.isPending || !holdNotes.trim() || evidenceUploading}
                  style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: holdNotes.trim() ? C.orange : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
                >
                  {holdMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: holdNotes.trim() ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Ajukan Tunda</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Cancel Task Modal (admin / super_admin) ──────────────────────── */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 18 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.red + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Ban size={18} strokeWidth={2} color={C.red} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary }}>Batalkan Tugas</Text>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 8 }}>
              Tugas akan ditandai sebagai dibatalkan dan teknisi akan dinotifikasi. Tindakan tidak bisa dibatalkan.
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Alasan Pembatalan *
            </Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Jelaskan alasan pembatalan (min. 5 karakter)..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              multiline numberOfLines={4} textAlignVertical="top" maxLength={500}
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 110, marginBottom: 6 }}
            />
            <Text style={{ fontSize: 11, color: textSecondary, textAlign: 'right', marginBottom: 16 }}>
              {cancelReason.length}/500
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { setShowCancelModal(false); setCancelReason(''); }} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (cancelReason.trim().length < 5) {
                    Alert.alert('Alasan Kurang', 'Alasan pembatalan minimal 5 karakter.');
                    return;
                  }
                  cancelMut.mutate();
                }}
                disabled={cancelMut.isPending || cancelReason.trim().length < 5}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: cancelReason.trim().length >= 5 ? C.red : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
              >
                {cancelMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: cancelReason.trim().length >= 5 ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Batalkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Modal (super_admin) ─────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 18 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Trash2 size={22} strokeWidth={2.2} color="#DC2626" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary }}>Hapus Permanen</Text>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 14 }}>
              Tugas akan dihapus permanen dari database beserta penugasan, riwayat hold, dan delegasi terkait. Kunjungan yang sudah ada akan kehilangan referensi tugas.
            </Text>

            <View style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.10)' : '#FEF2F2', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(220,38,38,0.30)', marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginBottom: 4 }}>⚠ Tidak dapat dibatalkan</Text>
              <Text style={{ fontSize: 12, color: textSecondary, lineHeight: 18 }}>
                Untuk audit trail, gunakan "Batalkan Tugas" — bukan hapus.
              </Text>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>
              Ketik <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#DC2626', fontWeight: '700' }}>HAPUS</Text> untuk mengkonfirmasi
            </Text>
            <TextInput
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="HAPUS"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              autoCapitalize="characters"
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: deleteConfirm === 'HAPUS' ? '#DC2626' : inputBorder, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}
              >
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteMut.mutate()}
                disabled={deleteMut.isPending || deleteConfirm !== 'HAPUS'}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: deleteConfirm === 'HAPUS' ? '#DC2626' : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
              >
                {deleteMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: deleteConfirm === 'HAPUS' ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Hapus</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Assign Modal (admin / super_admin / manager) ─────────────────── */}
      <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 24, maxHeight: '85%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 18 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={18} strokeWidth={2} color={C.blue} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary }}>Tugaskan</Text>
            </View>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 16 }}>
              Tentukan siapa yang akan menerima tugas ini.
            </Text>

            {/* Mode toggle */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {([
                { val: 'direct' as const,    label: 'Individu',  Icon: Target },
                { val: 'broadcast' as const, label: 'Departemen', Icon: Radio  },
              ]).map(({ val, label, Icon }) => {
                const active = assignMode === val;
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => {
                      setAssignMode(val);
                      if (val === 'direct') setAssignDeptId('');
                      else { setAssignUser(null); setAssignUserPickerOpen(false); }
                    }}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
                      borderColor: active ? C.blue : inputBorder,
                      backgroundColor: active ? (isDark ? C.blue + '26' : C.blue + '14') : inputBg,
                    }}
                  >
                    <Icon size={14} strokeWidth={2} color={active ? C.blue : (textSecondary as string)} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: active ? C.blue : textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {assignMode === 'direct' ? (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pilih Teknisi *</Text>
                  {!assignUserPickerOpen && (
                    <TouchableOpacity
                      onPress={() => { setAssignUserPickerOpen(true); setAssignUserSearch(''); }}
                      activeOpacity={0.75}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14 }}
                    >
                      {assignUser ? (
                        <>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.blue + '1F', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={16} strokeWidth={2} color={C.blue} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }} numberOfLines={1}>
                              {assignUser.full_name}
                            </Text>
                            {(assignUser.employee_id || assignUser.department?.name) && (
                              <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                                {[assignUser.employee_id, assignUser.department?.name].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                        </>
                      ) : (
                        <>
                          <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                          <Text style={{ flex: 1, fontSize: 15, color: lTertiary(isDark) }}>Pilih teknisi...</Text>
                        </>
                      )}
                      <ChevronDown size={18} strokeWidth={2} color={lTertiary(isDark)} />
                    </TouchableOpacity>
                  )}

                  {assignUserPickerOpen && (
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: C.blue, paddingHorizontal: 14, paddingVertical: 12 }}>
                        <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                        <TextInput
                          value={assignUserSearch}
                          onChangeText={setAssignUserSearch}
                          placeholder="Cari nama atau NIK..."
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
                          autoFocus
                          style={{ flex: 1, fontSize: 15, color: textPrimary, padding: 0 }}
                        />
                        <TouchableOpacity
                          onPress={() => { setAssignUserPickerOpen(false); setAssignUserSearch(''); }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <XIcon size={16} strokeWidth={2} color={lTertiary(isDark)} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ marginTop: 8, backgroundColor: inputBg, borderRadius: 14, borderWidth: 1, borderColor: inputBorder, maxHeight: 220, overflow: 'hidden' }}>
                        {loadingAssignUsers ? (
                          <ActivityIndicator color={C.blue} style={{ paddingVertical: 20 }} />
                        ) : assignUsers.length === 0 ? (
                          <Text style={{ textAlign: 'center', color: lTertiary(isDark), padding: 16, fontSize: 14 }}>
                            {assignUserSearch ? 'Tidak ada hasil' : 'Tidak ada teknisi'}
                          </Text>
                        ) : (
                          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {assignUsers.map((emp) => {
                              const active = assignUser?.id === emp.id;
                              return (
                                <TouchableOpacity
                                  key={emp.id}
                                  onPress={() => { setAssignUser(emp); setAssignUserPickerOpen(false); setAssignUserSearch(''); }}
                                  activeOpacity={0.7}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: active ? C.blue + '14' : 'transparent', borderBottomWidth: 0.5, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                                >
                                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.blue + '1F', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={15} strokeWidth={2} color={C.blue} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }} numberOfLines={1}>
                                      {emp.full_name}
                                    </Text>
                                    {(emp.employee_id || emp.department?.name) && (
                                      <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                                        {[emp.employee_id, emp.department?.name].filter(Boolean).join(' · ')}
                                      </Text>
                                    )}
                                  </View>
                                  {active && <Check size={16} strokeWidth={2.5} color={C.blue} />}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pilih Departemen *</Text>
                  <View style={{ backgroundColor: inputBg, borderRadius: 14, borderWidth: 1, borderColor: inputBorder, overflow: 'hidden', marginBottom: 14 }}>
                    {departments.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: lTertiary(isDark), padding: 16, fontSize: 14 }}>
                        Tidak ada departemen
                      </Text>
                    ) : (
                      departments.map((d, i) => {
                        const active = assignDeptId === d.id;
                        return (
                          <TouchableOpacity
                            key={d.id}
                            onPress={() => setAssignDeptId(d.id)}
                            activeOpacity={0.7}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: active ? C.blue + '14' : 'transparent', borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                          >
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.blue + '1F', alignItems: 'center', justifyContent: 'center' }}>
                              <Building2 size={15} strokeWidth={2} color={C.blue} />
                            </View>
                            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: textPrimary }}>{d.name}</Text>
                            {active && <Check size={16} strokeWidth={2.5} color={C.blue} />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </>
              )}

              <View style={{ backgroundColor: isDark ? C.blue + '1A' : C.blue + '0D', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: C.blue + '4D' }}>
                <Text style={{ fontSize: 12, color: C.blue, lineHeight: 18 }}>
                  {assignMode === 'direct'
                    ? 'Teknisi menerima notifikasi untuk konfirmasi.'
                    : 'Semua anggota aktif departemen menerima notifikasi — siapa cepat dia dapat.'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowAssignModal(false)}
                  style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}
                >
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (assignMode === 'direct' && !assignUser) { Alert.alert('Pilih Teknisi', 'Pilih teknisi tujuan.'); return; }
                    if (assignMode === 'broadcast' && !assignDeptId) { Alert.alert('Pilih Departemen', 'Pilih departemen tujuan.'); return; }
                    assignMut.mutate(assignMode === 'direct' ? { user_id: assignUser!.id } : { dept_id: assignDeptId });
                  }}
                  disabled={
                    assignMut.isPending ||
                    (assignMode === 'direct' ? !assignUser : !assignDeptId)
                  }
                  style={{
                    flex: 1, paddingVertical: 15, borderRadius: 16,
                    backgroundColor: (assignMode === 'direct' ? assignUser : assignDeptId)
                      ? C.blue
                      : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                    alignItems: 'center',
                  }}
                >
                  {assignMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: (assignMode === 'direct' ? assignUser : assignDeptId) ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>
                      Tugaskan
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delegate Modal ────────────────────────────────────────────────── */}
      <Modal visible={showDelegateModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 4 }}>Limpahkan Tugas</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Manajer akan menyetujui permintaan ini.</Text>

            <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Karyawan Penerima *</Text>

            {/* Selected employee trigger / search input */}
            {!delegatePickerOpen && (
              <TouchableOpacity
                onPress={() => { setDelegatePickerOpen(true); setDelegateSearch(''); }}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
                  borderColor: inputBorder, paddingHorizontal: 14, paddingVertical: 14,
                  marginBottom: 14,
                }}
              >
                {delegateEmployee ? (
                  <>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.purple + '1F', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} strokeWidth={2} color={C.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }} numberOfLines={1}>
                        {delegateEmployee.full_name}
                      </Text>
                      {(delegateEmployee.employee_id || delegateEmployee.department?.name) && (
                        <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                          {[delegateEmployee.employee_id, delegateEmployee.department?.name].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                    <Text style={{ flex: 1, fontSize: 15, color: lTertiary(isDark) }}>
                      Pilih karyawan...
                    </Text>
                  </>
                )}
                <ChevronDown size={18} strokeWidth={2} color={lTertiary(isDark)} />
              </TouchableOpacity>
            )}

            {/* Expanded picker: search + list */}
            {delegatePickerOpen && (
              <View style={{ marginBottom: 14 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
                  borderColor: C.purple, paddingHorizontal: 14, paddingVertical: 12,
                }}>
                  <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                  <TextInput
                    value={delegateSearch}
                    onChangeText={setDelegateSearch}
                    placeholder="Cari nama atau NIK..."
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
                    autoFocus
                    style={{ flex: 1, fontSize: 15, color: textPrimary, padding: 0 }}
                  />
                  <TouchableOpacity
                    onPress={() => { setDelegatePickerOpen(false); setDelegateSearch(''); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <XIcon size={16} strokeWidth={2} color={lTertiary(isDark)} />
                  </TouchableOpacity>
                </View>
                <View style={{
                  marginTop: 8,
                  backgroundColor: inputBg,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  maxHeight: 220,
                  overflow: 'hidden',
                }}>
                  {loadingColleagues ? (
                    <ActivityIndicator color={C.purple} style={{ paddingVertical: 20 }} />
                  ) : colleagues.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: lTertiary(isDark), padding: 16, fontSize: 14 }}>
                      {delegateSearch ? 'Tidak ada hasil' : 'Tidak ada rekan kerja'}
                    </Text>
                  ) : (
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {colleagues.map((emp) => {
                        const active = delegateEmployee?.id === emp.id;
                        return (
                          <TouchableOpacity
                            key={emp.id}
                            onPress={() => {
                              setDelegateEmployee(emp);
                              setDelegatePickerOpen(false);
                              setDelegateSearch('');
                            }}
                            activeOpacity={0.7}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 10,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: active ? C.purple + '14' : 'transparent',
                              borderBottomWidth: 0.5,
                              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            }}
                          >
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.purple + '1F', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={15} strokeWidth={2} color={C.purple} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }} numberOfLines={1}>
                                {emp.full_name}
                              </Text>
                              {(emp.employee_id || emp.department?.name) && (
                                <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                                  {[emp.employee_id, emp.department?.name].filter(Boolean).join(' · ')}
                                </Text>
                              )}
                            </View>
                            {active && <Check size={16} strokeWidth={2.5} color={C.purple} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Alasan Pendelegasian *</Text>
            <TextInput
              value={delegateReason}
              onChangeText={setDelegateReason}
              placeholder="Jelaskan alasan melimpahkan tugas ini..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              multiline numberOfLines={3} textAlignVertical="top"
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginBottom: 18 }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowDelegateModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!delegateEmployee || !delegateReason.trim()) {
                    Alert.alert('Lengkapi Data', 'Karyawan penerima dan alasan wajib diisi.');
                    return;
                  }
                  delegateMut.mutate();
                }}
                disabled={delegateMut.isPending || !delegateEmployee || !delegateReason.trim()}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: (delegateEmployee && delegateReason.trim()) ? C.purple : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
              >
                {delegateMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: (delegateEmployee && delegateReason.trim()) ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Limpahkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
