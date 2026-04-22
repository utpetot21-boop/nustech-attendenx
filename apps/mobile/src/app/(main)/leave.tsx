/**
 * SCREEN CUTI & IZIN
 * Karyawan dapat melihat riwayat dan mengajukan cuti / izin
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, useColorScheme, StatusBar, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, ChevronDown, ChevronLeft, Plus, X, Paperclip, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import {
  leaveService,
  LeaveRequest,
  LeaveType,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
} from '@/services/leave.service';
import * as Haptics from 'expo-haptics';
import { C, R, B, T, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary, gradients } from '@/constants/tokens';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackHeader } from '@/components/ui/BackHeader';
import { LeaveCardSkeleton } from '@/components/ui/SkeletonLoader';
import { fmtDateShort as fmtDate, toISODate } from '@/utils/dateFormatter';

// ── Status meta ───────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu', color: C.orange },
  approved: { label: 'Disetujui', color: C.green },
  rejected: { label: 'Ditolak',   color: C.red },
};

// ── Leave Request Card ────────────────────────────────────────────────────────

function LeaveCard({ item, isDark, onPress }: { item: LeaveRequest; isDark: boolean; onPress: () => void }) {
  const color = LEAVE_TYPE_COLORS[item.type] ?? C.blue;
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg, borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        padding: 16, marginBottom: 10,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
          <View style={{ width: 38, height: 38, borderRadius: R.sm, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color={color} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.subhead, fontWeight: '700', color: lPrimary(isDark) }}>
              {LEAVE_TYPE_LABELS[item.type]}
            </Text>
            <Text style={{ ...T.caption1, color: lTertiary(isDark), marginTop: 1 }}>
              {fmtDate(item.start_date)} – {fmtDate(item.end_date)} · {item.total_days} hari
            </Text>
          </View>
        </View>
        <StatusBadge label={statusMeta.label} color={statusMeta.color} dot />
      </View>

      {item.reason ? (
        <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 18 }} numberOfLines={2}>
          {item.reason}
        </Text>
      ) : null}

      {item.reject_reason ? (
        <View style={{ marginTop: 8, backgroundColor: C.red + '12', borderRadius: R.sm - 2, padding: 10, borderWidth: B.default, borderColor: C.red + '25' }}>
          <Text style={{ fontSize: 12, color: C.red }}>Ditolak: {item.reject_reason}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Date Picker Row ───────────────────────────────────────────────────────────

function DateRow({
  label, date, onPress, isDark,
}: { label: string; date: Date; onPress: () => void; isDark: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFF',
        borderRadius: R.md, borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        paddingHorizontal: 14, paddingVertical: 13,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 14, color: lSecondary(isDark) }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark) }}>
          {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </Text>
        <ChevronDown size={14} color={lTertiary(isDark)} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function LeaveScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('cuti');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate]     = useState(new Date());
  const [reason, setReason]       = useState('');
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);
  const [attachmentUri, setAttachmentUri]   = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl]   = useState<string | null>(null);
  const [isUploading, setIsUploading]       = useState(false);

  // Queries
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => leaveService.getMyBalance(),
    staleTime: 30_000,
  });

  const { data: requests = [], isLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['leave-requests-me'],
    queryFn: () => leaveService.getMyRequests(),
    staleTime: 30_000,
  });

  const handleRefresh = useCallback(() => {
    refetchBalance();
    refetchRequests();
  }, [refetchBalance, refetchRequests]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveService.cancel(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setSelectedLeave(null);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan');
    },
  });

  const pickAttachment = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses ke galeri untuk melampirkan file.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachmentUri(asset.uri);
    setAttachmentUrl(null);
    setIsUploading(true);
    try {
      const url = await leaveService.uploadAttachment(asset.uri, asset.mimeType ?? 'image/jpeg');
      setAttachmentUrl(url);
    } catch {
      Alert.alert('Gagal Upload', 'Tidak dapat mengupload lampiran. Coba lagi.');
      setAttachmentUri(null);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: () => leaveService.create({
      type: leaveType,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      reason,
      attachment_url: attachmentUrl ?? undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowForm(false);
      resetForm();
      Alert.alert('Berhasil', 'Pengajuan berhasil dikirim. Menunggu persetujuan admin.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan');
    },
  });

  function resetForm() {
    setLeaveType('cuti');
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setAttachmentUri(null);
    setAttachmentUrl(null);
    setIsUploading(false);
  }

  const filtered = requests.filter((r) => filterTab === 'all' || r.status === filterTab);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: 'Semua' },
    { key: 'pending',  label: 'Menunggu' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'rejected', label: 'Ditolak' },
  ];

  const LEAVE_TYPES: LeaveType[] = ['cuti', 'izin', 'sakit', 'dinas'];

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isDark && (
        <LinearGradient
          colors={gradients.heroLeave}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={isDark ? '#FFF' : C.blue} />
        }
      >
        {/* ── Header ── */}
        <BackHeader
          title="Cuti & Izin"
          subtitle="Kelola pengajuan cuti dan izin Anda"
          accentColor={C.green}
          right={
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, paddingVertical: 8,
                backgroundColor: C.blue, borderRadius: R.pill,
              }}
            >
              <Plus size={15} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Ajukan</Text>
            </TouchableOpacity>
          }
        />

          {/* Saldo Card */}
          {balance && (
            <View style={{
              marginTop: 16,
              marginHorizontal: 20,
              backgroundColor: cardBg(isDark),
              borderRadius: R.lg, borderWidth: B.default,
              borderColor: isDark ? C.separator.dark : C.separator.light,
              padding: 16, flexDirection: 'row', gap: 0,
              ...(isDark ? S.cardDark : S.card),
            }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: C.blue, letterSpacing: -1 }}>
                  {Number(balance.balance_days).toFixed(1)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Saldo Hari
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: C.orange, letterSpacing: -1 }}>
                  {pendingCount}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Menunggu
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: C.green, letterSpacing: -1 }}>
                  {Number(balance.used_days).toFixed(1)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Digunakan
                </Text>
              </View>
            </View>
          )}

        {/* ── Filter Tabs ── */}
        <View style={{ marginTop: 14, marginBottom: 14 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {FILTER_TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setFilterTab(key)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill,
                  backgroundColor: filterTab === key ? C.blue : (isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF'),
                  borderWidth: B.default,
                  borderColor: filterTab === key ? C.blue : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: filterTab === key ? '#FFFFFF' : lSecondary(isDark),
                }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── List ── */}
        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <View style={{ paddingTop: 8 }}>
              {[0, 1, 2, 3].map((i) => <LeaveCardSkeleton key={i} isDark={isDark} />)}
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Calendar}
              iconColor={C.blue}
              title="Belum ada pengajuan"
              message={'Ketuk "Ajukan" untuk membuat pengajuan baru'}
            />
          ) : (
            filtered.map((item) => (
              <LeaveCard
                key={item.id}
                item={item}
                isDark={isDark}
                onPress={() => setSelectedLeave(item)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Detail Bottom Sheet ── */}
      <Modal
        visible={selectedLeave !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLeave(null)}
      >
        {selectedLeave && (() => {
          const item = selectedLeave;
          const color = LEAVE_TYPE_COLORS[item.type] ?? C.blue;
          const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
          return (
            <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
              {/* Header */}
              <View style={{
                paddingTop: 20, paddingHorizontal: 20, paddingBottom: 14,
                borderBottomWidth: B.default,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.5 }}>
                  Detail Pengajuan
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedLeave(null)}
                  style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EBEBF0', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} color={lSecondary(isDark)} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
                {/* Type badge + status */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 44, height: 44, borderRadius: R.md, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={22} color={color} strokeWidth={1.8} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.4 }}>
                      {LEAVE_TYPE_LABELS[item.type]}
                    </Text>
                  </View>
                  <StatusBadge label={statusMeta.label} color={statusMeta.color} dot />
                </View>

                {/* Info rows */}
                {[
                  { label: 'Tanggal Mulai', value: fmtDate(item.start_date) },
                  { label: 'Tanggal Selesai', value: fmtDate(item.end_date) },
                  { label: 'Total Hari', value: `${item.total_days} hari` },
                  { label: 'Diajukan', value: fmtDate(item.created_at) },
                ].map(({ label, value }) => (
                  <View key={label} style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 13,
                    borderBottomWidth: B.default,
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  }}>
                    <Text style={{ fontSize: 14, color: lTertiary(isDark) }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark) }}>{value}</Text>
                  </View>
                ))}

                {/* Reason */}
                {item.reason ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Alasan
                    </Text>
                    <View style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFF',
                      borderRadius: R.md, borderWidth: B.default,
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                      padding: 14,
                    }}>
                      <Text style={{ fontSize: 14, color: lSecondary(isDark), lineHeight: 20 }}>
                        {item.reason}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Lampiran */}
                {item.attachment_url ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Lampiran
                    </Text>
                    <Image
                      source={{ uri: item.attachment_url }}
                      style={{ width: '100%', height: 200, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F5' }}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}

                {/* Reject reason */}
                {item.reject_reason ? (
                  <View style={{ marginTop: 12, backgroundColor: C.red + '12', borderRadius: R.md, padding: 14, borderWidth: B.default, borderColor: C.red + '25' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.red, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Alasan Penolakan</Text>
                    <Text style={{ fontSize: 14, color: C.red, lineHeight: 20 }}>{item.reject_reason}</Text>
                  </View>
                ) : null}

                {/* Cancel button — only for pending */}
                {item.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Batalkan Pengajuan',
                        'Yakin ingin membatalkan pengajuan ini?',
                        [
                          { text: 'Tidak', style: 'cancel' },
                          {
                            text: 'Ya, Batalkan',
                            style: 'destructive',
                            onPress: () => cancelMutation.mutate(item.id),
                          },
                        ],
                      );
                    }}
                    disabled={cancelMutation.isPending}
                    style={{
                      marginTop: 24, height: 52, borderRadius: R.md,
                      backgroundColor: C.red + '15',
                      borderWidth: B.default, borderColor: C.red + '30',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {cancelMutation.isPending ? (
                      <ActivityIndicator color={C.red} />
                    ) : (
                      <Text style={{ fontSize: 16, fontWeight: '700', color: C.red }}>
                        Batalkan Pengajuan
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Form Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: pageBg(isDark) }}
        >
          <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: B.default, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.5 }}>
                Ajukan Cuti / Izin
              </Text>
              <TouchableOpacity
                onPress={() => { setShowForm(false); resetForm(); }}
                style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EBEBF0', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color={lSecondary(isDark)} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Jenis Cuti */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Jenis
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {LEAVE_TYPES.map((t) => {
                const active = leaveType === t;
                const color  = LEAVE_TYPE_COLORS[t];
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setLeaveType(t)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.md,
                      backgroundColor: active ? color : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF'),
                      borderWidth: B.default,
                      borderColor: active ? color : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#FFFFFF' : lSecondary(isDark) }}>
                      {LEAVE_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tanggal */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Periode
            </Text>
            <DateRow label="Mulai"    date={startDate} isDark={isDark} onPress={() => setPickerFor('start')} />
            <DateRow label="Selesai"  date={endDate}   isDark={isDark} onPress={() => setPickerFor('end')} />

            {pickerFor && (
              <DateTimePicker
                value={pickerFor === 'start' ? startDate : endDate}
                mode="date"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) {
                    if (pickerFor === 'start') {
                      setStartDate(selected);
                      if (selected > endDate) setEndDate(selected);
                    } else {
                      setEndDate(selected < startDate ? startDate : selected);
                    }
                  }
                  setPickerFor(null);
                }}
              />
            )}

            {/* Alasan */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 10 }}>
              Alasan
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Tuliskan alasan pengajuan..."
              placeholderTextColor={lTertiary(isDark)}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                borderRadius: R.md,
                paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, color: lPrimary(isDark),
                textAlignVertical: 'top',
                minHeight: 90,
                marginBottom: 24,
              }}
            />

            {/* Lampiran */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 10 }}>
              Lampiran <Text style={{ fontWeight: '400', textTransform: 'none' }}>(opsional)</Text>
            </Text>

            {attachmentUri ? (
              <View style={{ marginBottom: 20 }}>
                <Image
                  source={{ uri: attachmentUri }}
                  style={{ width: '100%', height: 180, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F5' }}
                  resizeMode="cover"
                />
                {isUploading && (
                  <View style={{ position: 'absolute', inset: 0, borderRadius: R.md, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#FFFFFF" />
                    <Text style={{ color: '#FFF', fontSize: 13, marginTop: 8 }}>Mengupload...</Text>
                  </View>
                )}
                {!isUploading && attachmentUrl && (
                  <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>✓ Terupload</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => { setAttachmentUri(null); setAttachmentUrl(null); }}
                  style={{ position: 'absolute', top: 8, left: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={15} color="#FFF" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickAttachment}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                  borderStyle: 'dashed', borderRadius: R.md,
                  paddingVertical: 20, marginBottom: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA',
                }}
              >
                <Paperclip size={18} color={lTertiary(isDark)} strokeWidth={1.8} />
                <Text style={{ fontSize: 14, color: lSecondary(isDark) }}>Pilih foto lampiran</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { if (!createMutation.isPending && !isUploading) createMutation.mutate(); }}
              disabled={!reason.trim() || createMutation.isPending || isUploading}
              style={{
                height: 52, borderRadius: R.md,
                backgroundColor: reason.trim() && !isUploading ? C.blue : (isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E8'),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: reason.trim() && !isUploading ? '#FFFFFF' : lTertiary(isDark) }}>
                  Kirim Pengajuan
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
