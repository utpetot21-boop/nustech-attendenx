/**
 * M-04 — Tugas & Dispatch
 * List tugas yang ditugaskan ke user dengan terima/tolak/tunda
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Toast } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  XCircle,
  Zap,
  PauseCircle,
  ArrowUpRight,
  ClipboardList,
} from 'lucide-react-native';
import { C, R, B, T, S, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { FilterChips } from '@/components/ui/FilterChips';
import { BackHeader } from '@/components/ui/BackHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, type TaskSummary, type HoldTaskPayload } from '@/services/tasks.service';
import { TaskCard } from '@/components/tasks/TaskCard';
import * as Location from 'expo-location';
import { TaskCardSkeleton } from '@/components/ui/SkeletonLoader';
import * as Haptics from 'expo-haptics';

const HOLD_REASONS = [
  { value: 'client_absent', label: 'Klien/PIC tidak ada di lokasi' },
  { value: 'access_denied', label: 'Tidak bisa masuk gedung/area' },
  { value: 'equipment_broken', label: 'Peralatan rusak di lokasi' },
  { value: 'material_unavailable', label: 'Spare part/material belum tersedia' },
  { value: 'client_cancel', label: 'Klien batalkan sepihak' },
  { value: 'weather', label: 'Cuaca ekstrem' },
  { value: 'technician_sick', label: 'Teknisi sakit mendadak' },
  { value: 'other', label: 'Alasan lain' },
];

const STATUS_FILTERS = [
  { label: 'Semua', value: undefined },
  { label: 'Menunggu', value: 'pending_confirmation' },
  { label: 'Ditugaskan', value: 'assigned' },
  { label: 'Ditunda', value: 'on_hold' },
];

export default function TasksScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const { toast, hide: hideToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLng, setUserLng] = useState<number | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [holdReasonType, setHoldReasonType] = useState('client_absent');
  const [holdNotes, setHoldNotes] = useState('');
  const [delegateToUserId, setDelegateToUserId] = useState('');
  const [delegateReason, setDelegateReason] = useState('');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () => tasksService.getMyTasks({ status: statusFilter }),
    refetchInterval: 15000, // 15s live update for countdowns
  });

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => tasksService.accept(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toastSuccess('Tugas berhasil diterima.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(err.message ?? 'Gagal menerima tugas.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      tasksService.reject(id, reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowRejectModal(false);
      setRejectReason('');
      toastSuccess('Tugas berhasil ditolak.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(err.message ?? 'Gagal menolak tugas.');
    },
  });

  const holdMutation = useMutation({
    mutationFn: (payload: HoldTaskPayload & { id: string }) =>
      tasksService.holdTask(payload.id, {
        reason_type: payload.reason_type,
        reason_notes: payload.reason_notes,
        evidence_urls: payload.evidence_urls,
        visit_id: payload.visit_id,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowHoldModal(false);
      setHoldNotes('');
      toastWarning('Permintaan penundaan dikirim ke manajer.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(err.message ?? 'Gagal mengajukan tunda.');
    },
  });

  const delegateMutation = useMutation({
    mutationFn: ({ id, to_user_id, reason }: { id: string; to_user_id: string; reason: string }) =>
      tasksService.delegate(id, { to_user_id, reason }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setShowDelegateModal(false);
      toastSuccess('Permintaan delegasi dikirim ke manajer.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(err.message ?? 'Gagal mendelegasikan tugas.');
    },
  });

  const handleAccept = (task: TaskSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Terima Tugas?',
      `Anda akan menerima tugas "${task.title}".`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Terima',
          onPress: () => acceptMutation.mutate(task.id),
        },
      ],
    );
  };

  const handleRejectOpen = (task: TaskSummary) => {
    setSelectedTask(task);
    setShowRejectModal(true);
  };

  const handleHoldOpen = (task: TaskSummary) => {
    setSelectedTask(task);
    setShowHoldModal(true);
  };

  const handleDelegateOpen = (task: TaskSummary) => {
    setSelectedTask(task);
    setDelegateToUserId('');
    setDelegateReason('');
    setShowDelegateModal(true);
  };

  const urgentTasks = (data?.items ?? []).filter((t) => t.priority === 'urgent');
  const otherTasks = (data?.items ?? []).filter((t) => t.priority !== 'urgent');

  const bg = pageBg(isDark);
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={C.blue}
          />
        }
      >
        {/* Header */}
        <BackHeader
          title="Tugas"
          subtitle={`${data?.total ?? 0} tugas ditugaskan`}
          accentColor={C.green}
        />

        {/* Filter chips */}
        <FilterChips
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          accentColor={C.green}
          isDark={isDark}
        />

        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <TaskCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : (
          <>
            {/* Urgent section */}
            {urgentTasks.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 20,
                    paddingBottom: 10,
                  }}
                >
                  <Zap size={14} strokeWidth={2.2} color="#FF3B30" />
                  <Text style={{ ...T.sectionLabel, color: C.red }}>
                    MENDADAK
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,59,48,0.25)', borderRadius: 1 }} />
                </View>
                {urgentTasks.map((task) => (
                  <View key={task.id}>
                    <TaskCard
                      task={task}
                      onPress={() => router.push(`/(main)/tasks/${task.id}` as never)}
                      userLat={userLat}
                      userLng={userLng}
                    />
                    {task.status === 'pending_confirmation' && (
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          marginHorizontal: 20,
                          marginTop: 2,
                          marginBottom: 12,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => handleAccept(task)}
                          disabled={acceptMutation.isPending}
                          style={{
                            flex: 1,
                            backgroundColor: C.green,
                            borderRadius: 14,
                            paddingVertical: 13,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <CheckCircle2 size={16} strokeWidth={2.2} color="#FFF" />
                          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Terima</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRejectOpen(task)}
                          style={{
                            flex: 1,
                            backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FEF2F2',
                            borderRadius: 14,
                            paddingVertical: 13,
                            alignItems: 'center',
                            borderWidth: B.default,
                            borderColor: 'rgba(255,59,48,0.4)',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <XCircle size={16} strokeWidth={2} color={C.red} />
                          <Text style={{ color: C.red, fontWeight: '600', fontSize: 14 }}>Tolak</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Other tasks */}
            {otherTasks.length === 0 && urgentTasks.length === 0 ? (
              <View style={{ paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
                <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: isDark ? 'rgba(52,199,89,0.15)' : '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <CheckCircle2 size={36} strokeWidth={1.6} color="#34C759" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.7)' : '#374151', textAlign: 'center' }}>
                  Tidak ada tugas
                </Text>
                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                  Tugas yang ditugaskan ke Anda akan muncul di sini.
                </Text>
              </View>
            ) : (
              otherTasks.map((task) => (
                <View key={task.id}>
                  <TaskCard
                    task={task}
                    onPress={() => router.push(`/(main)/tasks/${task.id}` as never)}
                    userLat={userLat}
                    userLng={userLng}
                  />
                  {task.status === 'pending_confirmation' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 2, marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={() => handleAccept(task)}
                        disabled={acceptMutation.isPending}
                        style={{ flex: 1, backgroundColor: C.green, borderRadius: 14, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      >
                        <CheckCircle2 size={16} strokeWidth={2.2} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Terima</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRejectOpen(task)}
                        style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FEF2F2', borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: B.default, borderColor: 'rgba(255,59,48,0.4)', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      >
                        <XCircle size={16} strokeWidth={2} color="#FF3B30" />
                        <Text style={{ color: C.red, fontWeight: '600', fontSize: 14 }}>Tolak</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {task.status === 'assigned' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 2, marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={() => handleHoldOpen(task)}
                        style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFFBEB', borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: B.default, borderColor: 'rgba(255,149,0,0.4)', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      >
                        <PauseCircle size={16} strokeWidth={2} color={C.orange} />
                        <Text style={{ color: C.orange, fontWeight: '600', fontSize: 14 }}>Tunda</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelegateOpen(task)}
                        style={{ flex: 1, backgroundColor: isDark ? 'rgba(175,82,222,0.15)' : '#F5F3FF', borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: B.default, borderColor: 'rgba(175,82,222,0.4)', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                      >
                        <ArrowUpRight size={16} strokeWidth={2} color={C.purple} />
                        <Text style={{ color: C.purple, fontWeight: '600', fontSize: 14 }}>Limpahkan</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFF',
              borderRadius: R.sheet,
              padding: 20,
              paddingBottom: 36,
            }}
          >
            <Text
              style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#FFF' : '#111', marginBottom: 16 }}
            >
              Tolak Tugas
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Alasan penolakan (opsional)..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: isDark ? '#FFF' : '#111',
                marginBottom: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: isDark ? '#FFF' : '#111', fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selectedTask) {
                    rejectMutation.mutate({ id: selectedTask.id, reason: rejectReason || undefined });
                  }
                }}
                disabled={rejectMutation.isPending}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: C.red,
                  alignItems: 'center',
                }}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Tolak Tugas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delegate Modal */}
      <Modal visible={showDelegateModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFF',
              borderRadius: R.sheet,
              padding: 20,
              paddingBottom: 36,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#FFF' : '#111', marginBottom: 4 }}>
              Limpahkan Tugas
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', marginBottom: 16 }}>
              Delegasikan "{selectedTask?.title}" ke rekan lain. Manajer akan menyetujui permintaan ini.
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#374151', marginBottom: 6 }}>
              ID Penerima (User ID)
            </Text>
            <TextInput
              value={delegateToUserId}
              onChangeText={setDelegateToUserId}
              placeholder="UUID karyawan tujuan..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: isDark ? '#FFF' : '#111',
                marginBottom: 12,
              }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#374151', marginBottom: 6 }}>
              Alasan Pendelegasian *
            </Text>
            <TextInput
              value={delegateReason}
              onChangeText={setDelegateReason}
              placeholder="Jelaskan alasan melimpahkan tugas ini..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: isDark ? '#FFF' : '#111',
                marginBottom: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowDelegateModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: isDark ? '#FFF' : '#111', fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!selectedTask || !delegateToUserId.trim() || !delegateReason.trim()) {
                    Alert.alert('Lengkapi Data', 'ID penerima dan alasan wajib diisi.');
                    return;
                  }
                  delegateMutation.mutate({
                    id: selectedTask.id,
                    to_user_id: delegateToUserId.trim(),
                    reason: delegateReason.trim(),
                  });
                }}
                disabled={delegateMutation.isPending || !delegateToUserId.trim() || !delegateReason.trim()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor:
                    delegateToUserId.trim() && delegateReason.trim() ? '#AF52DE' : isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                  alignItems: 'center',
                }}
              >
                {delegateMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ArrowUpRight size={15} strokeWidth={2.2} color={delegateToUserId.trim() && delegateReason.trim() ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'} />
                    <Text style={{ color: delegateToUserId.trim() && delegateReason.trim() ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF', fontWeight: '700' }}>
                      Limpahkan
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hold Modal */}
      <Modal visible={showHoldModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFF',
              borderRadius: R.sheet,
              padding: 20,
              paddingBottom: 36,
              maxHeight: '80%',
            }}
          >
            <Text
              style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#FFF' : '#111', marginBottom: 4 }}
            >
              Tunda Pekerjaan
            </Text>
            <Text
              style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', marginBottom: 16 }}
            >
              Pilih alasan penundaan. Manajer akan di-notif segera.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {HOLD_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setHoldReasonType(r.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: holdReasonType === r.value ? '#FF9500' : isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB',
                      backgroundColor: holdReasonType === r.value ? '#FF9500' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {holdReasonType === r.value && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TextInput
                value={holdNotes}
                onChangeText={setHoldNotes}
                placeholder="Keterangan detail (wajib)..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: isDark ? '#FFF' : '#111',
                  marginTop: 14,
                  marginBottom: 16,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', marginBottom: 12 }}>
                ℹ Foto bukti perlu diupload via halaman detail kunjungan (min 1, max 5).
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowHoldModal(false)}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: isDark ? '#FFF' : '#111', fontWeight: '600' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedTask || !holdNotes.trim()) {
                      Alert.alert('Keterangan Wajib', 'Isi keterangan detail sebelum submit.');
                      return;
                    }
                    holdMutation.mutate({
                      id: selectedTask.id,
                      reason_type: holdReasonType,
                      reason_notes: holdNotes.trim(),
                      evidence_urls: [], // user uploads via visit detail page
                    });
                  }}
                  disabled={holdMutation.isPending || !holdNotes.trim()}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor:
                      holdNotes.trim() ? '#FF9500' : isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                    alignItems: 'center',
                  }}
                >
                  {holdMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <PauseCircle size={15} strokeWidth={2.2} color={holdNotes.trim() ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'} />
                      <Text style={{ color: holdNotes.trim() ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF', fontWeight: '700' }}>
                        Tunda
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
