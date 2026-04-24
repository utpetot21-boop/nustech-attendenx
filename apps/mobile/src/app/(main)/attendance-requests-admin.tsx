/**
 * Halaman admin — persetujuan izin terlambat & izin pulang awal
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useColorScheme,
  RefreshControl, StatusBar, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ClipboardList, CheckCircle2, XCircle, Clock, LogIn, LogOut,
  User, ChevronDown, ChevronUp, ShieldOff,
} from 'lucide-react-native';
import { C, R, B, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { attendanceRequestsService, type AttendanceRequestAdmin } from '@/services/attendance-requests.service';
import { useAuthStore } from '@/stores/auth.store';
import * as Haptics from 'expo-haptics';

const APPROVER_ROLES = ['admin', 'manager', 'super_admin'] as const;

type FilterStatus = 'pending' | 'approved' | 'rejected';
type FilterType   = 'all' | 'late_arrival' | 'early_departure';

const STATUS_LABEL: Record<string, string> = {
  pending:  'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};
const TYPE_LABEL: Record<string, string> = {
  late_arrival:    'Izin Terlambat',
  early_departure: 'Izin Pulang Awal',
};

function RequestCard({
  req,
  isDark,
  onApprove,
  onReject,
}: {
  req: AttendanceRequestAdmin;
  isDark: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLate   = req.type === 'late_arrival';
  const isPending = req.status === 'pending';

  const statusColor = req.status === 'approved' ? C.green
    : req.status === 'rejected' ? C.red : C.orange;
  const TypeIcon = isLate ? LogIn : LogOut;

  return (
    <View style={{
      backgroundColor: cardBg(isDark),
      borderRadius: R.lg,
      borderWidth: B.default,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
      borderLeftWidth: 4,
      borderLeftColor: isLate ? C.orange : C.purple,
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
            backgroundColor: (isLate ? C.orange : C.purple) + '18',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <TypeIcon size={20} strokeWidth={1.8} color={isLate ? C.orange : C.purple} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: lPrimary(isDark) }}>
              {req.user?.full_name ?? 'Karyawan'}
            </Text>
            <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 1 }}>
              {TYPE_LABEL[req.type]} · {new Date(req.date).toLocaleDateString('id-ID', {
                timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
              })}
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
            <Clock size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
              {req.estimated_time
                ? `Estimasi jam: ${req.estimated_time}`
                : 'Tidak ada estimasi waktu'}
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: lPrimary(isDark) }}>Alasan: </Text>
            {req.reason}
          </Text>

          {req.reviewer_note && (
            <Text style={{ fontSize: 12, color: lTertiary(isDark), fontStyle: 'italic' }}>
              Catatan: {req.reviewer_note}
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

export default function AttendanceRequestsAdminScreen() {
  const isDark  = useColorScheme() === 'dark';
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);

  const isApprover = APPROVER_ROLES.includes(
    (user?.role?.name ?? '') as typeof APPROVER_ROLES[number],
  );

  // Guard: redirect non-approver keluar dari halaman ini
  useEffect(() => {
    if (user !== undefined && !isApprover) {
      router.replace('/(main)/attendance' as never);
    }
  }, [isApprover, user]);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterType,   setFilterType]   = useState<FilterType>('all');
  const [noteInput,    setNoteInput]    = useState('');
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  const { data: requests = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['attendance-requests-admin', filterStatus, filterType],
    queryFn: () => attendanceRequestsService.adminList({
      status: filterStatus,
      type:   filterType === 'all' ? undefined : filterType,
    }),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['attendance-requests-admin'] });
    qc.invalidateQueries({ queryKey: ['attendance-requests', 'pending-count'] });
  }, [qc]);

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      attendanceRequestsService.approve(id, note),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setPendingAction(null);
      setNoteInput('');
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menyetujui permohonan.'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      attendanceRequestsService.reject(id, note),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      setPendingAction(null);
      setNoteInput('');
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menolak permohonan.'),
  });

  const handleApprove = (id: string) => setPendingAction({ id, action: 'approve' });
  const handleReject  = (id: string) => setPendingAction({ id, action: 'reject' });

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.action === 'approve') {
      approveMut.mutate({ id: pendingAction.id, note: noteInput.trim() || undefined });
    } else {
      rejectMut.mutate({ id: pendingAction.id, note: noteInput.trim() || undefined });
    }
  };

  const bg = pageBg(isDark);
  const isActing = approveMut.isPending || rejectMut.isPending;

  // Tampilkan layar kosong saat redirect berjalan (user bukan approver)
  if (!isApprover) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBg(isDark), alignItems: 'center', justifyContent: 'center' }}>
        <ShieldOff size={40} strokeWidth={1.5} color={lTertiary(isDark)} />
        <Text style={{ marginTop: 12, fontSize: 14, color: lTertiary(isDark) }}>Akses tidak diizinkan</Text>
      </View>
    );
  }

  const STATUS_FILTERS: FilterStatus[] = ['pending', 'approved', 'rejected'];
  const TYPE_FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',             label: 'Semua' },
    { key: 'late_arrival',    label: 'Terlambat' },
    { key: 'early_departure', label: 'Pulang Awal' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch}
            tintColor={isDark ? '#FFF' : C.blue} />
        }
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <BackHeader
            title="Permohonan Absensi"
            subtitle="Izin terlambat & pulang awal"
            accentColor={C.orange}
          />

          {/* Filter status */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
            {STATUS_FILTERS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setFilterStatus(s)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: filterStatus === s
                    ? (s === 'pending' ? C.orange : s === 'approved' ? C.green : C.red)
                    : (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'),
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: filterStatus === s ? '#FFF' : lSecondary(isDark),
                }}>
                  {STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filter tipe */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
            {TYPE_FILTERS.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setFilterType(t.key)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                  backgroundColor: filterType === t.key
                    ? C.blue + '18' : 'transparent',
                  borderWidth: 1,
                  borderColor: filterType === t.key ? C.blue + '50' : (isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB'),
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: filterType === t.key ? C.blue : lSecondary(isDark),
                }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <View style={{ paddingHorizontal: 20 }}>
          {isLoading ? (
            <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              iconColor={C.orange}
              title={`Tidak ada permohonan ${STATUS_LABEL[filterStatus].toLowerCase()}`}
            />
          ) : (
            requests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                isDark={isDark}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* Modal konfirmasi approve/reject */}
      {pendingAction && (
        <View style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: cardBg(isDark),
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: insets.bottom + 24,
          }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: lPrimary(isDark), marginBottom: 6 }}>
              {pendingAction.action === 'approve' ? 'Setujui Permohonan?' : 'Tolak Permohonan?'}
            </Text>
            <Text style={{ fontSize: 14, color: lSecondary(isDark), marginBottom: 16 }}>
              Catatan untuk karyawan (opsional):
            </Text>
            <TextInput
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="Tambahkan catatan..."
              placeholderTextColor={lTertiary(isDark)}
              multiline
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: R.md,
                padding: 12,
                fontSize: 14,
                color: lPrimary(isDark),
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setPendingAction(null); setNoteInput(''); }}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: R.md, alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: lSecondary(isDark) }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={isActing}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: R.md, alignItems: 'center',
                  backgroundColor: pendingAction.action === 'approve' ? C.green : C.red,
                  opacity: isActing ? 0.6 : 1,
                }}
              >
                {isActing
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>
                      {pendingAction.action === 'approve' ? 'Setujui' : 'Tolak'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
