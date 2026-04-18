/**
 * SCREEN TUKAR JADWAL
 * Karyawan dapat mengajukan dan merespons permintaan tukar jadwal
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, useColorScheme, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Search, XCircle, Users, ChevronRight, ChevronLeft,
  ChevronDown, Plus, ArrowLeftRight, Sun, Clock, Briefcase, UserPlus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  scheduleSwapService,
  SwapRequest,
  SwapType,
  SWAP_STATUS_LABELS,
  SWAP_STATUS_COLORS,
} from '@/services/schedule-swap.service';
import api from '@/services/api';
import type { UserSchedule } from '@/services/schedule.service';
import { C, R, B, S, T, cardBg, pageBg, lPrimary, lSecondary, lTertiary, gradients } from '@/constants/tokens';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDateWeekday as fmtDate, toISODate } from '@/utils/dateFormatter';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserOption {
  id: string;
  full_name: string;
  employee_id?: string;
  department?: { name: string } | null;
  position?: { name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ── User Search Picker ────────────────────────────────────────────────────────

function UserPickerModal({
  visible, onClose, onSelect, isDark, excludeId,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (user: UserOption) => void;
  isDark: boolean;
  excludeId?: string;
}) {
  const [q, setQ] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users-search', searchTerm],
    queryFn: () =>
      api.get('/users/colleagues', { params: { search: searchTerm || undefined } })
         .then((r) => (r.data?.items ?? []) as UserOption[]),
    enabled: visible,
    staleTime: 30_000,
  });

  const users = (data ?? []).filter((u) => u.id !== excludeId);

  function handleChangeText(text: string) {
    setQ(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearchTerm(text.trim()), 400);
  }

  function handleClose() {
    setQ('');
    setSearchTerm('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
        {/* Header */}
        <View style={{
          paddingTop: 20, paddingHorizontal: 20, paddingBottom: 14,
          borderBottomWidth: B.default,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: isDark ? '#FFF' : '#0F172A', letterSpacing: -0.5 }}>
              Pilih Rekan
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                width: 36, height: 36, borderRadius: R.sm,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EBEBF0',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={20} strokeWidth={2} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
            borderRadius: R.md, borderWidth: B.default,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            paddingHorizontal: 14, paddingVertical: 11,
          }}>
            <Search size={16} strokeWidth={2} color={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'} />
            <TextInput
              value={q}
              onChangeText={handleChangeText}
              placeholder="Cari nama karyawan..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
              autoFocus
              style={{ flex: 1, fontSize: 15, color: isDark ? '#FFF' : '#0F172A' }}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => { setQ(''); setSearchTerm(''); }}>
                <XCircle size={18} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.orange} />
          </View>
        ) : users.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Users size={40} strokeWidth={1.4} color={isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'} />
            <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>
              {q ? 'Tidak ada karyawan ditemukan' : 'Belum ada karyawan'}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {users.map((item, i) => (
              <TouchableOpacity
                key={item.id ? `u-${item.id}` : `u-idx-${i}`}
                onPress={() => { onSelect(item); handleClose(); }}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderRadius: R.md, borderWidth: B.default,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  padding: 12, marginBottom: 8,
                }}
              >
                {/* Avatar */}
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: C.orange + '18',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.orange }}>
                    {initials(item.full_name ?? '')}
                  </Text>
                </View>
                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                    {item.full_name ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8', marginTop: 1 }}>
                    {[item.position?.name, item.department?.name].filter(Boolean).join(' · ') || item.employee_id || '—'}
                  </Text>
                </View>
                <ChevronRight size={16} strokeWidth={2} color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Swap Card ─────────────────────────────────────────────────────────────────

function SwapCard({
  item, userId, isDark,
  onRespond, onCancel,
}: {
  item: SwapRequest;
  userId?: string;
  isDark: boolean;
  onRespond: (id: string, approved: boolean) => void;
  onCancel: (id: string) => void;
}) {
  const isTarget    = item.target_user?.id === userId;
  const isRequester = item.requester?.id === userId;

  return (
    <View style={{
      backgroundColor: cardBg(isDark),
      borderRadius: R.lg, borderWidth: B.default,
      borderColor: isDark ? C.separator.dark : C.separator.light,
      padding: 16, marginBottom: 10,
      ...(isDark ? S.cardDark : S.card),
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
          <View style={{
            width: 38, height: 38, borderRadius: R.sm,
            backgroundColor: C.orange + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftRight size={18} strokeWidth={2} color={C.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark) }}>
              {item.type === 'with_person' ? 'Tukar dengan Rekan' : 'Tukar dengan Hari Libur'}
            </Text>
            <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }}>
              {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
            </Text>
          </View>
        </View>
        <StatusBadge
          label={(SWAP_STATUS_LABELS as Record<string, string>)[item.status] ?? item.status}
          color={(SWAP_STATUS_COLORS as Record<string, string>)[item.status] ?? '#8E8E93'}
          dot
        />
      </View>

      {/* Jadwal Detail */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={{
          flex: 1, backgroundColor: C.blue + '12', borderRadius: R.sm - 2,
          padding: 10, borderWidth: B.default, borderColor: C.blue + '25',
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
            {item.requester?.full_name ?? 'Pemohon'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: lPrimary(isDark) }}>
            {fmtDate(item.requester_date)}
          </Text>
          {item.requester_shift && (
            <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 2 }}>
              {item.requester_shift.name} · {item.requester_shift.start_time.slice(0, 5)}–{item.requester_shift.end_time.slice(0, 5)}
            </Text>
          )}
        </View>
        <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeftRight size={16} strokeWidth={2} color={lTertiary(isDark)} />
        </View>
        <View style={{
          flex: 1, backgroundColor: C.green + '12', borderRadius: R.sm - 2,
          padding: 10, borderWidth: B.default, borderColor: C.green + '25',
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
            {item.type === 'with_person' ? (item.target_user?.full_name ?? 'Target') : 'Libur Sendiri'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: lPrimary(isDark) }}>
            {fmtDate(item.target_date)}
          </Text>
          {item.target_shift && (
            <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 2 }}>
              {item.target_shift.name} · {item.target_shift.start_time.slice(0, 5)}–{item.target_shift.end_time.slice(0, 5)}
            </Text>
          )}
        </View>
      </View>

      {item.notes ? (
        <Text style={{ fontSize: 13, color: lSecondary(isDark), fontStyle: 'italic', marginBottom: 8 }}>
          "{item.notes}"
        </Text>
      ) : null}

      {item.reject_reason ? (
        <View style={{
          backgroundColor: C.red + '12', borderRadius: R.sm - 2,
          padding: 10, borderWidth: B.default, borderColor: C.red + '25', marginBottom: 8,
        }}>
          <Text style={{ fontSize: 12, color: C.red }}>Ditolak: {item.reject_reason}</Text>
        </View>
      ) : null}

      {/* Actions */}
      {isTarget && item.status === 'pending_target' && (
        <View style={{
          flexDirection: 'row', gap: 8, paddingTop: 10,
          borderTopWidth: B.default, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }}>
          <TouchableOpacity
            onPress={() => onRespond(item.id, false)}
            style={{
              flex: 1, height: 42, borderRadius: R.md,
              backgroundColor: C.red + '14', borderWidth: B.default, borderColor: C.red + '30',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Tolak</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRespond(item.id, true)}
            style={{
              flex: 1, height: 42, borderRadius: R.md,
              backgroundColor: C.green + '14', borderWidth: B.default, borderColor: C.green + '30',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.green }}>Setujui</Text>
          </TouchableOpacity>
        </View>
      )}

      {isRequester && ['pending_target', 'pending_admin'].includes(item.status) && (
        <View style={{
          paddingTop: 10,
          borderTopWidth: B.default, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }}>
          <TouchableOpacity
            onPress={() => onCancel(item.id)}
            style={{
              height: 40, borderRadius: R.md,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F5F5F7',
              borderWidth: B.default,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>
              Batalkan Permintaan
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
        paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 14, color: lSecondary(isDark) }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: lPrimary(isDark) }}>
          {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </Text>
        <ChevronDown size={14} strokeWidth={2} color={lTertiary(isDark)} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ScheduleSwapScreen() {
  const isDark      = useColorScheme() === 'dark';
  const insets      = useSafeAreaInsets();
  const qc          = useQueryClient();

  // Current user id (untuk filter sendiri di picker)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  // Form visibility
  const [showForm, setShowForm]         = useState(false);
  const [showPicker, setShowPicker]     = useState(false);

  // Form state
  const [swapType, setSwapType]               = useState<SwapType>('with_own_dayoff');
  const [requesterDate, setRequesterDate]     = useState(new Date());
  const [targetDate, setTargetDate]           = useState(new Date());
  const [selectedUser, setSelectedUser]       = useState<UserOption | null>(null);
  const [notes, setNotes]                     = useState('');
  const [pickerFor, setPickerFor]             = useState<'requester' | 'target' | null>(null);

  // Load current user once
  const { data: meData } = useQuery({
    queryKey: ['user-profile-id'],
    queryFn: () => api.get('/users/me').then((r) => r.data as { id: string }),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (meData?.id) setCurrentUserId(meData.id);
  }, [meData?.id]);

  // Shift preview queries (hanya aktif saat form terbuka)
  const requesterDateStr = toISODate(requesterDate);
  const targetDateStr    = toISODate(targetDate);

  const { data: myShiftData } = useQuery({
    queryKey: ['my-schedule-date', requesterDateStr],
    queryFn: () =>
      api.get<UserSchedule[]>('/schedules/me', { params: { date: requesterDateStr } })
         .then((r) => r.data[0] ?? null),
    enabled: showForm,
    staleTime: 60_000,
  });

  const { data: targetShiftData } = useQuery({
    queryKey: ['user-schedule-date', selectedUser?.id, targetDateStr],
    queryFn: () =>
      api.get<UserSchedule[]>(`/schedules/user/${selectedUser!.id}`, { params: { date: targetDateStr } })
         .then((r) => r.data[0] ?? null),
    enabled: showForm && swapType === 'with_person' && !!selectedUser?.id,
    staleTime: 60_000,
  });

  // Main list query
  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ['my-swap-requests'],
    queryFn: () => scheduleSwapService.getMyRequests(),
  });

  const swaps = result?.items ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => scheduleSwapService.create({
      type: swapType,
      requester_date: toISODate(requesterDate),
      target_date:    toISODate(targetDate),
      target_user_id: swapType === 'with_person' && selectedUser ? selectedUser.id : undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-swap-requests'] });
      setShowForm(false);
      resetForm();
      Alert.alert('Berhasil', 'Permintaan tukar jadwal telah dikirim.');
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan');
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      scheduleSwapService.respond(id, approved),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-swap-requests'] }),
    onError: (err: any) => Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => scheduleSwapService.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-swap-requests'] }),
    onError: (err: any) => Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan'),
  });

  function resetForm() {
    setSwapType('with_own_dayoff');
    setRequesterDate(new Date());
    setTargetDate(new Date());
    setSelectedUser(null);
    setNotes('');
  }

  function handleRespond(id: string, approved: boolean) {
    Alert.alert(
      approved ? 'Setujui' : 'Tolak',
      approved ? 'Setujui permintaan tukar jadwal ini?' : 'Tolak permintaan tukar jadwal ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: approved ? 'Setujui' : 'Tolak',
          style: approved ? 'default' : 'destructive',
          onPress: () => respondMutation.mutate({ id, approved }),
        },
      ],
    );
  }

  function handleCancel(id: string) {
    Alert.alert('Batalkan', 'Yakin ingin membatalkan permintaan ini?', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Batalkan', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  }

  const pendingCount = swaps.filter((s) => ['pending_target', 'pending_admin'].includes(s.status)).length;
  const canSubmit    = swapType === 'with_own_dayoff' || (swapType === 'with_person' && !!selectedUser);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isDark && (
        <LinearGradient
          colors={gradients.heroSwap}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={isDark ? '#FFF' : C.orange}
          />
        }
      >
        {/* ── Header ── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
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
              <ChevronLeft size={20} strokeWidth={2.5} color={lPrimary(isDark)} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.title1, color: lPrimary(isDark) }}>
                Tukar Jadwal
              </Text>
              <Text style={{ ...T.footnote, color: lSecondary(isDark), marginTop: 2 }}>
                {pendingCount > 0 ? `${pendingCount} menunggu respons` : 'Ajukan atau lihat permintaan tukar jadwal'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 9,
                backgroundColor: C.orange, borderRadius: R.md,
              }}
            >
              <Plus size={18} strokeWidth={2.5} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Ajukan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── List ── */}
        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
          ) : swaps.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              iconColor={C.orange}
              title="Belum ada permintaan"
              message='Ketuk "Ajukan" untuk membuat permintaan tukar jadwal'
            />
          ) : (
            swaps.map((item, i) => (
              <SwapCard
                key={item.id ? `s-${item.id}` : `s-idx-${i}`}
                item={item}
                userId={meData?.id ?? currentUserId}
                isDark={isDark}
                onRespond={handleRespond}
                onCancel={handleCancel}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Form Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: pageBg(isDark) }}
        >
          {/* Modal Header */}
          <View style={{
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: 14,
            borderBottomWidth: B.default,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.5 }}>
                Ajukan Tukar Jadwal
              </Text>
              <TouchableOpacity
                onPress={() => { setShowForm(false); resetForm(); }}
                style={{
                  width: 36, height: 36, borderRadius: R.sm,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EBEBF0',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={20} strokeWidth={2} color={lSecondary(isDark)} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            {/* ── Tipe Tukar ── */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Jenis Tukar
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {([
                { key: 'with_own_dayoff' as SwapType, label: 'Tukar dengan\nHari Libur Saya', Icon: Sun   },
                { key: 'with_person'     as SwapType, label: 'Tukar dengan\nRekan',           Icon: Users },
              ]).map(({ key, label, Icon }) => {
                const active = swapType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => { setSwapType(key); setSelectedUser(null); }}
                    style={{
                      flex: 1, padding: 14, borderRadius: R.md,
                      backgroundColor: active ? C.orange : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF'),
                      borderWidth: B.default,
                      borderColor: active ? C.orange : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                      alignItems: 'center', gap: 8,
                    }}
                  >
                    <Icon size={22} strokeWidth={1.8} color={active ? '#FFFFFF' : lSecondary(isDark)} />
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: active ? '#FFFFFF' : lSecondary(isDark),
                      textAlign: 'center', lineHeight: 17,
                    }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Tanggal Kerja Saya ── */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Tanggal Jadwal Saya
            </Text>
            <DateRow
              label="Tanggal kerja yang akan dipindah"
              date={requesterDate}
              isDark={isDark}
              onPress={() => setPickerFor('requester')}
            />
            {myShiftData && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginBottom: 10, marginTop: -4,
              }}>
                {myShiftData.is_day_off ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.red + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <XCircle size={13} strokeWidth={2} color={C.red} />
                    <Text style={{ fontSize: 12, color: C.red, fontWeight: '600' }}>Hari libur — tidak bisa dipindah</Text>
                  </View>
                ) : myShiftData.shift_type ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.blue + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Clock size={13} strokeWidth={2} color={C.blue} />
                    <Text style={{ fontSize: 12, color: C.blue, fontWeight: '600' }}>
                      {myShiftData.shift_type.name} · {myShiftData.start_time?.slice(0,5)}–{myShiftData.end_time?.slice(0,5)}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.green + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Briefcase size={13} strokeWidth={2} color={C.green} />
                    <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>Hari kerja (office hours)</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Tanggal Target ── */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 10 }}>
              {swapType === 'with_own_dayoff' ? 'Hari Libur Saya (jadi hari kerja)' : 'Tanggal Jadwal Rekan'}
            </Text>
            <DateRow
              label={swapType === 'with_own_dayoff' ? 'Pilih hari libur saya' : 'Tanggal jadwal rekan'}
              date={targetDate}
              isDark={isDark}
              onPress={() => setPickerFor('target')}
            />
            {swapType === 'with_person' && targetShiftData && selectedUser && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                marginBottom: 10, marginTop: -4,
              }}>
                {targetShiftData.is_day_off ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.orange + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Sun size={13} strokeWidth={2} color={C.orange} />
                    <Text style={{ fontSize: 12, color: C.orange, fontWeight: '600' }}>Libur — {selectedUser.full_name?.split(' ')[0]}</Text>
                  </View>
                ) : targetShiftData.shift_type ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.green + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Clock size={13} strokeWidth={2} color={C.green} />
                    <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>
                      {targetShiftData.shift_type.name} · {targetShiftData.start_time?.slice(0,5)}–{targetShiftData.end_time?.slice(0,5)}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.green + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Briefcase size={13} strokeWidth={2} color={C.green} />
                    <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>Hari kerja (office hours)</Text>
                  </View>
                )}
              </View>
            )}

            {pickerFor && (
              <DateTimePicker
                value={pickerFor === 'requester' ? requesterDate : targetDate}
                mode="date"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) {
                    if (pickerFor === 'requester') setRequesterDate(selected);
                    else setTargetDate(selected);
                  }
                  setPickerFor(null);
                }}
              />
            )}

            {/* ── Pilih Rekan (only with_person) ── */}
            {swapType === 'with_person' && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 10 }}>
                  Pilih Rekan
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPicker(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                    borderRadius: R.md, borderWidth: B.default,
                    borderColor: selectedUser
                      ? C.orange
                      : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'),
                    paddingHorizontal: 14, paddingVertical: 12,
                    marginBottom: 4, gap: 12,
                  }}
                >
                  {selectedUser ? (
                    <>
                      <View style={{
                        width: 38, height: 38, borderRadius: 19,
                        backgroundColor: C.orange + '20',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.orange }}>
                          {initials(selectedUser.full_name ?? '')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark) }}>
                          {selectedUser.full_name ?? '—'}
                        </Text>
                        <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }}>
                          {[selectedUser.position?.name, selectedUser.department?.name].filter(Boolean).join(' · ') || '—'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSelectedUser(null)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <XCircle size={20} strokeWidth={1.8} color={lTertiary(isDark)} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={{
                        width: 38, height: 38, borderRadius: 19,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F5',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <UserPlus size={18} strokeWidth={1.8} color={lTertiary(isDark)} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: lTertiary(isDark) }}>
                        Pilih rekan kerja...
                      </Text>
                      <ChevronRight size={16} strokeWidth={2} color={lTertiary(isDark)} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── Catatan ── */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: lTertiary(isDark), textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 10 }}>
              Catatan (opsional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Alasan atau catatan tambahan..."
              placeholderTextColor={lTertiary(isDark)}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, color: lPrimary(isDark),
                textAlignVertical: 'top', minHeight: 80, marginBottom: 24,
              }}
            />

            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              style={{
                height: 52, borderRadius: R.md,
                backgroundColor: canSubmit ? C.orange : (isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E8'),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: canSubmit ? '#FFFFFF' : lTertiary(isDark) }}>
                  Kirim Permintaan
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* ── User Picker — nested di dalam form modal agar stack benar ── */}
          <UserPickerModal
            visible={showPicker}
            isDark={isDark}
            excludeId={meData?.id ?? currentUserId}
            onClose={() => setShowPicker(false)}
            onSelect={(user) => setSelectedUser(user)}
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
