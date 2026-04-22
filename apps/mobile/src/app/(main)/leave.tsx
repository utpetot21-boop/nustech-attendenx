/**
 * SCREEN CUTI & IZIN
 * Karyawan dapat melihat riwayat dan mengajukan cuti / izin
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, useColorScheme, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, ChevronDown, ChevronLeft, Plus, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

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

function LeaveCard({ item, isDark }: { item: LeaveRequest; isDark: boolean }) {
  const color = LEAVE_TYPE_COLORS[item.type] ?? C.blue;
  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
  return (
    <View style={{
      backgroundColor: cardBg(isDark),
      borderRadius: R.lg, borderWidth: B.default,
      borderColor: isDark ? C.separator.dark : C.separator.light,
      padding: 16, marginBottom: 10,
      ...(isDark ? S.cardDark : S.card),
    }}>
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
    </View>
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

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('cuti');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate]     = useState(new Date());
  const [reason, setReason]       = useState('');
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);

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

  const createMutation = useMutation({
    mutationFn: () => leaveService.create({
      type: leaveType,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      reason,
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
            filtered.map((item) => <LeaveCard key={item.id} item={item} isDark={isDark} />)
          )}
        </View>
      </ScrollView>

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

            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!reason.trim() || createMutation.isPending}
              style={{
                height: 52, borderRadius: R.md,
                backgroundColor: reason.trim() ? C.blue : (isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E8'),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: reason.trim() ? '#FFFFFF' : lTertiary(isDark) }}>
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
