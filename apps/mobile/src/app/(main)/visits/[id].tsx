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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { visitsService } from '@/services/visits.service';
import { socketService } from '@/services/socket.service';
import { PhotoPhaseGrid } from '@/components/visits/PhotoPhaseGrid';
import { WatermarkCamera } from '@/components/visits/WatermarkCamera';

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

  // Camera state
  const [cameraPhase, setCameraPhase] = useState<Phase | null>(null);
  const [uploadingPhase, setUploadingPhase] = useState<Phase | null>(null);

  // Check-out form state
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [workDescription, setWorkDescription] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');

  // Queries
  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => visitsService.getDetail(visitId!),
    enabled: !!visitId,
    refetchInterval: (query) => (query.state.data?.status === 'ongoing' ? 15000 : false),
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
    mutationFn: () =>
      visitsService.checkOut(visitId!, {
        work_description: workDescription.trim(),
        findings: findings.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['visit', visitId] });
      setShowCheckoutForm(false);
      router.back();
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

  const handleCheckOut = useCallback(() => {
    if (!workDescription.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Deskripsi Wajib', 'Masukkan deskripsi pekerjaan sebelum check-out.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    checkOutMutation.mutate();
  }, [workDescription, checkOutMutation]);

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
          backgroundColor: isDark ? '#000' : '#F2F2F7',
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
        <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#F2F2F7' }}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          {isDark && (
            <LinearGradient
              colors={['#0A1628', '#0D1F3C', '#000']}
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

            {/* Berita Acara button — after visit completed */}
            {!isOngoing && (
              <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => router.push(`/service-reports?visit_id=${visitId}`)}
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

            <View style={{ height: 40 }} />
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
              backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
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
