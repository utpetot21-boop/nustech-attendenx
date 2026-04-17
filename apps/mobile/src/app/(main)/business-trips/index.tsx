/**
 * M-11 · Surat Tugas Dinas
 * Redesign: hero banner, card accent, ikon lucide, form bersih
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  RefreshControl, useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plane, MapPin, Calendar, Clock, Banknote, ChevronRight,
  Plus, CheckCircle2, XCircle, Send, Car, Ship, AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessTripsService, BusinessTrip, CreateBusinessTripDto } from '@/services/business-trips.service';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { TripCardSkeleton } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Toast } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

// ── Konfigurasi status ────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',        color: '#8E8E93' },
  pending_approval: { label: 'Menunggu',     color: C.orange  },
  approved:         { label: 'Disetujui',    color: C.blue    },
  rejected:         { label: 'Ditolak',      color: C.red     },
  ongoing:          { label: 'Berlangsung',  color: C.green   },
  completed:        { label: 'Selesai',      color: C.purple  },
  cancelled:        { label: 'Dibatalkan',   color: '#8E8E93' },
};

const TRANSPORT_ICONS: Record<string, any> = {
  pesawat: Plane, kapal: Ship, mobil: Car, motor: Car,
};

const FILTER_OPTIONS = [
  { value: undefined,          label: 'Semua'       },
  { value: 'pending_approval', label: 'Menunggu'    },
  { value: 'approved',         label: 'Disetujui'   },
  { value: 'ongoing',          label: 'Berlangsung' },
  { value: 'completed',        label: 'Selesai'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const tripDuration = (depart: string, ret: string) => {
  const days = Math.round((new Date(ret).getTime() - new Date(depart).getTime()) / 86400000);
  return `${days} hari`;
};

// ── Hero card untuk trip berlangsung ─────────────────────────────────────────
function OngoingHeroCard({ trip, onPress, isDark }: { trip: BusinessTrip; onPress: () => void; isDark: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <LinearGradient
        colors={isDark ? ['#0C2340', '#0A3D2E', '#1A1A0A'] : ['#1D4ED8', '#0D9488', '#065F46']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: R.xl, padding: 20, overflow: 'hidden' }}
      >
        {/* Dekorasi lingkaran */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)' }} />

        {/* Live badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.green, letterSpacing: 1, textTransform: 'uppercase' }}>
            Perjalanan Berlangsung
          </Text>
        </View>

        {/* Tujuan */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <MapPin size={16} strokeWidth={2} color="rgba(255,255,255,0.7)" />
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
            {trip.destination}
          </Text>
        </View>

        {/* Nomor surat */}
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16, fontFamily: 'monospace' }}>
          {trip.trip_number}
        </Text>

        {/* Footer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} strokeWidth={2} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
              s/d {fmtDate(trip.return_date)}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Lihat Detail</Text>
            <ChevronRight size={14} strokeWidth={2.5} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Trip Card ─────────────────────────────────────────────────────────────────
function TripCard({ trip, onPress, isDark }: { trip: BusinessTrip; onPress: () => void; isDark: boolean }) {
  const meta = STATUS[trip.status] ?? { label: trip.status, color: '#8E8E93' };
  const transportKey = trip.transport_mode?.toLowerCase() ?? '';
  const TransIcon = Object.keys(TRANSPORT_ICONS).find((k) => transportKey.includes(k))
    ? TRANSPORT_ICONS[Object.keys(TRANSPORT_ICONS).find((k) => transportKey.includes(k))!]
    : Plane;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        overflow: 'hidden',
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      {/* Accent bar kiri berwarna per status */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: meta.color, borderTopLeftRadius: R.lg, borderBottomLeftRadius: R.lg }} />

      <View style={{ padding: 16, paddingLeft: 19, gap: 10 }}>
        {/* Baris atas: nomor + status */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: '600', color: lTertiary(isDark) }}>
              {trip.trip_number}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: meta.color + '18', borderRadius: R.xs, paddingHorizontal: 9, paddingVertical: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
          </View>
        </View>

        {/* Tujuan */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} strokeWidth={1.8} color={meta.color} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: lPrimary(isDark), flex: 1, letterSpacing: -0.2 }} numberOfLines={1}>
            {trip.destination}
          </Text>
        </View>

        {/* Purpose */}
        <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 18 }} numberOfLines={2}>
          {trip.purpose}
        </Text>

        {/* Info row */}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Calendar size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
              {fmtDate(trip.depart_date)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
              {tripDuration(trip.depart_date, trip.return_date)}
            </Text>
          </View>
          {trip.estimated_cost ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Banknote size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
              <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
                {fmtCurrency(trip.estimated_cost)}
              </Text>
            </View>
          ) : null}
          {trip.transport_mode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <TransIcon size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
              <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>{trip.transport_mode}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Row info untuk modal detail ───────────────────────────────────────────────
function InfoRow({ label, value, icon: Icon, isDark }: { label: string; value: string; icon?: any; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
      {Icon && (
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} strokeWidth={1.8} color={lSecondary(isDark)} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark), lineHeight: 20 }}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BusinessTripsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { toast, hide: hideToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [selected, setSelected]         = useState<BusinessTrip | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

  const [form, setForm] = useState({
    destination: '', purpose: '', depart_date: '', return_date: '',
    transport_mode: '', estimated_cost_str: '', advance_amount_str: '', notes: '',
  });

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['business-trips', filterStatus],
    queryFn: () => businessTripsService.getMyTrips(filterStatus || undefined),
  });
  const trips: BusinessTrip[] = data?.items ?? [];
  const ongoingTrip = trips.find((t) => t.status === 'ongoing') ?? null;
  const otherTrips  = trips.filter((t) => t.status !== 'ongoing');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['business-trips'] });

  const resetForm = () => setForm({
    destination: '', purpose: '', depart_date: '', return_date: '',
    transport_mode: '', estimated_cost_str: '', advance_amount_str: '', notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateBusinessTripDto) => businessTripsService.create(dto),
    onSuccess: (created) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toastSuccess(`${created.trip_number} berhasil dibuat sebagai draft.`);
      setShowCreate(false); resetForm(); invalidate();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(e?.response?.data?.message ?? 'Gagal membuat surat tugas');
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.submit(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toastSuccess('Surat tugas diajukan ke manajer.');
      setSelected(null); invalidate();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(e?.response?.data?.message ?? 'Gagal mengajukan');
    },
  });

  const departMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.depart(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toastSuccess('Perjalanan dimulai. Selamat bertugas!');
      setSelected(null); invalidate();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(e?.response?.data?.message ?? 'Gagal memulai perjalanan');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => businessTripsService.complete(id, {}),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toastSuccess('Perjalanan dinas selesai.');
      setSelected(null); invalidate();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toastError(e?.response?.data?.message ?? 'Gagal menyelesaikan');
    },
  });

  const handleCreate = () => {
    if (!form.destination || !form.purpose || !form.depart_date || !form.return_date) {
      toastWarning('Tujuan, tujuan penugasan, dan tanggal wajib diisi.');
      return;
    }
    createMutation.mutate({
      destination:    form.destination,
      purpose:        form.purpose,
      depart_date:    form.depart_date,
      return_date:    form.return_date,
      transport_mode: form.transport_mode || undefined,
      estimated_cost: form.estimated_cost_str ? +form.estimated_cost_str : undefined,
      advance_amount: form.advance_amount_str ? +form.advance_amount_str : undefined,
      notes:          form.notes || undefined,
    });
  };

  const bg = pageBg(isDark);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      {/* Header */}
      <BackHeader
        title="Surat Tugas Dinas"
        accentColor={C.indigo}
        right={
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: isDark ? 'rgba(88,86,214,0.2)' : '#EEF2FF' }}
          >
            <Plus size={15} strokeWidth={2.5} color={C.indigo} />
            <Text style={{ color: C.indigo, fontSize: 14, fontWeight: '700' }}>Buat</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter chips */}
      <FilterChips options={FILTER_OPTIONS} value={filterStatus} onChange={setFilterStatus} isDark={isDark} />

      {/* Content */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => <TripCardSkeleton key={i} isDark={isDark} />)}
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertCircle size={40} strokeWidth={1.5} color={lTertiary(isDark)} />
          <Text style={{ color: lTertiary(isDark) }}>Gagal memuat data</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: R.pill, backgroundColor: C.blue + '18' }}>
            <Text style={{ color: C.blue, fontWeight: '600' }}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={C.indigo} />}
        >
          {trips.length === 0 ? (
            <EmptyState
              icon={Plane}
              iconColor={C.indigo}
              title="Belum ada surat tugas"
              message="Ajukan perjalanan dinas melalui tombol Buat di atas."
            />
          ) : (
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {/* Hero ongoing */}
              {ongoingTrip && (
                <OngoingHeroCard trip={ongoingTrip} onPress={() => setSelected(ongoingTrip)} isDark={isDark} />
              )}

              {/* List lainnya */}
              {otherTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} onPress={() => setSelected(trip)} isDark={isDark} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (() => {
          const meta = STATUS[selected.status] ?? { label: selected.status, color: '#8E8E93' };
          return (
            <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />

              {/* Modal header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
                <View style={{ backgroundColor: meta.color + '18', borderRadius: R.xs, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                </View>
                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: lTertiary(isDark) }}>{selected.trip_number}</Text>
                <TouchableOpacity onPress={() => setSelected(null)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>Tutup</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 4 }}>
                {/* Destination hero */}
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderRadius: R.xl, padding: 20, marginBottom: 16, borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tujuan Perjalanan</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} strokeWidth={1.8} color={meta.color} />
                    <Text style={{ fontSize: 22, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.4, flex: 1 }}>{selected.destination}</Text>
                  </View>
                </View>

                {/* Info rows */}
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderRadius: R.xl, paddingHorizontal: 16, marginBottom: 16, borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <InfoRow isDark={isDark} label="Tanggal Pergi" icon={Calendar} value={fmtDate(selected.depart_date)} />
                  <InfoRow isDark={isDark} label="Tanggal Kembali" icon={Calendar} value={fmtDate(selected.return_date)} />
                  <InfoRow isDark={isDark} label="Durasi" icon={Clock} value={tripDuration(selected.depart_date, selected.return_date)} />
                  {selected.transport_mode && <InfoRow isDark={isDark} label="Transportasi" icon={Plane} value={selected.transport_mode} />}
                  {selected.estimated_cost != null && <InfoRow isDark={isDark} label="Est. Biaya" icon={Banknote} value={fmtCurrency(selected.estimated_cost)} />}
                  {selected.actual_cost != null && <InfoRow isDark={isDark} label="Biaya Aktual" icon={Banknote} value={fmtCurrency(selected.actual_cost)} />}
                  {selected.advance_amount != null && <InfoRow isDark={isDark} label="Uang Muka" icon={Banknote} value={fmtCurrency(selected.advance_amount)} />}
                </View>

                {/* Purpose */}
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderRadius: R.xl, padding: 16, marginBottom: 16, borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tujuan Penugasan</Text>
                  <Text style={{ fontSize: 14, color: lSecondary(isDark), lineHeight: 22 }}>{selected.purpose}</Text>
                </View>

                {/* Rejection */}
                {selected.rejection_reason && (
                  <View style={{ backgroundColor: C.red + '12', borderRadius: R.xl, padding: 16, marginBottom: 16, borderWidth: B.default, borderColor: C.red + '30' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <XCircle size={15} strokeWidth={2} color={C.red} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.red, textTransform: 'uppercase', letterSpacing: 0.4 }}>Alasan Penolakan</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: isDark ? '#FCA5A5' : '#7F1D1D', lineHeight: 20 }}>{selected.rejection_reason}</Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={{ gap: 10, marginTop: 4 }}>
                  {selected.status === 'draft' && (
                    <TouchableOpacity
                      onPress={() => submitMutation.mutate(selected.id)}
                      disabled={submitMutation.isPending}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.blue, borderRadius: R.lg, paddingVertical: 15 }}
                    >
                      <Send size={16} strokeWidth={2} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Ajukan Persetujuan</Text>
                    </TouchableOpacity>
                  )}
                  {selected.status === 'approved' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Konfirmasi', 'Mulai perjalanan dinas sekarang?', [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Mulai', onPress: () => departMutation.mutate(selected.id) },
                      ])}
                      disabled={departMutation.isPending}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: R.lg, paddingVertical: 15 }}
                    >
                      <Plane size={16} strokeWidth={2} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Mulai Perjalanan</Text>
                    </TouchableOpacity>
                  )}
                  {selected.status === 'ongoing' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Selesaikan Perjalanan', 'Tandai perjalanan dinas sebagai selesai?', [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Selesai', onPress: () => completeMutation.mutate(selected.id) },
                      ])}
                      disabled={completeMutation.isPending}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.purple, borderRadius: R.lg, paddingVertical: 15 }}
                    >
                      <CheckCircle2 size={16} strokeWidth={2} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Selesaikan Perjalanan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCreate(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginTop: 10 }} />

            {/* Modal header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={{ color: C.red, fontSize: 14, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: lPrimary(isDark) }}>Surat Tugas Baru</Text>
              <TouchableOpacity onPress={handleCreate} disabled={createMutation.isPending}
                style={{ backgroundColor: C.indigo, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>
                  {createMutation.isPending ? 'Menyimpan…' : 'Simpan'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }} showsVerticalScrollIndicator={false}>
              {/* Form fields dalam card group */}
              {[
                { key: 'destination',      label: 'Tujuan / Kota *',               placeholder: 'Makassar, Sulawesi Selatan', icon: MapPin },
                { key: 'purpose',          label: 'Tujuan Penugasan *',             placeholder: 'Deskripsi tugas yang dikerjakan', icon: Send, multiline: true },
                { key: 'depart_date',      label: 'Tanggal Pergi * (YYYY-MM-DD)',   placeholder: '2026-08-01', icon: Calendar },
                { key: 'return_date',      label: 'Tanggal Kembali * (YYYY-MM-DD)', placeholder: '2026-08-05', icon: Calendar },
                { key: 'transport_mode',   label: 'Moda Transportasi',              placeholder: 'Pesawat, Kapal, Mobil', icon: Plane },
                { key: 'estimated_cost_str', label: 'Estimasi Biaya (Rp)',          placeholder: '5000000', icon: Banknote, keyboard: 'numeric' as const },
                { key: 'advance_amount_str', label: 'Uang Muka (Rp)',               placeholder: '2000000', icon: Banknote, keyboard: 'numeric' as const },
                { key: 'notes',            label: 'Catatan',                        placeholder: 'Catatan tambahan (opsional)', icon: null, multiline: true },
              ].map((f) => (
                <View key={f.key} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderRadius: R.lg, padding: 14, borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    {f.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: f.multiline ? 'flex-start' : 'center', gap: 10 }}>
                    {f.icon && <f.icon size={16} strokeWidth={1.8} color={lTertiary(isDark)} style={{ marginTop: f.multiline ? 2 : 0 }} />}
                    <TextInput
                      value={(form as any)[f.key]}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                      placeholder={f.placeholder}
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#C4C4C4'}
                      keyboardType={f.keyboard ?? 'default'}
                      multiline={f.multiline}
                      numberOfLines={f.multiline ? 3 : 1}
                      style={{
                        flex: 1, fontSize: 15, color: lPrimary(isDark),
                        minHeight: f.multiline ? 64 : undefined,
                        textAlignVertical: f.multiline ? 'top' : 'center',
                      }}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
