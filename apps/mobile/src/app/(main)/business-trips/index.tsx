/**
 * M-11 · SCREEN SURAT TUGAS DINAS
 * List surat tugas + detail + buat baru
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plane } from 'lucide-react-native';
import { C, R, T, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessTripsService, BusinessTrip, CreateBusinessTripDto } from '@/services/business-trips.service';

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',        color: '#8E8E93'  },
  pending_approval: { label: 'Menunggu',     color: C.orange   },
  approved:         { label: 'Disetujui',    color: C.blue     },
  rejected:         { label: 'Ditolak',      color: C.red      },
  ongoing:          { label: 'Berlangsung',  color: C.green    },
  completed:        { label: 'Selesai',      color: C.purple   },
  cancelled:        { label: 'Dibatalkan',   color: '#8E8E93'  },
};

export default function BusinessTripsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<BusinessTrip | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState<CreateBusinessTripDto & { estimated_cost_str: string; advance_amount_str: string }>({
    destination: '',
    purpose: '',
    depart_date: '',
    return_date: '',
    transport_mode: '',
    estimated_cost_str: '',
    advance_amount_str: '',
    notes: '',
  });

  // P2-9: React Query — error handling, retry, dan refresh built-in
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['business-trips', filterStatus],
    queryFn: () => businessTripsService.getMyTrips(filterStatus || undefined),
  });
  const trips: BusinessTrip[] = data?.items ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['business-trips'] });

  const createMutation = useMutation({
    mutationFn: (dto: CreateBusinessTripDto) => businessTripsService.create(dto),
    onSuccess: (created) => {
      Alert.alert('Berhasil', `Surat tugas ${created.trip_number} dibuat sebagai draft.`);
      setShowCreate(false);
      resetForm();
      invalidate();
    },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? e.message ?? 'Gagal membuat surat tugas'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.submit(id),
    onSuccess: () => { setSelected(null); invalidate(); },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? e.message ?? 'Gagal mengajukan'),
  });

  const departMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.depart(id),
    onSuccess: () => { setSelected(null); invalidate(); },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? e.message ?? 'Gagal memulai perjalanan'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.complete(id, {}),
    onSuccess: () => { setSelected(null); invalidate(); },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? e.message ?? 'Gagal menyelesaikan'),
  });

  const handleCreate = () => {
    if (!form.destination || !form.purpose || !form.depart_date || !form.return_date) {
      Alert.alert('Form tidak lengkap', 'Tujuan, tujuan penugasan, tanggal pergi, dan tanggal kembali wajib diisi.');
      return;
    }
    createMutation.mutate({
      destination: form.destination,
      purpose: form.purpose,
      depart_date: form.depart_date,
      return_date: form.return_date,
      transport_mode: form.transport_mode || undefined,
      estimated_cost: form.estimated_cost_str ? +form.estimated_cost_str : undefined,
      advance_amount: form.advance_amount_str ? +form.advance_amount_str : undefined,
      notes: form.notes || undefined,
    });
  };

  const handleSubmit = (id: string) => submitMutation.mutate(id);

  const handleDepart = (id: string) => {
    Alert.alert('Konfirmasi', 'Mulai perjalanan dinas sekarang?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Mulai', onPress: () => departMutation.mutate(id) },
    ]);
  };

  const handleComplete = (id: string) => {
    Alert.alert('Selesaikan Perjalanan', 'Tandai perjalanan dinas sebagai selesai?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Selesai', onPress: () => completeMutation.mutate(id) },
    ]);
  };

  const resetForm = () => {
    setForm({ destination: '', purpose: '', depart_date: '', return_date: '', transport_mode: '', estimated_cost_str: '', advance_amount_str: '', notes: '' });
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const STATUS_FILTER_OPTIONS = [
    { value: undefined,          label: 'Semua'       },
    { value: 'pending_approval', label: 'Menunggu'    },
    { value: 'approved',         label: 'Disetujui'   },
    { value: 'ongoing',          label: 'Berlangsung' },
    { value: 'completed',        label: 'Selesai'     },
  ];

  const inputStyle = [
    styles.input,
    { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F9FAFB', borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB', color: isDark ? '#FFFFFF' : '#111827' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: pageBg(isDark) }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? 'rgba(15,15,20,0.9)' : 'rgba(242,242,247,0.92)', paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#007AFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>Surat Tugas Dinas</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>+ Buat</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <FilterChips
        options={STATUS_FILTER_OPTIONS}
        value={filterStatus}
        onChange={setFilterStatus}
        isDark={isDark}
      />

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#007AFF" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF', marginBottom: 12 }}>
            Gagal memuat data
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#007AFF" />}
        >
          {trips.length === 0 ? (
            <EmptyState
              icon={Plane}
              iconColor={C.blue}
              title="Tidak ada surat tugas"
              message="Ajukan surat tugas perjalanan dinas melalui tombol + Buat di atas."
            />
          ) : (
            trips.map(trip => {
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.card, { backgroundColor: cardBg(isDark), borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                  onPress={() => setSelected(trip)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardRow}>
                    <Text style={[styles.tripNumber, { color: lTertiary(isDark) }]}>{trip.trip_number}</Text>
                    <StatusBadge
                      label={STATUS_META[trip.status]?.label ?? trip.status}
                      color={STATUS_META[trip.status]?.color ?? '#8E8E93'}
                    />
                  </View>
                  <Text style={[styles.destination, { color: lPrimary(isDark) }]}>📍 {trip.destination}</Text>
                  <Text style={[styles.purpose, { color: lSecondary(isDark) }]} numberOfLines={2}>
                    {trip.purpose}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.dateText, { color: lTertiary(isDark) }]}>
                      {fmtDate(trip.depart_date)} – {fmtDate(trip.return_date)}
                    </Text>
                    {trip.estimated_cost && (
                      <Text style={[styles.costText, { color: lSecondary(isDark) }]}>
                        {fmtCurrency(trip.estimated_cost)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={[styles.modalContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>{selected.trip_number}</Text>
                <TouchableOpacity onPress={() => setSelected(null)}>
                  <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>Tutup</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
                {/* Status badge */}
                <StatusBadge
                  label={STATUS_META[selected.status]?.label ?? selected.status}
                  color={STATUS_META[selected.status]?.color ?? '#8E8E93'}
                  size="md"
                />

                {/* Info grid */}
                <View style={styles.infoGrid}>
                  {[
                    { label: 'Tujuan', value: selected.destination },
                    { label: 'Tanggal', value: `${fmtDate(selected.depart_date)} – ${fmtDate(selected.return_date)}` },
                    ...(selected.transport_mode ? [{ label: 'Transportasi', value: selected.transport_mode }] : []),
                    ...(selected.estimated_cost ? [{ label: 'Est. Biaya', value: fmtCurrency(selected.estimated_cost) }] : []),
                    ...(selected.actual_cost ? [{ label: 'Biaya Aktual', value: fmtCurrency(selected.actual_cost) }] : []),
                    ...(selected.advance_amount ? [{ label: 'Uang Muka', value: fmtCurrency(selected.advance_amount) }] : []),
                  ].map(item => (
                    <View key={item.label} style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }]}>{item.label}</Text>
                      <Text style={[styles.infoValue, { color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }]}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Purpose */}
                <View style={[styles.purposeBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
                  <Text style={[styles.infoLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', marginBottom: 6 }]}>Tujuan Penugasan</Text>
                  <Text style={[{ color: isDark ? 'rgba(255,255,255,0.75)' : '#374151', lineHeight: 22, fontSize: 14 }]}>{selected.purpose}</Text>
                </View>

                {/* Rejection reason */}
                {selected.rejection_reason && (
                  <View style={[styles.rejectBox]}>
                    <Text style={styles.rejectLabel}>Alasan Penolakan</Text>
                    <Text style={styles.rejectText}>{selected.rejection_reason}</Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  {selected.status === 'draft' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#007AFF' }]} onPress={() => handleSubmit(selected.id)}>
                      <Text style={styles.actionBtnText}>Ajukan Persetujuan</Text>
                    </TouchableOpacity>
                  )}
                  {selected.status === 'approved' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#34C759' }]} onPress={() => handleDepart(selected.id)}>
                      <Text style={styles.actionBtnText}>Mulai Perjalanan</Text>
                    </TouchableOpacity>
                  )}
                  {selected.status === 'ongoing' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#5E5CE6' }]} onPress={() => handleComplete(selected.id)}>
                      <Text style={styles.actionBtnText}>Selesaikan Perjalanan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCreate(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.modalContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={{ color: '#FF453A', fontSize: 14, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>Surat Tugas Baru</Text>
              <TouchableOpacity onPress={handleCreate}>
                <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>Simpan</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
              {[
                { key: 'destination', label: 'Tujuan / Kota', placeholder: 'Makassar, Sulawesi Selatan' },
                { key: 'purpose', label: 'Tujuan Penugasan', placeholder: 'Deskripsi tugas yang dikerjakan', multiline: true },
                { key: 'depart_date', label: 'Tanggal Pergi (YYYY-MM-DD)', placeholder: '2025-08-01' },
                { key: 'return_date', label: 'Tanggal Kembali (YYYY-MM-DD)', placeholder: '2025-08-05' },
                { key: 'transport_mode', label: 'Moda Transportasi', placeholder: 'Pesawat, Kapal, Darat' },
                { key: 'estimated_cost_str', label: 'Estimasi Biaya (Rp)', placeholder: '5000000', keyboard: 'numeric' as const },
                { key: 'advance_amount_str', label: 'Uang Muka (Rp)', placeholder: '2000000', keyboard: 'numeric' as const },
                { key: 'notes', label: 'Catatan', placeholder: 'Catatan tambahan', multiline: true },
              ].map(f => (
                <View key={f.key}>
                  <Text style={[styles.fieldLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280' }]}>{f.label}</Text>
                  <TextInput
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : '#D1D5DB'}
                    keyboardType={f.keyboard ?? 'default'}
                    multiline={f.multiline}
                    numberOfLines={f.multiline ? 3 : 1}
                    style={[inputStyle, f.multiline && { height: 80, textAlignVertical: 'top' }]}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 6 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripNumber: { fontSize: 11, fontFamily: 'monospace', fontWeight: '500' },
  destination: { fontSize: 15, fontWeight: '700' },
  purpose: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  dateText: { fontSize: 12 },
  costText: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginTop: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  infoGrid: { gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 12, fontWeight: '500', flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },
  purposeBox: { borderRadius: 12, padding: 14, borderWidth: 1 },
  rejectBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  rejectLabel: { fontSize: 12, fontWeight: '700', color: '#B91C1C', marginBottom: 6 },
  rejectText: { fontSize: 13, color: '#7F1D1D', lineHeight: 20 },
  actionRow: { gap: 10, marginTop: 4 },
  actionBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 0 },
});
