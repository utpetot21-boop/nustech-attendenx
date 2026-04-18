/**
 * M-07 — Profil & Cuti
 * Saldo cuti, riwayat mutasi, form pengajuan cuti, status objeksi
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  useColorScheme,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import {
  KeyRound,
  LogOut,
  Sun,
  Calendar,
  PlusCircle,
  Gift,
  Plus,
  Receipt,
  FileText,
  Briefcase,
  ChevronRight,
  ShieldAlert,
  Pencil,
  Camera,
  Megaphone,
  BellRing,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { LeaveCardSkeleton, SkeletonBone } from '@/components/ui/SkeletonLoader';
import {
  getReminderSettings,
  setReminderSettings,
  rescheduleCheckInReminders,
  OFFSET_OPTIONS,
  type ReminderSettings,
} from '@/services/check-in-reminder.service';

interface LeaveBalance {
  balance_days: number;
  accrued_monthly: number;
  accrued_holiday: number;
  used_days: number;
  expired_days: number;
  year: number;
}

interface LeaveLog {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  notes?: string;
  created_at: string;
}

interface LeaveRequest {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
}

const LOG_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  accrual_monthly: { label: '+Akrual Bulanan', color: C.green },
  accrual_holiday: { label: '+Kompensasi Hari Libur', color: C.green },
  used: { label: '−Digunakan', color: C.orange },
  expired: { label: '−Hangus', color: C.red },
  alfa_deduction: { label: '−Potongan Alfa', color: C.red },
  collective_leave_deduction: { label: '−Cuti Bersama', color: C.orange },
  objection_cancel: { label: 'Keberatan Disetujui', color: C.blue },
  accrual_skipped: { label: 'Akrual Dilewati (Maks)', color: '#6B7280' },
  manual_adjustment: { label: 'Penyesuaian Manual', color: C.teal },
};

const LEAVE_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Menunggu', color: C.orange, bg: 'rgba(255,149,0,0.12)' },
  approved: { label: 'Disetujui', color: C.green, bg: 'rgba(52,199,89,0.12)' },
  rejected: { label: 'Ditolak', color: C.red, bg: 'rgba(255,59,48,0.12)' },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit', dinas: 'Dinas',
};

const APPROVER_ROLES = ['admin', 'manager', 'super_admin'];

interface PendingLeaveRequest {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  created_at: string;
  user?: { full_name: string };
}

export default function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  const updateUser = useAuthStore((s) => s.updateUser);

  const [tab, setTab] = useState<'balance' | 'history' | 'requests'>('balance');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [editForm, setEditForm] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '' });
  const [avatarError, setAvatarError] = useState(false);
  const [form, setForm] = useState({
    type: 'cuti' as 'cuti' | 'izin' | 'sakit' | 'dinas',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);

  // ── Approval (admin/manager/super_admin) ──────────────────────────
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectId, setRejectId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cek can_approve dari /auth/me (selalu fresh, tidak bergantung SecureStore)
  const { data: meData } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data as { role?: { name?: string; can_approve?: boolean } }),
    staleTime: 60_000,
  });
  const isApprover = !!meData?.role?.can_approve
    || APPROVER_ROLES.includes(meData?.role?.name ?? '')
    || APPROVER_ROLES.includes(typeof user?.role === 'string' ? user.role : (user?.role?.name ?? ''));

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['leave-requests-pending'],
    queryFn: () => api.get('/leave/requests?status=pending').then((r) => r.data as { items: PendingLeaveRequest[]; total: number }),
    enabled: isApprover,
    staleTime: 0,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/approve`),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); refetchPending(); },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? 'Gagal menyetujui'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/leave/requests/${id}/reject`, { reason }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRejectId(null);
      setRejectReason('');
      refetchPending();
    },
    onError: (e: any) => Alert.alert('Gagal', e?.response?.data?.message ?? 'Gagal menolak'),
  });

  // ── Sync user.role dari /auth/me ke store (untuk konsistensi global) ─
  useEffect(() => {
    if (meData?.role) updateUser({ role: { name: meData.role.name ?? '' } });
  }, [meData?.role?.name]);

  // ── Pengingat Check-in ─────────────────────────────────────────────
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  useEffect(() => {
    getReminderSettings().then(setReminder);
  }, []);

  const updateReminder = useCallback(async (patch: Partial<ReminderSettings>) => {
    const next = await setReminderSettings(patch);
    setReminder(next);
    // Re-schedule supaya perubahan langsung efek
    rescheduleCheckInReminders().catch(() => null);
  }, []);

  const { data: balance, refetch: refetchBalance, isRefetching, isLoading: balanceLoading } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/leave/balance/me').then((r) => r.data as LeaveBalance),
    staleTime: 30_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['leave-logs'],
    queryFn: () => api.get('/leave/balance/me/logs').then((r) => r.data as LeaveLog[]),
    enabled: tab === 'history',
    staleTime: 30_000,
  });

  const { data: requestsData } = useQuery({
    queryKey: ['leave-requests-profile'],
    queryFn: () => api.get('/leave/requests').then((r) => r.data as { items: LeaveRequest[] }),
    enabled: tab === 'requests',
    staleTime: 30_000,
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      api.post('/leave/requests', {
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      qc.invalidateQueries({ queryKey: ['leave-requests-profile'] });
      setShowRequestForm(false);
      setForm({ type: 'cuti', start_date: '', end_date: '', reason: '' });
      Alert.alert('Berhasil', 'Pengajuan cuti telah dikirim.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const handleRefresh = useCallback(() => {
    refetchBalance();
    qc.invalidateQueries({ queryKey: ['leave-logs'] });
    qc.invalidateQueries({ queryKey: ['leave-requests-profile'] });
  }, [refetchBalance, qc]);

  const handleLogout = () => {
    Alert.alert('Keluar', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPasswordModal(false);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      Alert.alert('Berhasil', 'Password berhasil diperbarui.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.message ?? err.message ?? 'Gagal memperbarui password.';
      Alert.alert('Gagal', typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const editProfileMutation = useMutation({
    mutationFn: () =>
      api.patch('/users/me', {
        full_name: editForm.full_name.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      }),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { full_name, phone } = res.data as { full_name: string; phone: string };
      updateUser({ full_name, phone });
      setShowEditModal(false);
      Alert.alert('Berhasil', 'Profil berhasil diperbarui.');
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.message ?? err.message ?? 'Gagal memperbarui profil.';
      Alert.alert('Gagal', typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (uri: string) => {
      const form = new FormData();
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      form.append('file', { uri, name: `avatar.${ext}`, type: mime } as any);
      return api.post<{ avatar_url: string }>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ avatar_url: res.data.avatar_url });
      setAvatarError(false);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.message ?? err.message ?? 'Gagal upload foto.';
      Alert.alert('Gagal', typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri di Pengaturan untuk mengganti foto profil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatarMutation.mutate(result.assets[0].uri);
    }
  };

  const balanceDays = Number(balance?.balance_days ?? 0);
  const usedDays = Number(balance?.used_days ?? 0);
  const maxDays = 12;
  const usedPct = Math.min(usedDays / maxDays, 1);

  const bg = pageBg(isDark);
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  // Get initials for avatar
  const initials = (user?.full_name ?? 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh}
            tintColor={C.blue} />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          {/* Avatar + name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            {/* Avatar — tap untuk ganti foto */}
            <TouchableOpacity
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              disabled={uploadAvatarMutation.isPending}
              style={{ position: 'relative' }}
              accessibilityRole="button"
              accessibilityLabel="Ubah foto profil"
            >
              <View style={{
                width: 72, height: 72, borderRadius: R.xl,
                backgroundColor: isDark ? C.indigo : C.blue,
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                ...S.button,
                shadowColor: C.blue,
              }}>
                {user?.avatar_url && !avatarError ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={{ width: 72, height: 72 }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '800' }}>{initials}</Text>
                )}
              </View>
              {/* Badge kamera */}
              <View style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: cardBg(isDark),
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)',
              }}>
                {uploadAvatarMutation.isPending
                  ? <ActivityIndicator size={10} color={C.blue} />
                  : <Camera size={12} strokeWidth={2} color={C.blue} />
                }
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5, flex: 1 }}>
                  {user?.full_name ?? 'Karyawan'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditForm({ full_name: user?.full_name ?? '', phone: user?.phone ?? '' });
                    setShowEditModal(true);
                  }}
                  style={{ padding: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profil"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Pencil size={16} strokeWidth={1.8} color={lTertiary(isDark)} />
                </TouchableOpacity>
              </View>
              {user?.role?.name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.xs, backgroundColor: C.blue + (isDark ? '33' : '1F') }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.blue }}>{user.role.name}</Text>
                  </View>
                </View>
              )}
              {user?.phone && (
                <Text style={{ fontSize: 12, color: textSecondary, marginTop: 3 }}>{user.phone}</Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setShowPasswordModal(true)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 13, borderRadius: R.md,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
                borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.18)',
              }}
            >
              <KeyRound size={16} strokeWidth={1.8} color="#AF52DE" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.8)' : '#374151' }}>Ubah Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={{
                flex: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 13, paddingHorizontal: 18, borderRadius: R.md,
                backgroundColor: C.red + (isDark ? '1F' : '14'),
                borderWidth: B.default, borderColor: 'rgba(255,59,48,0.3)',
              }}
            >
              <LogOut size={18} strokeWidth={1.8} color={C.red} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Menu Hub ──────────────────────────────────────────────────── */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          {/* Menu: Klaim, BA, Surat Tugas, Cuti, SOS */}
          <View style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            borderRadius: R.lg,
            borderWidth: B.default,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Klaim Biaya',  Icon: Receipt,    color: C.orange, route: '/(main)/expense-claims', roles: null },
              { label: 'Berita Acara', Icon: FileText,   color: C.teal,   route: '/(main)/service-reports', roles: null },
              { label: 'Surat Tugas',  Icon: Briefcase,  color: C.indigo, route: '/(main)/business-trips', roles: null },
              { label: 'Pengumuman',   Icon: Megaphone,  color: C.blue,   route: '/(main)/announcements',  roles: ['admin', 'manager', 'super_admin'] },
              { label: 'SOS Darurat',  Icon: ShieldAlert, color: C.red,   route: '/(main)/sos', roles: null },
            ].filter((item) => !item.roles || item.roles.includes(user?.role?.name ?? ''))
            .map((item, idx, arr) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => item.route ? router.push(item.route as never) : setShowApprovalModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: idx < arr.length - 1 ? B.default : 0,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.10)',
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: R.xs + 2, backgroundColor: `${item.color}1F`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <item.Icon size={18} strokeWidth={1.8} color={item.color} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: textPrimary }}>{item.label}</Text>
                <ChevronRight size={16} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(60,60,67,0.25)'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Persetujuan Cuti (approver only) ──────────────────────── */}
        {isApprover && (
          <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <Pressable
              onPress={() => setShowApprovalModal(true)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: pressed
                  ? C.green + (isDark ? '40' : '28')
                  : C.green + (isDark ? '24' : '18'),
                borderRadius: R.xl,
                borderWidth: 1,
                borderColor: C.green + (isDark ? '66' : '4D'),
                paddingHorizontal: 18, paddingVertical: 16,
                shadowColor: C.green,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.18,
                shadowRadius: 10,
                elevation: 4,
              })}
            >
              <View style={{
                width: 44, height: 44, borderRadius: R.md,
                backgroundColor: C.green,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ClipboardList size={22} strokeWidth={2} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}>
                  Persetujuan Cuti / Izin
                </Text>
                <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                  {pendingData?.total ? 'Tap untuk meninjau pengajuan' : 'Tidak ada pengajuan menunggu'}
                </Text>
              </View>
              {!!pendingData?.total && pendingData.total > 0 && (
                <View style={{
                  minWidth: 28, height: 28, borderRadius: 14,
                  backgroundColor: C.red,
                  alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 8,
                  marginRight: 4,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>
                    {pendingData.total}
                  </Text>
                </View>
              )}
              <ChevronRight size={18} strokeWidth={2} color={C.green} />
            </Pressable>
          </View>
        )}

        {/* ── Pengingat Check-in ─────────────────────────────────────── */}
        {reminder && (
          <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                borderRadius: R.lg,
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                overflow: 'hidden',
              }}
            >
              {/* Toggle row */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 13,
                borderBottomWidth: reminder.enabled ? B.default : 0,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.10)',
              }}>
                <View style={{ width: 34, height: 34, borderRadius: R.xs + 2, backgroundColor: C.blue + '1F', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <BellRing size={18} strokeWidth={1.8} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: textPrimary }}>
                    Pengingat Check-in
                  </Text>
                  <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                    Notif lokal sebelum jadwal masuk
                  </Text>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={(v) => updateReminder({ enabled: v })}
                  trackColor={{ false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', true: C.blue }}
                />
              </View>

              {/* Offset picker — hanya muncul jika enabled */}
              {reminder.enabled && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ fontSize: 12, color: textSecondary, marginBottom: 8 }}>
                    Ingatkan sebelum:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {OFFSET_OPTIONS.map((min) => {
                      const active = reminder.offset_minutes === min;
                      return (
                        <TouchableOpacity
                          key={min}
                          onPress={() => updateReminder({ offset_minutes: min })}
                          activeOpacity={0.7}
                          style={{
                            paddingVertical: 8, paddingHorizontal: 14,
                            borderRadius: R.sm,
                            backgroundColor: active ? C.blue : isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
                            borderWidth: active ? 0 : B.default,
                            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.12)',
                          }}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: '600',
                            color: active ? '#FFF' : textPrimary,
                          }}>
                            {min < 60 ? `${min} menit` : `${min / 60} jam`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Saldo cuti card */}
        {balanceLoading ? (
          <View style={{ marginHorizontal: 20, marginBottom: 16, gap: 12 }}>
            <SkeletonBone width="100%" height={160} borderRadius={20} />
          </View>
        ) : null}
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: C.blue + (isDark ? '1F' : '14'),
            borderRadius: R.xl,
            borderWidth: B.default,
            borderColor: C.blue + (isDark ? '4D' : '40'),
            display: balanceLoading ? 'none' : 'flex',
            padding: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Saldo Cuti {balance?.year ?? new Date().getFullYear()}
            </Text>
            <Sun size={20} strokeWidth={1.8} color="#007AFF" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
            <Text style={{ fontSize: 52, fontWeight: '800', color: textPrimary, letterSpacing: -2 }}>
              {balanceDays.toFixed(1)}
            </Text>
            <Text style={{ fontSize: 18, color: textSecondary, fontWeight: '600' }}>hari</Text>
          </View>

          {/* Progress bar */}
          <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#DBEAFE', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
            <View style={{ height: 8, width: `${usedPct * 100}%`, backgroundColor: C.blue, borderRadius: 4 }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            {[
              { label: 'Digunakan', value: usedDays, Icon: Calendar, color: C.orange },
              { label: 'Akrual', value: balance?.accrued_monthly ?? 0, Icon: PlusCircle, color: C.green },
              { label: 'Kompensasi', value: balance?.accrued_holiday ?? 0, Icon: Gift, color: C.purple },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <item.Icon size={14} strokeWidth={1.8} color={item.color} />
                <View>
                  <Text style={{ fontSize: 11, color: textSecondary }}>{item.label}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }}>
                    {Number(item.value).toFixed(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Ajukan cuti button */}
        <TouchableOpacity
          onPress={() => setShowRequestForm(true)}
          style={{
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: C.blue,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            shadowColor: C.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
          }}
          activeOpacity={0.8}
        >
          <Plus size={20} strokeWidth={2.2} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Ajukan Cuti / Izin</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginBottom: 14,
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF5',
            borderRadius: 16,
            padding: 4,
          }}
        >
          {(['balance', 'requests', 'history'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: tab === t ? cardBg(isDark) : 'transparent',
                ...(tab === t ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 } : {}),
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: tab === t ? '700' : '500', color: tab === t ? (lPrimary(isDark)) : textSecondary }}>
                {t === 'balance' ? 'Saldo' : t === 'requests' ? 'Pengajuan' : 'Riwayat'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {tab === 'requests' && (
          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {(requestsData?.items ?? []).length === 0 ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ color: lTertiary(isDark), fontSize: 14 }}>Belum ada pengajuan</Text>
              </View>
            ) : (
              (requestsData?.items ?? []).map((req) => {
                const ss = LEAVE_STATUS_STYLE[req.status] ?? LEAVE_STATUS_STYLE.pending;
                return (
                  <View key={req.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFF', borderRadius: 14, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: lPrimary(isDark), textTransform: 'capitalize' }}>
                          {req.type} · {req.total_days} hari kerja
                        </Text>
                        <Text style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 2 }}>
                          {req.start_date} → {req.end_date}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: ss.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: ss.color }}>{ss.label}</Text>
                      </View>
                    </View>
                    {req.reject_reason && (
                      <Text style={{ fontSize: 12, color: C.red, marginTop: 6 }}>
                        Alasan penolakan: {req.reject_reason}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'history' && (
          <View style={{ gap: 8, paddingHorizontal: 20 }}>
            {logs.length === 0 ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ color: lTertiary(isDark), fontSize: 14 }}>Belum ada mutasi</Text>
              </View>
            ) : (
              logs.map((log) => {
                const meta = LOG_TYPE_LABELS[log.type] ?? { label: log.type, color: '#6B7280' };
                return (
                  <View key={log.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: meta.color }}>{meta.label}</Text>
                      {log.notes && <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 2 }}>{log.notes}</Text>}
                      <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: log.amount >= 0 ? C.green : C.red }}>
                        {log.amount >= 0 ? '+' : ''}{log.amount}
                      </Text>
                      <Text style={{ fontSize: 11, color: lTertiary(isDark) }}>
                        Sisa: {Number(log.balance_after).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* Edit profil modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pageBg(isDark), padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.4 }}>
              Edit Profil
            </Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={{ fontSize: 15, color: C.blue }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { key: 'full_name', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
              { key: 'phone',     label: 'No. Telepon',   placeholder: '08xxxxxxxxxx' },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 6 }}>
                  {label}
                </Text>
                <TextInput
                  value={editForm[key as keyof typeof editForm]}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={lTertiary(isDark)}
                  keyboardType={key === 'phone' ? 'phone-pad' : 'default'}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: lPrimary(isDark) }}
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={() => editProfileMutation.mutate()}
              disabled={editProfileMutation.isPending || (!editForm.full_name.trim() && !editForm.phone.trim())}
              style={{
                backgroundColor: (editForm.full_name.trim() || editForm.phone.trim()) ? C.blue : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
                marginTop: 8,
              }}
              activeOpacity={0.8}
            >
              {editProfileMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: (editForm.full_name.trim() || editForm.phone.trim()) ? '#FFF' : lTertiary(isDark) }}>
                  Simpan
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Password change modal */}
      <Modal visible={showPasswordModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pageBg(isDark), padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.4 }}>
              Ubah Password
            </Text>
            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPwForm({ current_password: '', new_password: '', confirm_password: '' }); }}>
              <Text style={{ fontSize: 15, color: C.blue }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { key: 'current_password', label: 'Password Saat Ini' },
              { key: 'new_password', label: 'Password Baru' },
              { key: 'confirm_password', label: 'Konfirmasi Password Baru' },
            ].map(({ key, label }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 6 }}>
                  {label}
                </Text>
                <TextInput
                  value={pwForm[key as keyof typeof pwForm]}
                  onChangeText={(v) => setPwForm((f) => ({ ...f, [key]: v }))}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={lTertiary(isDark)}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: lPrimary(isDark) }}
                />
              </View>
            ))}

            {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
              <Text style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>
                Password baru tidak cocok.
              </Text>
            )}

            {(() => {
              const isPwFormInvalid =
                !pwForm.current_password ||
                !pwForm.new_password ||
                pwForm.new_password !== pwForm.confirm_password;
              const disabledBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)';
              const disabledText = lTertiary(isDark);
              return (
                <TouchableOpacity
                  onPress={() => passwordMutation.mutate()}
                  disabled={passwordMutation.isPending || isPwFormInvalid}
                  style={{
                    backgroundColor: isPwFormInvalid ? disabledBg : C.blue,
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                  activeOpacity={0.8}
                >
                  {passwordMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isPwFormInvalid ? disabledText : '#FFF' }}>
                      Simpan Password
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Approval Modal ──────────────────────────────────────────── */}
      <Modal visible={showApprovalModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.4 }}>Persetujuan Cuti</Text>
              <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2 }}>
                {pendingData?.total ?? 0} permintaan menunggu
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
              <Text style={{ fontSize: 15, color: C.blue }}>Tutup</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {pendingLoading ? (
              <ActivityIndicator color={C.green} style={{ marginTop: 48 }} />
            ) : (pendingData?.items?.length ?? 0) === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 64 }}>
                <CheckCircle2 size={48} color={C.green} strokeWidth={1.5} />
                <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: lSecondary(isDark) }}>
                  Tidak ada permintaan pending
                </Text>
              </View>
            ) : (
              pendingData!.items.map((req) => (
                <View key={req.id} style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF',
                  borderRadius: R.lg, borderWidth: B.default,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                  padding: 16, marginBottom: 12,
                }}>
                  {/* User + type badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {req.user?.full_name ?? '—'}
                    </Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.blue + '1F' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.blue }}>{LEAVE_TYPE_LABELS[req.type] ?? req.type}</Text>
                    </View>
                  </View>

                  {/* Tanggal + jumlah hari */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Calendar size={13} strokeWidth={1.8} color={lTertiary(isDark)} />
                    <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>
                      {req.start_date === req.end_date
                        ? new Date(req.start_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : `${new Date(req.start_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} — ${new Date(req.end_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      }
                      {req.total_days ? ` · ${req.total_days} hari` : ''}
                    </Text>
                  </View>

                  {/* Alasan */}
                  <Text style={{ fontSize: 13, color: lSecondary(isDark), marginBottom: 12 }} numberOfLines={2}>
                    {req.reason}
                  </Text>

                  {/* Reject reason input */}
                  {rejectId === req.id && (
                    <TextInput
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Alasan penolakan..."
                      placeholderTextColor={lTertiary(isDark)}
                      multiline
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', borderRadius: 10, padding: 10, fontSize: 13, color: lPrimary(isDark), minHeight: 60, marginBottom: 10 }}
                    />
                  )}

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {rejectId === req.id ? (
                      <>
                        <TouchableOpacity
                          onPress={() => { setRejectId(null); setRejectReason(''); }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark) }}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => rejectMut.mutate({ id: req.id, reason: rejectReason })}
                          disabled={!rejectReason.trim() || rejectMut.isPending}
                          style={{ flex: 2, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: rejectReason.trim() ? C.red : isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}
                        >
                          {rejectMut.isPending
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <Text style={{ fontSize: 13, fontWeight: '700', color: rejectReason.trim() ? '#FFF' : lTertiary(isDark) }}>Konfirmasi Tolak</Text>}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => { setRejectId(req.id); setRejectReason(''); }}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.red + '14', borderWidth: B.default, borderColor: C.red + '33' }}
                        >
                          <XCircle size={14} strokeWidth={2} color={C.red} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: C.red }}>Tolak</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => approveMut.mutate(req.id)}
                          disabled={approveMut.isPending}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.green + '14', borderWidth: B.default, borderColor: C.green + '33' }}
                        >
                          {approveMut.isPending
                            ? <ActivityIndicator color={C.green} size="small" />
                            : <>
                                <CheckCircle2 size={14} strokeWidth={2} color={C.green} />
                                <Text style={{ fontSize: 13, fontWeight: '600', color: C.green }}>Setujui</Text>
                              </>}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Leave request modal */}
      <Modal visible={showRequestForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: pageBg(isDark), padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.4 }}>
              Ajukan Cuti / Izin
            </Text>
            <TouchableOpacity onPress={() => setShowRequestForm(false)}>
              <Text style={{ fontSize: 15, color: C.blue }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type selector */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 8 }}>
              Jenis
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['cuti', 'izin', 'sakit', 'dinas'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: form.type === t ? C.blue : isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                    borderWidth: form.type === t ? 0 : 0.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: form.type === t ? '#FFF' : isDark ? 'rgba(255,255,255,0.75)' : '#374151', textTransform: 'capitalize' }}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tanggal Mulai */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 6 }}>
                Tanggal Mulai
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12 }}
              >
                <Calendar size={16} strokeWidth={1.8} color={form.start_date ? C.blue : lTertiary(isDark)} />
                <Text style={{ fontSize: 14, color: form.start_date ? lPrimary(isDark) : lTertiary(isDark) }}>
                  {form.start_date
                    ? new Date(form.start_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Pilih tanggal mulai'}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={form.start_date ? new Date(form.start_date + 'T00:00:00') : new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowStartPicker(false);
                    if (date) {
                      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      // Auto-isi end_date = start_date (1 hari); user bisa ubah sendiri jika perlu lebih
                      setForm((f) => ({ ...f, start_date: iso, end_date: !f.end_date || f.end_date < iso ? iso : f.end_date }));
                    }
                  }}
                />
              )}
            </View>

            {/* Tanggal Selesai */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 6 }}>
                Tanggal Selesai
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12 }}
              >
                <Calendar size={16} strokeWidth={1.8} color={form.end_date ? C.blue : lTertiary(isDark)} />
                <Text style={{ fontSize: 14, color: form.end_date ? lPrimary(isDark) : lTertiary(isDark) }}>
                  {form.end_date
                    ? new Date(form.end_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Pilih tanggal selesai'}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={form.end_date ? new Date(form.end_date + 'T00:00:00') : (form.start_date ? new Date(form.start_date + 'T00:00:00') : new Date())}
                  mode="date"
                  display="default"
                  minimumDate={form.start_date ? new Date(form.start_date + 'T00:00:00') : new Date()}
                  onChange={(_, date) => {
                    setShowEndPicker(false);
                    if (date) {
                      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      setForm((f) => ({ ...f, end_date: iso }));
                    }
                  }}
                />
              )}
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: lSecondary(isDark), marginBottom: 6 }}>
                Alasan *
              </Text>
              <TextInput
                value={form.reason}
                onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))}
                placeholder="Jelaskan alasan pengajuan..."
                placeholderTextColor={lTertiary(isDark)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: lPrimary(isDark), minHeight: 100 }}
              />
            </View>

            <TouchableOpacity
              onPress={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !form.start_date || !form.end_date || !form.reason.trim()}
              style={{
                backgroundColor: form.start_date && form.end_date && form.reason.trim() ? C.blue : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              {requestMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: form.start_date && form.end_date && form.reason.trim() ? '#FFF' : lTertiary(isDark) }}>
                  Kirim Pengajuan
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
