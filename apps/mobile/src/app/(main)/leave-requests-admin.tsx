/**
 * Halaman DIREKTUR — persetujuan pengajuan cuti & izin karyawan
 */
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useColorScheme,
  RefreshControl, StatusBar, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ClipboardList, CheckCircle2, XCircle, Calendar, ShieldOff,
  User, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { C, R, B, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  leaveService,
  type LeaveRequest,
  type LeaveStatus,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
} from '@/services/leave.service';
import { useAuthStore } from '@/stores/auth.store';
import * as Haptics from 'expo-haptics';

const APPROVER_ROLES = ['admin', 'manager', 'super_admin', 'direktur'] as const;

type FilterStatus = LeaveStatus | 'all';

const STATUS_LABEL: Record<string, string> = {
  all:      'Semua',
  pending:  'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const STATUS_COLOR: Record<string, string> = {
  pending:  C.orange,
  approved: C.green,
  rejected: C.red,
};

function LeaveRequestCard({
  req,
  isDark,
  onApprove,
  onReject,
}: {
  req: LeaveRequest;
  isDark: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = req.status === 'pending';
  const typeColor = LEAVE_TYPE_COLORS[req.type] ?? C.blue;
  const statusColor = STATUS_COLOR[req.status] ?? C.orange;

  const dateRange = req.start_date === req.end_date
    ? new Date(req.start_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric' })
    : `${new Date(req.start_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short' })} – ${new Date(req.end_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <View style={{
      backgroundColor: cardBg(isDark),
      borderRadius: R.lg,
      borderWidth: B.default,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
      borderLeftWidth: 4,
      borderLeftColor: typeColor,
      marginBottom: 10,
      overflow: 'hidden',
    }}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        style={{ padding: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: typeColor + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={20} strokeWidth={1.8} color={typeColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: lPrimary(isDark) }}>
              {req.user?.full_name ?? 'Karyawan'}
            </Text>
            <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}>
              {LEAVE_TYPE_LABELS[req.type]} · {dateRange} ({req.total_days} hari)
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={{ backgroundColor: statusColor + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
                {STATUS_LABEL[req.status]}
              </Text>
            </View>
            {expanded
              ? <ChevronUp size={14} strokeWidth={2} color={lTertiary(isDark)} />
              : <ChevronDown size={14} strokeWidth={2} color={lTertiary(isDark)} />
            }
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{
          borderTopWidth: 0.5,
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          padding: 14,
          gap: 8,
        }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <User size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
              {req.user?.full_name ?? '—'}
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: lPrimary(isDark) }}>Alasan: </Text>
            {req.reason}
          </Text>

          {req.reject_reason && (
            <Text style={{ fontSize: 12, color: lTertiary(isDark), fontStyle: 'italic' }}>
              Alasan penolakan: {req.reject_reason}
            </Text>
          )}

          {isPending && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => onApprove(req.id)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 10, borderRadius: R.md,
                  backgroundColor: C.green + '18', borderWidth: 1, borderColor: C.green + '40',
                }}
              >
                <CheckCircle2 size={16} strokeWidth={2} color={C.green} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.green }}>Setujui</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onReject(req.id)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 10, borderRadius: R.md,
                  backgroundColor: C.red + '18', borderWidth: 1, borderColor: C.red + '40',
                }}
              >
                <XCircle size={16} strokeWidth={2} color={C.red} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Tolak</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function LeaveRequestsAdminScreen() {
  const isDark  = useColorScheme() === 'dark';
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);

  const isApprover = !!user?.role?.can_approve
    || APPROVER_ROLES.includes((user?.role?.name?.toLowerCase() ?? '') as typeof APPROVER_ROLES[number]);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [rejectInput, setRejectInput]   = useState('');
  const [pendingReject, setPendingReject] = useState<string | null>(null);

  const { data: requests = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['leave-requests-admin', filterStatus],
    queryFn: () => leaveService.getPendingForApprover(filterStatus === 'all' ? undefined : filterStatus),
    enabled: !!isApprover,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['leave-requests-admin'] });
  }, [qc]);

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveService.approve(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menyetujui pengajuan.'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leaveService.rejectRequest(id, reason),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      setPendingReject(null);
      setRejectInput('');
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menolak pengajuan.'),
  });

  const handleApprove = (id: string) => {
    Alert.alert(
      'Setujui Pengajuan?',
      'Saldo cuti karyawan akan dikurangi sesuai jumlah hari.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Setujui', onPress: () => approveMut.mutate(id) },
      ],
    );
  };

  const handleReject = (id: string) => {
    setPendingReject(id);
    setRejectInput('');
  };

  const handleConfirmReject = () => {
    if (!pendingReject) return;
    if (!rejectInput.trim()) {
      Alert.alert('Alasan diperlukan', 'Masukkan alasan penolakan.');
      return;
    }
    rejectMut.mutate({ id: pendingReject, reason: rejectInput.trim() });
  };

  const bg = pageBg(isDark);
  const isActing = approveMut.isPending || rejectMut.isPending;

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (!isApprover) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ShieldOff size={40} strokeWidth={1.5} color={lTertiary(isDark)} />
        <Text style={{ marginTop: 12, fontSize: 14, color: lTertiary(isDark) }}>Akses tidak diizinkan</Text>
      </View>
    );
  }

  const STATUS_FILTERS: FilterStatus[] = ['pending', 'approved', 'rejected'];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <BackHeader
        title="Persetujuan Cuti & Izin"
        subtitle={`${requests.filter((r) => r.status === 'pending').length} menunggu persetujuan`}
        onBack={() => router.back()}
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}
      >
        {STATUS_FILTERS.map((s) => {
          const active = filterStatus === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setFilterStatus(s)}
              style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                backgroundColor: active
                  ? (s === 'pending' ? C.orange : s === 'approved' ? C.green : C.red)
                  : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
              }}
            >
              <Text style={{
                fontSize: 13, fontWeight: active ? '700' : '500',
                color: active ? '#FFF' : lSecondary(isDark),
              }}>
                {STATUS_LABEL[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.blue}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 48 }} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Tidak ada pengajuan"
            message={filterStatus === 'pending' ? 'Tidak ada pengajuan yang menunggu persetujuan.' : 'Tidak ada riwayat pengajuan.'}
          />
        ) : (
          requests.map((req) => (
            <LeaveRequestCard
              key={req.id}
              req={req}
              isDark={isDark}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </ScrollView>

      {/* Modal tolak — input alasan */}
      {pendingReject && (
        <View style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center', justifyContent: 'flex-end',
        }}>
          <View style={{
            width: '100%',
            backgroundColor: cardBg(isDark),
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: insets.bottom + 24,
            gap: 16,
          }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: lPrimary(isDark) }}>
              Alasan Penolakan
            </Text>
            <TextInput
              value={rejectInput}
              onChangeText={setRejectInput}
              placeholder="Tulis alasan penolakan..."
              placeholderTextColor={lTertiary(isDark)}
              multiline
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                borderRadius: R.md, padding: 14,
                fontSize: 14, color: lPrimary(isDark),
                minHeight: 80, textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setPendingReject(null); setRejectInput(''); }}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: R.md,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: lSecondary(isDark) }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReject}
                disabled={isActing}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: R.md,
                  backgroundColor: C.red,
                  alignItems: 'center', opacity: isActing ? 0.6 : 1,
                }}
              >
                {rejectMut.isPending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Tolak</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
