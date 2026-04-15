/**
 * SCREEN CUTI & IZIN
 * Karyawan dapat melihat riwayat dan mengajukan cuti / izin
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, useColorScheme, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  leaveService,
  LeaveRequest,
  LeaveType,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
} from '@/services/leave.service';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu', color: '#FF9500' },
  approved: { label: 'Disetujui', color: '#34C759' },
  rejected: { label: 'Ditolak',   color: '#FF3B30' },
};

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: m.color + '18',
      borderRadius: 20, borderWidth: B.default, borderColor: m.color + '30',
      paddingHorizontal: 10, paddingVertical: 4,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: m.color }}>{m.label}</Text>
    </View>
  );
}

// ── Leave Request Card ────────────────────────────────────────────────────────

function LeaveCard({ item, isDark }: { item: LeaveRequest; isDark: boolean }) {
  const color = LEAVE_TYPE_COLORS[item.type] ?? C.blue;
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
            <Ionicons name="calendar-outline" size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark) }}>
              {LEAVE_TYPE_LABELS[item.type]}
            </Text>
            <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }}>
              {fmtDate(item.start_date)} – {fmtDate(item.end_date)} · {item.total_days} hari
            </Text>
          </View>
        </View>
        <StatusChip status={item.status} />
      </View>

      {item.reason ? (
        <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 18 }} numberOfLines={2}>
          {item.reason}
        </Text>
      ) : null}

      {item.reject_reason ? (
        <View style={{ marginTop: 8, backgroundColor: '#FF3B3012', borderRadius: R.sm - 2, padding: 10, borderWidth: B.default, borderColor: '#FF3B3025' }}>
          <Text style={{ fontSize: 12, color: '#FF3B30' }}>Ditolak: {item.reject_reason}</Text>
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
          {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <Ionicons name="chevron-down" size={14} color={lTertiary(isDark)} />
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
  const { data: balance } = useQuery({
    queryKey: ['my-leave-balance'],
    queryFn: () => leaveService.getMyBalance(),
  });

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => leaveService.getMyRequests(),
  });

  const createMutation = useMutation({
    mutationFn: () => leaveService.create({
      type: leaveType,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balance'] });
      setShowForm(false);
      resetForm();
      Alert.alert('Berhasil', 'Pengajuan berhasil dikirim. Menunggu persetujuan admin.');
    },
    onError: (err: any) => {
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
          colors={['#0D1A28', '#0A0A0F']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={isDark ? '#FFF' : C.blue} />
        }
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40, height: 40, borderRadius: R.sm,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <Ionicons name="chevron-back" size={20} color={lPrimary(isDark)} />
              </TouchableOpacity>
              <View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.8 }}>
                  Cuti & Izin
                </Text>
                <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                  Kelola pengajuan cuti dan izin Anda
                </Text>
              </View>
            </View>
          </View>

          {/* Saldo Card */}
          {balance && (
            <View style={{
              marginTop: 16,
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
        </View>

        {/* ── Filter Tabs + New Button ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FILTER_TABS.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFilterTab(key)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
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
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 9,
                backgroundColor: C.blue, borderRadius: R.md,
              }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Ajukan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── List ── */}
        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.blue + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={30} color={C.blue} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: lPrimary(isDark), marginBottom: 6 }}>
                Belum ada pengajuan
              </Text>
              <Text style={{ fontSize: 14, color: lSecondary(isDark), textAlign: 'center' }}>
                Ketuk "Ajukan" untuk membuat pengajuan baru
              </Text>
            </View>
          ) : (
            filtered.map((item) => <LeaveCard key={item.id} item={item} isDark={isDark} />)
          )}
        </View>
      </ScrollView>

      {/* ── Form Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F2F2F7' }}
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
                <Ionicons name="close" size={20} color={lSecondary(isDark)} />
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
