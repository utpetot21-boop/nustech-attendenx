/**
 * M-05b — Detail Kunjungan Aktif
 * Check-in → 3-phase photo grid (before/during/after) → check-out form
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { visitsService } from '@/services/visits.service';
import { socketService } from '@/services/socket.service';
import { api } from '@/services/api';
import { PhotoPhaseGrid } from '@/components/visits/PhotoPhaseGrid';
import { WatermarkCamera } from '@/components/visits/WatermarkCamera';
import { pageBg, gradients, C, R, B, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';

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

  // Camera state
  const [cameraPhase, setCameraPhase] = useState<Phase | null>(null);
  const [uploadingPhase, setUploadingPhase] = useState<Phase | null>(null);

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

  // Queries
  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => visitsService.getDetail(visitId!) as Promise<ReturnType<typeof visitsService.getDetail> extends Promise<infer T> ? T & { template_id?: string | null } : never>,
    enabled: !!visitId,
    refetchInterval: (query) => (query.state.data?.status === 'ongoing' ? 15000 : false),
  });

  const templateId = (visit as any)?.template_id as string | null | undefined;

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

  // Add photo mutation
  const addPhotoMutation = useMutation({
    mutationFn: ({
      phase,
      uri,
      lat,
      lng,
    }: { phase: Phase; uri: string; lat: number; lng: number }) =>
      visitsService.addPhoto(visitId!, { phase, lat, lng, photoUri: uri }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      qc.invalidateQueries({ queryKey: ['visit-photo-counts', visitId] });
    },
    onError: (err: Error) => {
      Alert.alert('Gagal Upload', err.message ?? 'Terjadi kesalahan saat mengunggah foto.');
    },
    onSettled: () => {
      setUploadingPhase(null);
      setCameraPhase(null);
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
      Alert.alert('Kunjungan Selesai', 'Laporan telah tersimpan.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal Check-Out', err.message ?? 'Terjadi kesalahan.');
    },
  });

  const handleCameraCapture = useCallback(
    (uri: string, lat: number, lng: number) => {
      if (!cameraPhase) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setUploadingPhase(cameraPhase);
      setCameraPhase(null); // close camera first
      addPhotoMutation.mutate({ phase: cameraPhase, uri, lat, lng });
    },
    [cameraPhase, addPhotoMutation],
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
    // Simpan form responses dulu jika ada template
    if (templateId && Object.keys(formAnswers).length > 0) {
      await saveFormMut.mutateAsync().catch(() => null);
    }
    checkOutMutation.mutate();
  }, [workDescription, template, formAnswers, templateId, saveFormMut, checkOutMutation]);

  const photosOf = (phase: Phase) =>
    (visit?.photos ?? []).filter((p) => p.phase === phase);

  const getPhotoLabel = (phase: Phase) => {
    const c = photoCounts?.[phase];
    if (!c) return PHASE_LABELS[phase];
    return `Foto ${PHASE_LABELS[phase]} (${c.count}/${c.max})`;
  };

  if (isLoading || !visit) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: pageBg(isDark),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={isDark ? '#FFF' : '#007AFF'} />
      </View>
    );
  }

  const isOngoing = visit.status === 'ongoing';
  const canCheckout =
    isOngoing &&
    photoCounts &&
    photoCounts.before.count >= photoCounts.before.min &&
    photoCounts.during.count >= photoCounts.during.min &&
    photoCounts.after.count >= photoCounts.after.min;

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
            <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 16, color: '#007AFF' }}>‹</Text>
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
                    backgroundColor: isOngoing
                      ? isDark ? 'rgba(0,122,255,0.2)' : '#EFF6FF'
                      : isDark ? 'rgba(52,199,89,0.2)' : '#F0FDF4',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isOngoing ? '#007AFF' : '#34C759',
                    }}
                  >
                    {isOngoing ? 'Berlangsung' : 'Selesai'}
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
                  onAddPhoto={(phase) => setCameraPhase(phase)}
                  isUploading={addPhotoMutation.isPending}
                  uploadingPhase={uploadingPhase}
                  isCompleted={!isOngoing}
                />
              ) : isOngoing ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator color={isDark ? '#FFF' : '#007AFF'} />
                </View>
              ) : (
                // Completed — show photos without counts
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
                {(['before', 'during', 'after'] as Phase[]).map((phase) => {
                  const c = photoCounts[phase];
                  const pct = Math.min(c.count / c.min, 1);
                  const met = c.count >= c.min;
                  return (
                    <View key={phase} style={{ marginBottom: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280',
                          }}
                        >
                          {PHASE_LABELS[phase]}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: met ? '#34C759' : isDark ? 'rgba(255,255,255,0.6)' : '#6B7280',
                          }}
                        >
                          {met ? `✓ ${c.count}` : `${c.count}/${c.min}`}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 4,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            height: 4,
                            width: `${pct * 100}%`,
                            backgroundColor: met ? '#34C759' : '#007AFF',
                            borderRadius: 2,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
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

            {/* Belum direview — info ringan */}
            {!isOngoing && !visit.review_status && (
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

                              {/* text / date */}
                              {(field.field_type === 'text' || field.field_type === 'date') && (
                                <TextInput value={val} onChangeText={setVal} editable={isOngoing}
                                  placeholder={field.field_type === 'date' ? 'YYYY-MM-DD' : field.label}
                                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                                  keyboardType={field.field_type === 'date' ? 'default' : 'default'}
                                  style={inputStyle} />
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

            {/* Berita Acara button — after visit completed */}
            {!isOngoing && (
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
                      {`Before ${photoCounts.before.count}/${photoCounts.before.min} · During ${photoCounts.during.count}/${photoCounts.during.min} · After ${photoCounts.after.count}/${photoCounts.after.min}`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: insets.bottom + 96 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Watermark Camera Modal */}
      <Modal visible={!!cameraPhase} animationType="slide">
        {cameraPhase && (
          <WatermarkCamera
            phaseLabel={getPhotoLabel(cameraPhase)}
            onCapture={handleCameraCapture}
            onCancel={() => setCameraPhase(null)}
          />
        )}
      </Modal>

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
    </>
  );
}
