/**
 * M-05b — Detail Kunjungan Aktif
 * Check-in → 3-phase photo grid (before/during/after) → check-out form
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  copyToLocal,
  enqueuePhoto,
  getPendingCountForVisit,
  isNetworkError,
  processQueue,
} from '@/services/offline-photo-queue.service';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { visitsService, VISIT_STATUS_META } from '@/services/visits.service';
import { socketService } from '@/services/socket.service';
import { api } from '@/services/api';
import { PhotoPhaseGrid } from '@/components/visits/PhotoPhaseGrid';
import { pageBg, gradients, C, R, B, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar } from 'lucide-react-native';

// ── Template form types ───────────────────────────────────────────────────────
type FieldType = 'text' | 'number' | 'checkbox' | 'radio' | 'select' | 'date' | 'textarea';
interface TField   { id: string; label: string; field_type: FieldType; options: string[] | null; is_required: boolean; order_index: number }
interface TSection { id: string; title: string; order_index: number; fields: TField[] }
interface TTemplate{ id: string; name: string; sections: TSection[] }

type Phase = 'before' | 'during' | 'after';

const PHASE_LABELS: Record<Phase, string> = {
  before: 'Sebelum',
  during: 'Selama',
  after: 'Sesudah',
};


export default function VisitDetailScreen() {
  const { id: visitId } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.role?.name ?? '');

  const [uploadingPhase, setUploadingPhase] = useState<Phase | null>(null);
  const [uploadingRequirementId, setUploadingRequirementId] = useState<string | null>(null);

  // Offline queue state
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const isProcessingQueueRef = useRef(false);

  // Check-out form state
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [workDescription, setWorkDescription] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [materials, setMaterials] = useState<{ name: string; qty: string }[]>([]);

  const addMaterial    = () => setMaterials((m) => [...m, { name: '', qty: '' }]);
  const removeMaterial = (i: number) => setMaterials((m) => m.filter((_, idx) => idx !== i));
  const updateMaterial = (i: number, field: 'name' | 'qty', val: string) =>
    setMaterials((m) => m.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  // Form template checklist state
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [datePickerFieldId, setDatePickerFieldId] = useState<string | null>(null);

  // Manager review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNotes, setReviewNotes] = useState('');

  // Revision state
  const [showEditReportModal, setShowEditReportModal] = useState(false);
  const [editWorkDesc, setEditWorkDesc] = useState('');
  const [editFindings, setEditFindings] = useState('');
  const [editRecommendations, setEditRecommendations] = useState('');
  const [editMaterials, setEditMaterials] = useState<{ name: string; qty: string }[]>([]);
  const [editFormAnswers, setEditFormAnswers] = useState<Record<string, string>>({});
  const [isReportSaved, setIsReportSaved] = useState(false);

  // Queries
  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['visit', visitId, isManager ? 'admin' : 'user'],
    queryFn: () => isManager ? visitsService.getAdminDetail(visitId!) : visitsService.getDetail(visitId!),
    enabled: !!visitId,
    refetchInterval: (query) => (query.state.data?.status === 'ongoing' ? 15000 : false),
  });

  const templateId = visit?.template_id;

  const { data: template } = useQuery<TTemplate>({
    queryKey: ['template', templateId],
    queryFn: () => api.get(`/templates/${templateId}`).then((r) => r.data),
    enabled: !!templateId,
    staleTime: 5 * 60_000,
  });

  const { data: existingResponses } = useQuery({
    queryKey: ['visit-form-responses', visitId],
    queryFn: () =>
      api.get(`/visits/${visitId}/form-responses`).then((r) =>
        (r.data as { field_id: string; value: string | null }[])
      ),
    enabled: !!visitId && !!templateId,
    staleTime: 30_000,
  });

  // Merge existing responses into formAnswers on load
  useEffect(() => {
    if (!existingResponses) return;
    setFormAnswers((prev) => {
      const merged = { ...prev };
      existingResponses.forEach((resp) => {
        if (!(resp.field_id in merged)) {
          merged[resp.field_id] = resp.value ?? '';
        }
      });
      return merged;
    });
  }, [existingResponses]);

  const saveFormMut = useMutation({
    mutationFn: () => {
      const responses = Object.entries(formAnswers).map(([field_id, value]) => ({ field_id, value }));
      return api.post(`/visits/${visitId}/form-responses`, { responses });
    },
  });

  // GPS tracking via WebSocket — emit tiap 30 detik saat kunjungan ongoing
  useEffect(() => {
    if (!visit || visit.status !== 'ongoing') return;

    let mounted = true;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;

      // P2-6: jangan block tracking jika connect gagal — socket.io akan reconnect
      // sendLocation() sudah guard isConnected, jadi aman dipanggil walau belum connected
      socketService.connect().catch((err) => {
        console.warn('[Visit] Socket connect gagal, akan retry otomatis:', err.message);
      });

      socketService.startLocationTracking(async () => {
        if (!mounted) return null;
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          return {
            task_id: visit.task_id ?? undefined,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
            heading: loc.coords.heading ?? undefined,
            speed: loc.coords.speed ?? undefined,
            timestamp: new Date().toISOString(),
          };
        } catch {
          return null;
        }
      });
    };

    void startTracking();

    return () => {
      mounted = false;
      socketService.stopLocationTracking();
    };
  }, [visit?.id, visit?.status, visit?.task_id]);

  const { data: photoCounts } = useQuery({
    queryKey: ['visit-photo-counts', visitId],
    queryFn: () => visitsService.getPhotoCounts(visitId!),
    enabled: !!visitId && visit?.status === 'ongoing',
    refetchInterval: 10000,
  });

  // ── Offline queue helpers ────────────────────────────────────────────────────
  const refreshOfflineCount = useCallback(async () => {
    if (!visitId) return;
    const count = await getPendingCountForVisit(visitId);
    setOfflinePendingCount(count);
  }, [visitId]);

  const processOfflineQueue = useCallback(async () => {
    if (!visitId || isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    try {
      await processQueue(async (record) => {
        if (record.visitId !== visitId) return;
        await visitsService.addPhoto(record.visitId, {
          phase: record.phase,
          lat: record.lat,
          lng: record.lng,
          photoUri: record.localPath,
          requirement_id: record.requirementId,
          source: record.source,
          taken_at: record.takenAt,
        });
        qc.invalidateQueries({ queryKey: ['visit', visitId] });
        qc.invalidateQueries({ queryKey: ['visit-photo-counts', visitId] });
      });
    } finally {
      isProcessingQueueRef.current = false;
      await refreshOfflineCount();
    }
  }, [visitId, qc, refreshOfflineCount]);

  // Refresh count saat pertama kali buka
  useEffect(() => {
    void refreshOfflineCount();
  }, [refreshOfflineCount]);

  // Proses queue saat app kembali ke foreground (hanya jika kunjungan masih ongoing)
  useEffect(() => {
    if (visit?.status !== 'ongoing') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void processOfflineQueue();
    });
    return () => sub.remove();
  }, [visit?.status, processOfflineQueue]);

  // Add photo mutation
  const addPhotoMutation = useMutation({
    mutationFn: ({
      phase,
      uri,
      lat,
      lng,
      requirementId,
      source,
    }: { phase: Phase; uri: string; lat: number; lng: number; requirementId?: string; source?: 'camera' | 'gallery' }) =>
      visitsService.addPhoto(visitId!, { phase, lat, lng, photoUri: uri, requirement_id: requirementId, source }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      qc.invalidateQueries({ queryKey: ['visit-photo-counts', visitId] });
    },
    onError: async (err: Error, variables) => {
      if (isNetworkError(err)) {
        // Tidak ada sinyal → simpan ke queue lokal
        try {
          const localPath = await copyToLocal(variables.uri);
          await enqueuePhoto({
            visitId: visitId!,
            phase: variables.phase,
            lat: variables.lat,
            lng: variables.lng,
            localPath,
            takenAt: new Date().toISOString(),
            requirementId: variables.requirementId,
            source: variables.source ?? 'camera',
          });
          await refreshOfflineCount();
          Alert.alert(
            'Disimpan Offline',
            'Tidak ada sinyal. Foto akan diupload otomatis saat sinyal kembali.',
            [{ text: 'OK' }],
          );
        } catch {
          Alert.alert('Gagal Upload', 'Terjadi kesalahan saat menyimpan foto.');
        }
      } else {
        Alert.alert('Gagal Upload', err.message ?? 'Terjadi kesalahan saat mengunggah foto.');
      }
    },
    onSettled: () => {
      setUploadingPhase(null);
      setUploadingRequirementId(null);
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: () => {
      const validMaterials = materials.filter((m) => m.name.trim());
      return visitsService.checkOut(visitId!, {
        work_description: workDescription.trim(),
        findings: findings.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        materials_used: validMaterials.length ? validMaterials : undefined,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visits-ongoing'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      qc.invalidateQueries({ queryKey: ['tasks-all'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-detail'] });
      setShowCheckoutForm(false);
      setWorkDescription('');
      setFindings('');
      setRecommendations('');
      setMaterials([]);
      Alert.alert('Kunjungan Selesai', 'Laporan telah tersimpan.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal Check-Out', err.message ?? 'Terjadi kesalahan.');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { review_status: 'approved' | 'revision_needed'; review_rating: number; review_notes?: string }) =>
      visitsService.reviewVisit(visitId!, payload),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visit', visitId, 'admin'] });
      qc.invalidateQueries({ queryKey: ['visits-completed-all'] });
      Alert.alert('Evaluasi Tersimpan', 'Kunjungan berhasil dievaluasi.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message ?? 'Terjadi kesalahan.');
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: () =>
      visitsService.updateReport(visitId!, {
        work_description: editWorkDesc.trim(),
        findings: editFindings.trim() || undefined,
        recommendations: editRecommendations.trim() || undefined,
        materials_used: editMaterials.filter((m) => m.name.trim()),
        form_responses: Object.entries(editFormAnswers).map(([field_id, value]) => ({ field_id, value })),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      setIsReportSaved(true);
      setShowEditReportModal(false);
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal Menyimpan', err.message ?? 'Terjadi kesalahan.');
    },
  });

  const replacePhotoMutation = useMutation({
    mutationFn: ({ photoId, imageUri }: { photoId: string; imageUri: string }) =>
      visitsService.replacePhoto(visitId!, photoId, imageUri),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal Upload', err.message ?? 'Terjadi kesalahan saat mengunggah foto pengganti.');
    },
  });

  const submitRevisionMutation = useMutation({
    mutationFn: () => visitsService.submitRevision(visitId!),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      qc.invalidateQueries({ queryKey: ['visits'] });
      Alert.alert('Perbaikan Terkirim', 'Admin akan segera meninjau ulang laporan Anda.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message ?? 'Terjadi kesalahan.');
    },
  });

  const handleRevisionGalleryPick = useCallback(async (photoId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri di Pengaturan untuk menggunakan fitur ini.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    replacePhotoMutation.mutate({ photoId, imageUri: result.assets[0].uri });
  }, [replacePhotoMutation]);

  const openEditReportModal = useCallback(() => {
    if (!visit) return;
    setEditWorkDesc(visit.work_description ?? '');
    setEditFindings(visit.findings ?? '');
    setEditRecommendations(visit.recommendations ?? '');
    setEditMaterials(visit.materials_used ?? []);
    // pre-fill form answers from existing responses
    if (existingResponses) {
      const merged: Record<string, string> = {};
      existingResponses.forEach((r) => { merged[r.field_id] = r.value ?? ''; });
      setEditFormAnswers(merged);
    }
    setShowEditReportModal(true);
  }, [visit, existingResponses]);

  const handleGalleryPick = useCallback(
    async (phase: Phase, requirementId?: string) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Diperlukan', 'Izinkan akses galeri di Pengaturan untuk menggunakan fitur ini.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setUploadingPhase(phase);
      setUploadingRequirementId(requirementId ?? null);
      addPhotoMutation.mutate({ phase, uri, lat: 0, lng: 0, requirementId, source: 'gallery' });
    },
    [addPhotoMutation],
  );

  const handleAddPhotoTap = useCallback(
    (phase: Phase, requirementId?: string) => {
      void handleGalleryPick(phase, requirementId);
    },
    [handleGalleryPick],
  );

  const handleCheckOut = useCallback(async () => {
    if (!workDescription.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Deskripsi Wajib', 'Masukkan deskripsi pekerjaan sebelum check-out.');
      return;
    }
    // Validasi field wajib pada template
    if (template) {
      for (const sec of template.sections) {
        for (const field of sec.fields) {
          if (field.is_required && !formAnswers[field.id]?.trim()) {
            Alert.alert('Checklist Belum Lengkap', `Field "${field.label}" wajib diisi.`);
            return;
          }
        }
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Simpan form responses dulu jika ada template — batalkan checkout jika save gagal
    if (templateId && Object.keys(formAnswers).length > 0) {
      try {
        await saveFormMut.mutateAsync();
      } catch {
        Alert.alert('Gagal Menyimpan', 'Data formulir gagal disimpan. Periksa koneksi internet dan coba lagi.');
        return;
      }
    }
    checkOutMutation.mutate();
  }, [workDescription, template, formAnswers, templateId, saveFormMut, checkOutMutation]);

  const photosOf = (phase: Phase) =>
    (visit?.photos ?? []).filter((p) => p.phase === phase);

  const pendingRetakePhotos = (visit?.photos ?? []).filter((p) => p.needs_retake);
  const pendingRetakeCount = pendingRetakePhotos.length;
  const isRevisionMode = !isManager && visit?.review_status === 'revision_needed';

  const getPhotoLabel = (phase: Phase) => {
    const c = photoCounts?.[phase];
    if (!c) return PHASE_LABELS[phase];
    return `Foto ${PHASE_LABELS[phase]} (${c.count}/${c.max})`;
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg(isDark), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={isDark ? '#FFF' : '#007AFF'} />
      </View>
    );
  }

  if (isError || !visit) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg(isDark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <ChevronLeft size={20} strokeWidth={2.5} color="#007AFF" />
          <Text style={{ fontSize: 15, color: '#007AFF' }}>Kembali</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', textAlign: 'center' }}>
          Kunjungan tidak ditemukan atau Anda tidak memiliki akses.
        </Text>
      </View>
    );
  }

  const isOngoing = visit.status === 'ongoing' && !isManager;
  const visitStatusMeta = VISIT_STATUS_META[visit.status] ?? VISIT_STATUS_META.ongoing;
  const canCheckout =
    isOngoing &&
    photoCounts &&
    (photoCounts.has_requirements
      ? photoCounts.requirements.filter((r) => r.is_required).every((r) => r.count > 0)
      : photoCounts.before.count >= photoCounts.before.min &&
        photoCounts.during.count >= photoCounts.during.min &&
        photoCounts.after.count >= photoCounts.after.min);

  const checkInTime = new Date(visit.check_in_at).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          {isDark && (
            <LinearGradient
              colors={gradients.heroVisit}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.5} color="#007AFF" />
                <Text style={{ fontSize: 15, color: '#007AFF' }}>Kunjungan</Text>
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: isDark ? '#FFF' : '#111',
                  letterSpacing: -0.6,
                }}
                numberOfLines={2}
              >
                {visit.client?.name ?? '—'}
              </Text>

              {/* Status badge */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    backgroundColor: visitStatusMeta.bg,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: visitStatusMeta.color,
                    }}
                  >
                    {visitStatusMeta.label}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
                  }}
                >
                  Check-in {checkInTime}
                </Text>
              </View>
            </View>

            {/* Banner offline pending photos */}
            {offlinePendingCount > 0 && (
              <TouchableOpacity
                onPress={() => void processOfflineQueue()}
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  backgroundColor: isDark ? 'rgba(255,149,0,0.18)' : '#FFF7ED',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,149,0,0.35)' : 'rgba(255,149,0,0.3)',
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF9500' }}>
                    {offlinePendingCount} foto menunggu upload
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#9A3412' }}>
                    Ketuk untuk upload ulang sekarang
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Revision banner — hanya untuk teknisi saat revision_needed */}
            {isRevisionMode && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF7ED',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderLeftWidth: 4,
                  borderColor: isDark ? 'rgba(255,149,0,0.35)' : 'rgba(255,149,0,0.3)',
                  borderLeftColor: '#FF9500',
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF9500', marginBottom: 6 }}>
                  ⚠ Laporan Perlu Diperbaiki
                </Text>
                {visit.review_notes ? (
                  <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.75)' : '#374151', lineHeight: 19, marginBottom: 8 }}>
                    "{visit.review_notes}"
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: visit.reviewer ? 6 : 0 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Text key={s} style={{ fontSize: 14, opacity: s <= (visit.review_rating ?? 0) ? 1 : 0.22 }}>⭐</Text>
                  ))}
                </View>
                {visit.reviewer && (
                  <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>
                    Ditinjau oleh {visit.reviewer.full_name}
                  </Text>
                )}
              </View>
            )}

            {/* Location info card */}
            {visit.check_in_address && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
                  borderRadius: 16,
                  borderWidth: 0.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Lokasi Check-In
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,0.8)' : '#374151',
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {visit.check_in_address}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: visit.gps_valid ? '#34C759' : '#FF9F0A',
                    }}
                  />
                  <Text
                    style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}
                  >
                    {visit.gps_valid
                      ? 'GPS valid di lokasi klien'
                      : `Deviasi ${visit.gps_deviation_meter}m dari lokasi klien`}
                  </Text>
                </View>
              </View>
            )}

            {/* Photo phase grid */}
            <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: isDark ? '#FFF' : '#111',
                  marginBottom: 12,
                  letterSpacing: -0.3,
                }}
              >
                Dokumentasi Foto
              </Text>

              {photoCounts ? (
                <PhotoPhaseGrid
                  sections={(['before', 'during', 'after'] as Phase[]).map((phase) => ({
                    phase,
                    photos: photosOf(phase),
                    counts: photoCounts[phase],
                  }))}
                  photoCounts={photoCounts}
                  onAddPhoto={(phase, requirementId) => handleAddPhotoTap(phase, requirementId)}
                  isUploading={addPhotoMutation.isPending}
                  uploadingPhase={uploadingPhase}
                  uploadingRequirementId={uploadingRequirementId}
                  isCompleted={!isOngoing}
                />
              ) : isOngoing ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator color={isDark ? '#FFF' : '#007AFF'} />
                </View>
              ) : (
                <PhotoPhaseGrid
                  sections={(['before', 'during', 'after'] as Phase[]).map((phase) => ({
                    phase,
                    photos: photosOf(phase),
                    counts: { count: photosOf(phase).length, min: 0, max: 20 },
                  }))}
                  onAddPhoto={() => {}}
                  isCompleted
                />
              )}
            </View>

            {/* Revision: foto needs_retake */}
            {isRevisionMode && pendingRetakePhotos.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <View style={{
                  backgroundColor: isDark ? 'rgba(255,149,0,0.1)' : '#FFF7ED',
                  borderRadius: 14, borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,149,0,0.25)' : 'rgba(255,149,0,0.25)',
                  padding: 14,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF9500', marginBottom: 12 }}>
                    {pendingRetakeCount} foto perlu diganti
                  </Text>
                  {pendingRetakePhotos.map((photo) => (
                    <View key={photo.id} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderRadius: 10, padding: 10,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.75)' : '#374151' }}>
                          {photo.phase === 'before' ? 'Sebelum' : photo.phase === 'during' ? 'Selama' : 'Sesudah'} · #{photo.seq_number}
                        </Text>
                        {photo.admin_feedback ? (
                          <Text style={{ fontSize: 11, color: '#FF9500', marginTop: 2 }} numberOfLines={2}>
                            {photo.admin_feedback}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevisionGalleryPick(photo.id)}
                        disabled={replacePhotoMutation.isPending}
                        activeOpacity={0.8}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                          backgroundColor: '#FF9500',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>
                          {replacePhotoMutation.isPending ? '...' : 'Ganti'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Revision: Perbaiki Laporan + Kirim Perbaikan buttons */}
            {isRevisionMode && (
              <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 10 }}>
                <TouchableOpacity
                  onPress={openEditReportModal}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
                    borderRadius: 14, borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
                    padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFF' : '#111' }}>
                    ✏️ Perbaiki Laporan
                  </Text>
                  {isReportSaved && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#34C759' }}>✓ Tersimpan</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Kirim Perbaikan',
                      'Pastikan semua revisi sudah selesai. Laporan akan dikirim ke admin untuk ditinjau ulang.',
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Kirim', style: 'default', onPress: () => submitRevisionMutation.mutate() },
                      ],
                    );
                  }}
                  disabled={pendingRetakeCount > 0 || submitRevisionMutation.isPending}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: pendingRetakeCount > 0 ? (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB') : '#007AFF',
                    borderRadius: 14, padding: 16, alignItems: 'center',
                  }}
                >
                  {submitRevisionMutation.isPending
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : (
                      <>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: pendingRetakeCount > 0 ? (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') : '#FFF', letterSpacing: -0.3 }}>
                          Kirim Perbaikan
                        </Text>
                        {pendingRetakeCount > 0 && (
                          <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF', marginTop: 3 }}>
                            Ganti {pendingRetakeCount} foto terlebih dahulu
                          </Text>
                        )}
                      </>
                    )
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Progress summary bar (ongoing only) */}
            {isOngoing && photoCounts && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
                  borderRadius: 16,
                  borderWidth: 0.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? 'rgba(255,255,255,0.75)' : '#374151',
                    marginBottom: 10,
                  }}
                >
                  Progres Foto
                </Text>
                {photoCounts.has_requirements
                  ? photoCounts.requirements.filter((r) => r.is_required).map((req) => {
                      const pct = Math.min(req.count / 1, 1); // wajib minimal 1
                      const met = req.count > 0;
                      return (
                        <View key={req.id} style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', flex: 1, marginRight: 8 }} numberOfLines={1}>{req.label}</Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: met ? '#34C759' : isDark ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>
                              {met ? `✓ ${req.count}` : `${req.count}/${req.max_photos}`}
                            </Text>
                          </View>
                          <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: met ? '#34C759' : '#007AFF', borderRadius: 2 }} />
                          </View>
                        </View>
                      );
                    })
                  : (['before', 'during', 'after'] as Phase[]).map((phase) => {
                      const c = photoCounts[phase];
                      const pct = Math.min(c.count / c.min, 1);
                      const met = c.count >= c.min;
                      return (
                        <View key={phase} style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>{PHASE_LABELS[phase]}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: met ? '#34C759' : isDark ? 'rgba(255,255,255,0.6)' : '#6B7280' }}>
                              {met ? `✓ ${c.count}` : `${c.count}/${c.min}`}
                            </Text>
                          </View>
                          <View style={{ height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: met ? '#34C759' : '#007AFF', borderRadius: 2 }} />
                          </View>
                        </View>
                      );
                    })
                }
              </View>
            )}

            {/* Completed info */}
            {!isOngoing && visit.work_description && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
                  borderRadius: 16,
                  borderWidth: 0.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  padding: 14,
                  gap: 12,
                }}
              >
                {[
                  { label: 'Deskripsi Pekerjaan', value: visit.work_description },
                  { label: 'Temuan', value: visit.findings },
                  { label: 'Rekomendasi', value: visit.recommendations },
                ]
                  .filter((item) => item.value)
                  .map((item) => (
                    <View key={item.label}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
                          marginBottom: 4,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: isDark ? 'rgba(255,255,255,0.8)' : '#374151',
                          lineHeight: 20,
                        }}
                      >
                        {item.value}
                      </Text>
                    </View>
                  ))}
                {visit.duration_minutes !== null && (
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Total Durasi
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#374151' }}
                    >
                      {Math.floor(visit.duration_minutes / 60)} jam{' '}
                      {visit.duration_minutes % 60} menit
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Hasil Evaluasi (jika sudah direview admin) ── */}
            {!isOngoing && visit.review_status && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 16,
                  backgroundColor: visit.review_status === 'approved'
                    ? isDark ? 'rgba(52,199,89,0.12)' : '#F0FDF4'
                    : isDark ? 'rgba(255,149,0,0.12)' : '#FFF7ED',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: visit.review_status === 'approved'
                    ? isDark ? 'rgba(52,199,89,0.3)' : 'rgba(52,199,89,0.25)'
                    : isDark ? 'rgba(255,149,0,0.3)' : 'rgba(255,149,0,0.25)',
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Hasil Evaluasi
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  {/* Stars */}
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Text key={s} style={{ fontSize: 18, opacity: s <= (visit.review_rating ?? 0) ? 1 : 0.25 }}>⭐</Text>
                    ))}
                  </View>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                    backgroundColor: visit.review_status === 'approved' ? 'rgba(52,199,89,0.2)' : 'rgba(255,149,0,0.2)',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: visit.review_status === 'approved' ? '#34C759' : '#FF9500' }}>
                      {visit.review_status === 'approved' ? '✓ Disetujui' : '⚠ Perlu Revisi'}
                    </Text>
                  </View>
                </View>
                {visit.review_notes ? (
                  <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#374151', lineHeight: 20 }}>
                    {visit.review_notes}
                  </Text>
                ) : null}
                {visit.reviewer && (
                  <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF', marginTop: 6 }}>
                    Oleh {visit.reviewer.full_name}
                  </Text>
                )}
              </View>
            )}

            {/* Manager review form — hanya jika belum direview */}
            {!isOngoing && !visit.review_status && isManager && (
              <View style={{
                marginHorizontal: 16, marginBottom: 16,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
                borderRadius: 16, borderWidth: 0.5,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                padding: 16,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFF' : '#111', marginBottom: 14, letterSpacing: -0.3 }}>
                  Evaluasi Kunjungan
                </Text>

                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  RATING
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setReviewRating(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Text style={{ fontSize: 28, opacity: s <= reviewRating ? 1 : 0.22 }}>⭐</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  CATATAN (opsional)
                </Text>
                <TextInput
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  placeholder="Catatan evaluasi atau instruksi revisi..."
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F9FAFB',
                    borderRadius: 12, borderWidth: 0.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                    padding: 12, fontSize: 14,
                    color: isDark ? '#FFF' : '#111',
                    minHeight: 80, marginBottom: 14,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => reviewMutation.mutate({ review_status: 'revision_needed', review_rating: reviewRating, review_notes: reviewNotes.trim() || undefined })}
                    disabled={reviewMutation.isPending}
                    activeOpacity={0.8}
                    style={{
                      flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
                      backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF7ED',
                      borderWidth: 1, borderColor: isDark ? 'rgba(255,149,0,0.35)' : 'rgba(255,149,0,0.3)',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF9500' }}>Perlu Revisi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => reviewMutation.mutate({ review_status: 'approved', review_rating: reviewRating, review_notes: reviewNotes.trim() || undefined })}
                    disabled={reviewMutation.isPending}
                    activeOpacity={0.8}
                    style={{
                      flex: 1.2, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
                      backgroundColor: '#34C759',
                    }}
                  >
                    {reviewMutation.isPending
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Setujui</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Belum direview — info ringan (teknisi view) */}
            {!isOngoing && !visit.review_status && !isManager && (
              <View style={{
                marginHorizontal: 16, marginBottom: 16,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderRadius: 12, padding: 12, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }}>
                  Laporan ini belum dievaluasi oleh admin
                </Text>
              </View>
            )}

            {/* Template checklist form */}
            {template && template.sections.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: isDark ? '#FFF' : '#111', marginBottom: 12, letterSpacing: -0.3 }}>
                  Checklist Pekerjaan
                </Text>
                {template.sections
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((sec) => (
                    <View key={sec.id} style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
                      borderRadius: 16, borderWidth: 0.5,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                      padding: 14, marginBottom: 12,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {sec.title}
                      </Text>
                      {sec.fields
                        .slice()
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((field) => {
                          const val = formAnswers[field.id] ?? '';
                          const setVal = (v: string) => setFormAnswers((prev) => ({ ...prev, [field.id]: v }));
                          const inputStyle = {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                            borderRadius: 10, borderWidth: 0.5,
                            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                            paddingHorizontal: 12, paddingVertical: 9,
                            fontSize: 14, color: isDark ? '#FFF' : '#111',
                          };
                          return (
                            <View key={field.id} style={{ marginBottom: 12 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.75)' : '#374151', marginBottom: 6 }}>
                                {field.label}{field.is_required ? ' *' : ''}
                              </Text>

                              {/* text */}
                              {field.field_type === 'text' && (
                                <TextInput value={val} onChangeText={setVal} editable={isOngoing}
                                  placeholder={field.label}
                                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                                  style={inputStyle} />
                              )}

                              {/* date picker */}
                              {field.field_type === 'date' && (
                                <>
                                  <TouchableOpacity
                                    onPress={() => isOngoing && setDatePickerFieldId(field.id)}
                                    activeOpacity={0.7}
                                    style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: isOngoing ? 1 : 0.5 }}
                                  >
                                    <Text style={{ fontSize: 14, color: val ? (isDark ? '#FFF' : '#111') : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') }}>
                                      {val || 'Pilih tanggal'}
                                    </Text>
                                    <Calendar size={16} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'} />
                                  </TouchableOpacity>
                                  {datePickerFieldId === field.id && (
                                    <DateTimePicker
                                      value={val ? new Date(val) : new Date()}
                                      mode="date"
                                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                      onChange={(_e, date) => {
                                        setDatePickerFieldId(null);
                                        if (date) setVal(date.toISOString().split('T')[0]);
                                      }}
                                    />
                                  )}
                                </>
                              )}

                              {/* number */}
                              {field.field_type === 'number' && (
                                <TextInput value={val} onChangeText={setVal} editable={isOngoing}
                                  placeholder="0" placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                                  keyboardType="numeric" style={inputStyle} />
                              )}

                              {/* textarea */}
                              {field.field_type === 'textarea' && (
                                <TextInput value={val} onChangeText={setVal} editable={isOngoing}
                                  placeholder={field.label} multiline numberOfLines={3} textAlignVertical="top"
                                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                                  style={{ ...inputStyle, minHeight: 72 }} />
                              )}

                              {/* checkbox */}
                              {field.field_type === 'checkbox' && (
                                <TouchableOpacity
                                  onPress={() => isOngoing && setVal(val === 'true' ? '' : 'true')}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                >
                                  <View style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    borderWidth: 2, borderColor: val === 'true' ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB'),
                                    backgroundColor: val === 'true' ? '#007AFF' : 'transparent',
                                    alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    {val === 'true' && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                                  </View>
                                  <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.75)' : '#374151' }}>
                                    {val === 'true' ? 'Ya' : 'Tidak / Belum diisi'}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {/* radio / select */}
                              {(field.field_type === 'radio' || field.field_type === 'select') && field.options && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                  {field.options.map((opt) => (
                                    <TouchableOpacity
                                      key={opt}
                                      onPress={() => isOngoing && setVal(val === opt ? '' : opt)}
                                      style={{
                                        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: val === opt ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'),
                                        backgroundColor: val === opt
                                          ? isDark ? 'rgba(0,122,255,0.2)' : '#EFF6FF'
                                          : 'transparent',
                                      }}
                                    >
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: val === opt ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.6)' : '#6B7280') }}>
                                        {opt}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                    </View>
                  ))}
              </View>
            )}

            {/* Berita Acara button — hanya untuk kunjungan selesai */}
            {visit.status === 'completed' && (
              <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(main)/service-reports', params: { visit_id: visitId } } as Href)}
                  style={{
                    backgroundColor: '#1D4ED8',
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 }}>
                    📄 Berita Acara
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Check-out button */}
            {isOngoing && (
              <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
                <TouchableOpacity
                  onPress={() => setShowCheckoutForm(true)}
                  disabled={!canCheckout}
                  style={{
                    backgroundColor: canCheckout ? '#34C759' : isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: canCheckout ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
                      letterSpacing: -0.3,
                    }}
                  >
                    {canCheckout ? 'Check-Out Kunjungan' : 'Lengkapi Foto Terlebih Dahulu'}
                  </Text>
                  {!canCheckout && photoCounts && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF',
                        marginTop: 4,
                      }}
                    >
                      {photoCounts.has_requirements
                        ? `${photoCounts.requirements.filter((r) => r.is_required && r.count > 0).length}/${photoCounts.requirements.filter((r) => r.is_required).length} foto wajib terisi`
                        : `Sebelum ${photoCounts.before.count}/${photoCounts.before.min} · Selama ${photoCounts.during.count}/${photoCounts.during.min} · Sesudah ${photoCounts.after.count}/${photoCounts.after.min}`
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: insets.bottom + 110 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Check-out form Modal */}
      <Modal visible={showCheckoutForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: pageBg(isDark),
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: isDark ? '#FFF' : '#111',
                  letterSpacing: -0.4,
                }}
              >
                Laporan Check-Out
              </Text>
              <TouchableOpacity onPress={() => setShowCheckoutForm(false)}>
                <Text style={{ fontSize: 15, color: '#007AFF' }}>Batal</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  label: 'Deskripsi Pekerjaan *',
                  value: workDescription,
                  setter: setWorkDescription,
                  placeholder: 'Jelaskan pekerjaan yang dilakukan...',
                  required: true,
                },
                {
                  label: 'Temuan',
                  value: findings,
                  setter: setFindings,
                  placeholder: 'Temuan atau masalah yang ditemukan...',
                  required: false,
                },
                {
                  label: 'Rekomendasi',
                  value: recommendations,
                  setter: setRecommendations,
                  placeholder: 'Rekomendasi tindak lanjut...',
                  required: false,
                },
              ].map((field) => (
                <View key={field.label} style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280',
                      marginBottom: 6,
                    }}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.placeholder}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                      borderRadius: 14,
                      borderWidth: 0.5,
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      padding: 14,
                      fontSize: 14,
                      color: isDark ? '#FFF' : '#111',
                      minHeight: 100,
                    }}
                  />
                </View>
              ))}

              {/* Material digunakan */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 10 }}>
                  Material Digunakan (opsional)
                </Text>
                {materials.map((mat, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <TextInput
                      value={mat.name}
                      onChangeText={(v) => updateMaterial(i, 'name', v)}
                      placeholder="Nama material"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                      style={{
                        flex: 2,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                        borderRadius: 12, borderWidth: 0.5,
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                        paddingHorizontal: 12, paddingVertical: 10,
                        fontSize: 14, color: isDark ? '#FFF' : '#111',
                      }}
                    />
                    <TextInput
                      value={mat.qty}
                      onChangeText={(v) => updateMaterial(i, 'qty', v)}
                      placeholder="Qty"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                        borderRadius: 12, borderWidth: 0.5,
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                        paddingHorizontal: 12, paddingVertical: 10,
                        fontSize: 14, color: isDark ? '#FFF' : '#111',
                      }}
                    />
                    <TouchableOpacity onPress={() => removeMaterial(i)}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,69,58,0.2)' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FF453A', fontSize: 18, lineHeight: 20 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={addMaterial}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    paddingVertical: 10, borderRadius: 12,
                    borderWidth: 1, borderStyle: 'dashed',
                    borderColor: isDark ? 'rgba(0,122,255,0.4)' : 'rgba(0,122,255,0.3)',
                  }}
                >
                  <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>+ Tambah Material</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleCheckOut}
                disabled={checkOutMutation.isPending || !workDescription.trim()}
                style={{
                  backgroundColor:
                    !workDescription.trim() || checkOutMutation.isPending
                      ? isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'
                      : '#34C759',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  marginTop: 8,
                }}
                activeOpacity={0.8}
              >
                {checkOutMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: !workDescription.trim() ? (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') : '#FFF',
                    }}
                  >
                    Konfirmasi Check-Out
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Report Modal — Revision */}
      <Modal visible={showEditReportModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: pageBg(isDark), padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFF' : '#111', letterSpacing: -0.4 }}>
                Perbaiki Laporan
              </Text>
              <TouchableOpacity onPress={() => setShowEditReportModal(false)}>
                <Text style={{ fontSize: 15, color: '#007AFF' }}>Batal</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Deskripsi Pekerjaan *', value: editWorkDesc, setter: setEditWorkDesc, placeholder: 'Jelaskan pekerjaan yang dilakukan...' },
                { label: 'Temuan', value: editFindings, setter: setEditFindings, placeholder: 'Temuan atau masalah yang ditemukan...' },
                { label: 'Rekomendasi', value: editRecommendations, setter: setEditRecommendations, placeholder: 'Rekomendasi tindak lanjut...' },
              ].map((field) => (
                <View key={field.label} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 6 }}>
                    {field.label}
                  </Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.placeholder}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                    multiline numberOfLines={4} textAlignVertical="top"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                      borderRadius: 14, borderWidth: 0.5,
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                      padding: 14, fontSize: 14, color: isDark ? '#FFF' : '#111', minHeight: 100,
                    }}
                  />
                </View>
              ))}

              {/* Material digunakan */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 10 }}>
                  Material Digunakan (opsional)
                </Text>
                {editMaterials.map((mat, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <TextInput
                      value={mat.name}
                      onChangeText={(v) => setEditMaterials((m) => m.map((item, idx) => idx === i ? { ...item, name: v } : item))}
                      placeholder="Nama material"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                      style={{ flex: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: isDark ? '#FFF' : '#111' }}
                    />
                    <TextInput
                      value={mat.qty}
                      onChangeText={(v) => setEditMaterials((m) => m.map((item, idx) => idx === i ? { ...item, qty: v } : item))}
                      placeholder="Qty"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                      style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: isDark ? '#FFF' : '#111' }}
                    />
                    <TouchableOpacity onPress={() => setEditMaterials((m) => m.filter((_, idx) => idx !== i))}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,69,58,0.2)' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FF453A', fontSize: 18, lineHeight: 20 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setEditMaterials((m) => [...m, { name: '', qty: '' }])}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(0,122,255,0.4)' : 'rgba(0,122,255,0.3)' }}
                >
                  <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>+ Tambah Material</Text>
                </TouchableOpacity>
              </View>

              {/* Template fields (jika ada) */}
              {template && template.sections.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFF' : '#111', marginBottom: 12 }}>
                    Checklist Pekerjaan
                  </Text>
                  {template.sections.slice().sort((a, b) => a.order_index - b.order_index).map((sec) => (
                    <View key={sec.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)', borderRadius: 14, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', padding: 14, marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280', marginBottom: 10, textTransform: 'uppercase' }}>{sec.title}</Text>
                      {sec.fields.slice().sort((a, b) => a.order_index - b.order_index).map((field) => {
                        const val = editFormAnswers[field.id] ?? '';
                        const setVal = (v: string) => setEditFormAnswers((prev) => ({ ...prev, [field.id]: v }));
                        const inputStyle = { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 10, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: isDark ? '#FFF' : '#111' };
                        return (
                          <View key={field.id} style={{ marginBottom: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.75)' : '#374151', marginBottom: 5 }}>
                              {field.label}{field.is_required ? ' *' : ''}
                            </Text>
                            {(field.field_type === 'text' || field.field_type === 'number') && (
                              <TextInput value={val} onChangeText={setVal} placeholder={field.label}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                                keyboardType={field.field_type === 'number' ? 'numeric' : 'default'} style={inputStyle} />
                            )}
                            {field.field_type === 'textarea' && (
                              <TextInput value={val} onChangeText={setVal} placeholder={field.label} multiline numberOfLines={3} textAlignVertical="top"
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} style={{ ...inputStyle, minHeight: 72 }} />
                            )}
                            {field.field_type === 'checkbox' && (
                              <TouchableOpacity onPress={() => setVal(val === 'true' ? '' : 'true')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: val === 'true' ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB'), backgroundColor: val === 'true' ? '#007AFF' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                  {val === 'true' && <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                                </View>
                                <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.75)' : '#374151' }}>{val === 'true' ? 'Ya' : 'Tidak / Belum diisi'}</Text>
                              </TouchableOpacity>
                            )}
                            {(field.field_type === 'radio' || field.field_type === 'select') && field.options && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {field.options.map((opt) => (
                                  <TouchableOpacity key={opt} onPress={() => setVal(val === opt ? '' : opt)}
                                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: val === opt ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB'), backgroundColor: val === opt ? (isDark ? 'rgba(0,122,255,0.2)' : '#EFF6FF') : 'transparent' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: val === opt ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.6)' : '#6B7280') }}>{opt}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={() => updateReportMutation.mutate()}
                disabled={updateReportMutation.isPending || !editWorkDesc.trim()}
                style={{
                  backgroundColor: !editWorkDesc.trim() || updateReportMutation.isPending ? (isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB') : '#007AFF',
                  borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8,
                }}
                activeOpacity={0.8}
              >
                {updateReportMutation.isPending
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={{ fontSize: 16, fontWeight: '700', color: !editWorkDesc.trim() ? (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') : '#FFF' }}>Simpan Perubahan</Text>
                }
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
