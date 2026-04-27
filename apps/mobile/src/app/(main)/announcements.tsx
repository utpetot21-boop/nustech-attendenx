import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, RefreshControl, Modal, ActivityIndicator,
  Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Megaphone, Plus, X, Info, AlertTriangle, Sun, BookOpen,
  Pin, Send, CheckCircle2, FileEdit, Trash2, ChevronRight,
  Search, type LucideIcon,
} from 'lucide-react-native';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { C, R, B, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotifCardSkeleton } from '@/components/ui/SkeletonLoader';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'urgent' | 'holiday' | 'policy';
  target_type: 'all' | 'department' | 'individual';
  target_dept_id: string | null;
  target_user_ids: string[] | null;
  is_pinned: boolean;
  send_push: boolean;
  status: 'draft' | 'pending_approval' | 'rejected' | 'sent';
  sent_at: string | null;
  created_at: string;
  rejection_reason: string | null;
  creator?: { full_name: string };
}

interface Department { id: string; name: string }
interface Colleague  { id: string; full_name: string; department?: { name: string } }

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  info:    { label: 'Info',      color: C.blue,   Icon: Info },
  urgent:  { label: 'Urgent',    color: C.red,    Icon: AlertTriangle },
  holiday: { label: 'Libur',     color: C.green,  Icon: Sun },
  policy:  { label: 'Kebijakan', color: C.purple, Icon: BookOpen },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:            { label: 'Draft',     color: '#6B7280' },
  pending_approval: { label: 'Menunggu',  color: C.orange },
  rejected:         { label: 'Ditolak',   color: C.red },
  sent:             { label: 'Terkirim',  color: C.green },
};

type FilterKey = 'all' | 'draft' | 'pending_approval' | 'sent' | 'rejected';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',              label: 'Semua' },
  { key: 'draft',            label: 'Draft' },
  { key: 'pending_approval', label: 'Menunggu' },
  { key: 'sent',             label: 'Terkirim' },
  { key: 'rejected',         label: 'Ditolak' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AnnouncementsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const roleName      = user?.role?.name ?? '';
  const canCreate     = true;
  const canSendDirect = ['manager', 'admin', 'super_admin'].includes(roleName);
  const canApprove    = (user?.role?.permissions?.includes('announcement:approve') ?? false) &&
    (roleName !== 'admin' || user?.position?.name === 'DIREKTUR');

  const [filter, setFilter]             = useState<FilterKey>('all');
  const [selected, setSelected]         = useState<Announcement | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason]       = useState('');

  const closeDetail = useCallback(() => {
    setSelected(null);
    setShowRejectInput(false);
    setRejectReason('');
  }, []);

  const { data: list = [], isLoading, isRefetching, refetch } = useQuery<Announcement[]>({
    queryKey: ['announcements-admin', filter, canSendDirect, canApprove],
    queryFn: () => {
      const isKaryawan = !canSendDirect && !canApprove;
      const base = isKaryawan ? '/announcements/mine' : '/announcements';
      const q = filter !== 'all' ? `?status=${filter}` : '';
      return api.get(`${base}${q}`).then((r) => r.data);
    },
    refetchInterval: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      closeDetail();
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menghapus pengumuman.'),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/send`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      qc.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
      closeDetail();
      Alert.alert('Berhasil', 'Pengumuman berhasil dikirim.');
    },
    onError: () => Alert.alert('Gagal', 'Gagal mengirim pengumuman.'),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/submit`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      closeDetail();
      Alert.alert('Berhasil', 'Pengumuman diajukan untuk persetujuan.');
    },
    onError: () => Alert.alert('Gagal', 'Gagal mengajukan pengumuman.'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/approve`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      qc.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
      closeDetail();
      Alert.alert('Berhasil', 'Pengumuman disetujui dan dikirim.');
    },
    onError: () => Alert.alert('Gagal', 'Gagal menyetujui pengumuman.'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/announcements/${id}/reject`, { reason }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['announcements-admin'] });
      closeDetail();
      Alert.alert('Berhasil', 'Pengumuman ditolak.');
    },
    onError: () => Alert.alert('Gagal', 'Gagal menolak pengumuman.'),
  });

  const confirmDelete = (id: string) =>
    Alert.alert('Hapus Pengumuman', 'Tindakan ini tidak dapat dibatalkan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ]);

  const confirmApprove = (id: string) =>
    Alert.alert('Setujui Pengumuman', 'Pengumuman akan langsung dikirim setelah disetujui.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Setujui & Kirim', onPress: () => approveMut.mutate(id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.blue} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
          <BackHeader
            title="Pengumuman"
            subtitle="Kelola & kirim pengumuman"
            accentColor={C.blue}
            onBack={() => router.navigate('/(main)/profile')}
            right={
              canCreate ? (
                <TouchableOpacity
                  onPress={() => setShowCreate(true)}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: C.blue,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
                  }}
                  accessibilityLabel="Buat pengumuman baru"
                >
                  <Plus size={20} strokeWidth={2.5} color="#FFF" />
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 20 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: R.pill,
                    backgroundColor: active ? C.blue : (isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF'),
                    borderWidth: B.default,
                    borderColor: active ? C.blue : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFF' : lSecondary(isDark) }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* List */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {[0, 1, 2].map((i) => <NotifCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : list.length === 0 ? (
          <EmptyState icon={Megaphone} iconColor={C.blue} title="Tidak ada pengumuman" />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {list.map((ann) => {
              const tm = TYPE_META[ann.type] ?? TYPE_META.info;
              const sm = STATUS_META[ann.status] ?? STATUS_META.draft;
              return (
                <TouchableOpacity
                  key={ann.id}
                  onPress={() => setSelected(ann)}
                  activeOpacity={0.75}
                  style={{
                    backgroundColor: cardBg(isDark),
                    borderRadius: R.lg,
                    borderWidth: B.default,
                    borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
                    borderLeftWidth: 4,
                    borderLeftColor: tm.color,
                    padding: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ backgroundColor: `${tm.color}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: tm.color, textTransform: 'uppercase' }}>
                          {tm.label}
                        </Text>
                      </View>
                      {ann.is_pinned && <Pin size={11} strokeWidth={2} color={C.orange} />}
                    </View>
                    <View style={{ backgroundColor: `${sm.color}18`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: sm.color }}>{sm.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), marginBottom: 4 }} numberOfLines={1}>
                    {ann.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: lSecondary(isDark), lineHeight: 19 }} numberOfLines={2}>
                    {ann.body}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>
                      {new Date(ann.sent_at ?? ann.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                    </Text>
                    <ChevronRight size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: insets.bottom + 110 }} />
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDetail}>
        {selected && (() => {
          const tm = TYPE_META[selected.type] ?? TYPE_META.info;
          const sm = STATUS_META[selected.status] ?? STATUS_META.draft;
          const actionPending = sendMut.isPending || submitMut.isPending || deleteMut.isPending
            || approveMut.isPending || rejectMut.isPending;
          return (
            <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
              </View>

              {/* Modal header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 20, paddingVertical: 12,
                borderBottomWidth: 0.5,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${tm.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <tm.Icon size={18} strokeWidth={1.8} color={tm.color} />
                  </View>
                  <View>
                    <View style={{ backgroundColor: `${tm.color}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: tm.color, textTransform: 'uppercase' }}>{tm.label}</Text>
                    </View>
                    <View style={{ backgroundColor: `${sm.color}18`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: sm.color }}>{sm.label}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={closeDetail}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} strokeWidth={2.2} color={lPrimary(isDark)} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
                {/* Judul + tanggal */}
                <View style={{ borderLeftWidth: 4, borderLeftColor: tm.color, paddingLeft: 14, marginBottom: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), lineHeight: 28 }}>{selected.title}</Text>
                  <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 4 }}>
                    {new Date(selected.sent_at ?? selected.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })}
                  </Text>
                </View>

                {/* Body */}
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderRadius: 14, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, lineHeight: 24, color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }}>{selected.body}</Text>
                </View>

                {/* Target info */}
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, color: lTertiary(isDark), marginBottom: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Target</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: lPrimary(isDark) }}>
                    {selected.target_type === 'all' ? 'Semua karyawan'
                      : selected.target_type === 'department' ? 'Departemen tertentu'
                      : `${selected.target_user_ids?.length ?? 0} individu`}
                  </Text>
                </View>

                {/* Alasan penolakan */}
                {selected.status === 'rejected' && selected.rejection_reason && (
                  <View style={{ backgroundColor: `${C.red}12`, borderRadius: 12, borderWidth: 0.5, borderColor: `${C.red}30`, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, color: C.red, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' }}>Alasan Penolakan</Text>
                    <Text style={{ fontSize: 13, color: C.red }}>{selected.rejection_reason}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={{ gap: 10 }}>
                  {/* Manager: kirim langsung (draft / rejected) */}
                  {canSendDirect && ['draft', 'rejected'].includes(selected.status) && (
                    <TouchableOpacity
                      onPress={() => sendMut.mutate(selected.id)}
                      disabled={actionPending}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.md, backgroundColor: C.blue, opacity: actionPending ? 0.6 : 1 }}
                    >
                      {sendMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={16} strokeWidth={2} color="#FFF" />}
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                        {sendMut.isPending ? 'Mengirim…' : 'Kirim Sekarang'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Admin: ajukan ke manager (draft / rejected) */}
                  {!canSendDirect && ['draft', 'rejected'].includes(selected.status) && (
                    <TouchableOpacity
                      onPress={() => submitMut.mutate(selected.id)}
                      disabled={actionPending}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.md, backgroundColor: C.blue, opacity: actionPending ? 0.6 : 1 }}
                    >
                      {submitMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={16} strokeWidth={2} color="#FFF" />}
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                        {submitMut.isPending ? 'Mengajukan…' : (selected.status === 'rejected' ? 'Ajukan Ulang' : 'Ajukan untuk Persetujuan')}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Hapus */}
                  <TouchableOpacity
                    onPress={() => confirmDelete(selected.id)}
                    disabled={actionPending}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.md, backgroundColor: `${C.red}14`, borderWidth: 0.5, borderColor: `${C.red}30`, opacity: actionPending ? 0.6 : 1 }}
                  >
                    <Trash2 size={16} strokeWidth={2} color={C.red} />
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 15 }}>Hapus Pengumuman</Text>
                  </TouchableOpacity>

                  {/* Approve/reject — hanya untuk user dengan announcement:approve + DIREKTUR */}
                  {canApprove && selected.status === 'pending_approval' && !showRejectInput && (
                    <>
                      <TouchableOpacity
                        onPress={() => confirmApprove(selected.id)}
                        disabled={actionPending}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.md, backgroundColor: C.green, opacity: actionPending ? 0.6 : 1 }}
                      >
                        {approveMut.isPending
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <CheckCircle2 size={16} strokeWidth={2} color="#FFF" />}
                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                          {approveMut.isPending ? 'Menyetujui…' : 'Setujui & Kirim'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowRejectInput(true)}
                        disabled={actionPending}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: R.md, backgroundColor: `${C.orange}14`, borderWidth: 0.5, borderColor: `${C.orange}30`, opacity: actionPending ? 0.6 : 1 }}
                      >
                        <X size={16} strokeWidth={2} color={C.orange} />
                        <Text style={{ color: C.orange, fontWeight: '700', fontSize: 15 }}>Tolak</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Reject reason form (inline, cross-platform) */}
                  {canApprove && selected.status === 'pending_approval' && showRejectInput && (
                    <View style={{ gap: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>
                        Alasan penolakan *
                      </Text>
                      <TextInput
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Tulis alasan penolakan…"
                        placeholderTextColor={lTertiary(isDark)}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        style={{
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                          borderRadius: 12, borderWidth: 0.5,
                          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)',
                          padding: 12, fontSize: 14, color: lPrimary(isDark), minHeight: 80,
                        }}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => { setShowRejectInput(false); setRejectReason(''); }}
                          style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }}
                        >
                          <Text style={{ fontWeight: '600', color: lSecondary(isDark) }}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { if (rejectReason.trim()) rejectMut.mutate({ id: selected.id, reason: rejectReason.trim() }); }}
                          disabled={!rejectReason.trim() || rejectMut.isPending}
                          style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.md, backgroundColor: C.red, opacity: (!rejectReason.trim() || rejectMut.isPending) ? 0.5 : 1 }}
                        >
                          {rejectMut.isPending
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <Text style={{ fontWeight: '700', color: '#FFF' }}>Konfirmasi Tolak</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Create Modal ── */}
      {showCreate && (
        <CreateSheet
          isDark={isDark}
          canSendDirect={canSendDirect}
          insets={insets}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['announcements-admin'] });
            qc.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
          }}
        />
      )}
    </View>
  );
}

// ── Create Sheet ──────────────────────────────────────────────────────────────
function CreateSheet({
  isDark, canSendDirect, insets, onClose, onSuccess,
}: {
  isDark: boolean;
  canSendDirect: boolean;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [type, setType]                 = useState<'info' | 'urgent' | 'holiday' | 'policy'>('info');
  const [targetType, setTargetType]     = useState<'all' | 'department' | 'individual'>('all');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [sendPush, setSendPush]         = useState(true);
  const [isPinned, setIsPinned]         = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch]     = useState('');

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: targetType === 'department',
  });

  const { data: colleagues = [] } = useQuery<Colleague[]>({
    queryKey: ['colleagues'],
    queryFn: () => api.get('/users/colleagues').then((r) => r.data?.items ?? r.data ?? []),
    staleTime: 5 * 60_000,
    enabled: targetType === 'individual',
  });

  const filteredColleagues = useMemo(() =>
    colleagues.filter((u) => !userSearch || u.full_name.toLowerCase().includes(userSearch.toLowerCase())),
    [colleagues, userSearch]
  );

  const toggleUser = (id: string) =>
    setTargetUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectedColleagues = colleagues.filter((u) => targetUserIds.includes(u.id));

  const createMut = useMutation({
    mutationFn: async (mode: 'draft' | 'send' | 'submit') => {
      const payload: Record<string, unknown> = {
        title, body, type,
        target_type: targetType,
        send_push: sendPush,
        is_pinned: isPinned,
      };
      if (targetType === 'department' && targetDeptId) payload.target_dept_id = targetDeptId;
      if (targetType === 'individual' && targetUserIds.length > 0) payload.target_user_ids = targetUserIds;

      const res = await api.post('/announcements', payload);
      const id: string = res.data.id;
      if (mode === 'send') await api.post(`/announcements/${id}/send`);
      if (mode === 'submit') await api.post(`/announcements/${id}/submit`);
    },
    onSuccess: (_, mode) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = mode === 'send' ? 'Pengumuman berhasil dikirim.'
        : mode === 'submit' ? 'Pengumuman diajukan untuk persetujuan.'
        : 'Draft disimpan.';
      Alert.alert('Berhasil', msg);
      onSuccess();
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Terjadi kesalahan.');
    },
  });

  const canSubmit = title.trim() && body.trim() &&
    (targetType !== 'department' || !!targetDeptId) &&
    (targetType !== 'individual' || targetUserIds.length > 0);

  const inputStyle = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
    borderRadius: 12, borderWidth: 0.5,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)',
    padding: 12, fontSize: 14, color: lPrimary(isDark),
  } as const;

  const labelStyle = { fontSize: 13, fontWeight: '600' as const, color: lSecondary(isDark), marginBottom: 8 };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
        </View>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 12,
          borderBottomWidth: 0.5, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.blue}20`, alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={18} strokeWidth={1.8} color={C.blue} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: lPrimary(isDark) }}>Buat Pengumuman</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} strokeWidth={2.2} color={lPrimary(isDark)} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {/* Judul */}
          <View style={{ marginBottom: 16 }}>
            <Text style={labelStyle}>Judul *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Judul pengumuman…"
              placeholderTextColor={lTertiary(isDark)}
              style={inputStyle}
            />
          </View>

          {/* Isi */}
          <View style={{ marginBottom: 16 }}>
            <Text style={labelStyle}>Isi Pengumuman *</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Tulis isi pengumuman di sini…"
              placeholderTextColor={lTertiary(isDark)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={[inputStyle, { minHeight: 110 }]}
            />
          </View>

          {/* Tipe */}
          <View style={{ marginBottom: 16 }}>
            <Text style={labelStyle}>Tipe</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(TYPE_META) as [string, typeof TYPE_META[string]][]).map(([key, m]) => {
                const active = type === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setType(key as typeof type)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.sm,
                      backgroundColor: active ? `${m.color}20` : (isDark ? 'rgba(255,255,255,0.07)' : '#FFF'),
                      borderWidth: active ? 1 : 0.5,
                      borderColor: active ? m.color : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'),
                    }}
                  >
                    <m.Icon size={14} strokeWidth={1.8} color={active ? m.color : lSecondary(isDark)} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? m.color : lSecondary(isDark) }}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Kirim ke */}
          <View style={{ marginBottom: 16 }}>
            <Text style={labelStyle}>Kirim ke</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { key: 'all',        label: 'Semua' },
                { key: 'department', label: 'Departemen' },
                { key: 'individual', label: 'Individu' },
              ] as const).map((t) => {
                const active = targetType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => { setTargetType(t.key); setTargetDeptId(''); setTargetUserIds([]); }}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.sm,
                      backgroundColor: active ? `${C.blue}20` : (isDark ? 'rgba(255,255,255,0.07)' : '#FFF'),
                      borderWidth: active ? 1 : 0.5,
                      borderColor: active ? C.blue : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'),
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? C.blue : lSecondary(isDark) }}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Department picker */}
          {targetType === 'department' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Pilih Departemen *</Text>
              <View style={{ gap: 8 }}>
                {departments.length === 0 ? (
                  <ActivityIndicator color={C.blue} />
                ) : (
                  departments.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => setTargetDeptId(d.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 12, borderRadius: 12,
                        backgroundColor: targetDeptId === d.id ? `${C.blue}14` : (isDark ? 'rgba(255,255,255,0.07)' : '#FFF'),
                        borderWidth: targetDeptId === d.id ? 1 : 0.5,
                        borderColor: targetDeptId === d.id ? C.blue : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'),
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '500', color: targetDeptId === d.id ? C.blue : lPrimary(isDark) }}>{d.name}</Text>
                      {targetDeptId === d.id && <CheckCircle2 size={16} strokeWidth={2} color={C.blue} />}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {/* Individual picker */}
          {targetType === 'individual' && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={labelStyle}>Pilih Karyawan *</Text>
                {targetUserIds.length > 0 && (
                  <View style={{ backgroundColor: `${C.blue}20`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.blue }}>{targetUserIds.length} dipilih</Text>
                  </View>
                )}
              </View>

              {/* Selected chips */}
              {selectedColleagues.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6, paddingRight: 4 }}>
                    {selectedColleagues.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => toggleUser(u.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${C.blue}18`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: C.blue }}>{u.full_name.split(' ')[0]}</Text>
                        <X size={11} strokeWidth={2.5} color={C.blue} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Search input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)', paddingHorizontal: 12, marginBottom: 8 }}>
                <Search size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
                <TextInput
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Cari nama karyawan…"
                  placeholderTextColor={lTertiary(isDark)}
                  style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: lPrimary(isDark) }}
                />
              </View>

              {/* Scrollable list */}
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', maxHeight: 200, overflow: 'hidden' }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {filteredColleagues.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: lTertiary(isDark), fontSize: 13, paddingVertical: 20 }}>
                      {colleagues.length === 0 ? 'Memuat…' : 'Tidak ditemukan'}
                    </Text>
                  ) : (
                    filteredColleagues.map((u, idx) => {
                      const checked = targetUserIds.includes(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          onPress={() => toggleUser(u.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            paddingHorizontal: 14, paddingVertical: 11,
                            backgroundColor: checked ? `${C.blue}12` : 'transparent',
                            borderBottomWidth: idx < filteredColleagues.length - 1 ? 0.5 : 0,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? C.blue : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'), backgroundColor: checked ? C.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {checked && <CheckCircle2 size={12} strokeWidth={2.5} color="#FFF" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: lPrimary(isDark) }}>{u.full_name}</Text>
                            {u.department?.name && (
                              <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>{u.department.name}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Opsi */}
          <View style={{ marginBottom: 20 }}>
            <Text style={labelStyle}>Opsi</Text>
            <View style={{ gap: 12 }}>
              {([
                { key: 'push', label: 'Push Notification', value: sendPush, toggle: () => setSendPush((v) => !v), color: C.blue },
                { key: 'pin',  label: 'Pin Pengumuman',    value: isPinned, toggle: () => setIsPinned((v) => !v), color: C.orange },
              ]).map((item) => (
                <TouchableOpacity key={item.key} onPress={item.toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} activeOpacity={0.7}>
                  <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: item.value ? item.color : (isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB'), justifyContent: 'center', paddingHorizontal: 3 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2, transform: [{ translateX: item.value ? 18 : 0 }] }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: lPrimary(isDark) }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ gap: 10 }}>
            {canSendDirect ? (
              <TouchableOpacity
                onPress={() => createMut.mutate('send')}
                disabled={createMut.isPending || !canSubmit}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: R.md, backgroundColor: canSubmit && !createMut.isPending ? C.blue : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                activeOpacity={0.8}
              >
                {createMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={16} strokeWidth={2} color={canSubmit ? '#FFF' : lTertiary(isDark)} />}
                <Text style={{ fontSize: 15, fontWeight: '700', color: canSubmit ? '#FFF' : lTertiary(isDark) }}>
                  {createMut.isPending ? 'Mengirim…' : 'Kirim Sekarang'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => createMut.mutate('submit')}
                disabled={createMut.isPending || !canSubmit}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: R.md, backgroundColor: canSubmit && !createMut.isPending ? C.blue : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                activeOpacity={0.8}
              >
                {createMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Send size={16} strokeWidth={2} color={canSubmit ? '#FFF' : lTertiary(isDark)} />}
                <Text style={{ fontSize: 15, fontWeight: '700', color: canSubmit ? '#FFF' : lTertiary(isDark) }}>
                  {createMut.isPending ? 'Mengajukan…' : 'Ajukan untuk Persetujuan'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => createMut.mutate('draft')}
              disabled={createMut.isPending || !title.trim() || !body.trim()}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }}
              activeOpacity={0.8}
            >
              <FileEdit size={16} strokeWidth={1.8} color={lSecondary(isDark)} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: lSecondary(isDark) }}>Simpan Draft</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
