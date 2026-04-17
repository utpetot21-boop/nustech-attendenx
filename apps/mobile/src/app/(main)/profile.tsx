/**
 * M-07 — Profil & Cuti
 * Saldo cuti, riwayat mutasi, form pengajuan cuti, status objeksi
 * iOS 26 Liquid Glass design
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, B, S, pageBg, lPrimary, lSecondary } from '@/constants/tokens';
import {
  KeyRound,
  LogOut,
  Sun,
  Calendar,
  PlusCircle,
  Gift,
  Plus,
  Bell,
  Receipt,
  FileText,
  Briefcase,
  ChevronRight,
  ShieldAlert,
  Pencil,
  Camera,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { LeaveCardSkeleton, SkeletonBone } from '@/components/ui/SkeletonLoader';

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

  const { data: balance, refetch: refetchBalance, isRefetching, isLoading: balanceLoading } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/leave/balance/me').then((r) => r.data as LeaveBalance),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['leave-logs'],
    queryFn: () => api.get('/leave/balance/me/logs').then((r) => r.data as LeaveLog[]),
    enabled: tab === 'history',
  });

  const { data: requestsData } = useQuery({
    queryKey: ['leave-requests-me'],
    queryFn: () => api.get('/leave/requests').then((r) => r.data as { items: LeaveRequest[] }),
    enabled: tab === 'requests',
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
      qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
      setShowRequestForm(false);
      setForm({ type: 'cuti', start_date: '', end_date: '', reason: '' });
      Alert.alert('Berhasil', 'Pengajuan cuti telah dikirim.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  const handleRefresh = useCallback(() => { refetchBalance(); }, [refetchBalance]);

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
                backgroundColor: isDark ? '#1C1C1E' : '#FFF',
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
                >
                  <Pencil size={16} strokeWidth={1.8} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'} />
                </TouchableOpacity>
              </View>
              {user?.role?.name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.xs, backgroundColor: isDark ? 'rgba(0,122,255,0.2)' : '#DBEAFE' }}>
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
                backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : '#FEF2F2',
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
          {/* Baris 1: Jadwal & Notifikasi */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'Jadwal', sub: 'Lihat shift & kalender', Icon: Calendar, color: C.purple, bg: isDark ? 'rgba(175,82,222,0.15)' : '#F5F3FF', route: '/(main)/schedule' },
              { label: 'Notifikasi', sub: 'Pemberitahuan & pengumuman', Icon: Bell, color: C.blue, bg: isDark ? 'rgba(0,122,255,0.15)' : '#EFF6FF', route: '/(main)/notifications' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as never)}
                activeOpacity={0.75}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderRadius: R.lg,
                  borderWidth: B.default,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                  padding: 14,
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: R.sm, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <item.Icon size={20} strokeWidth={1.8} color={item.color} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary, marginBottom: 2 }}>{item.label}</Text>
                <Text style={{ fontSize: 11, color: textSecondary, lineHeight: 15 }}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Baris 2: Klaim, BA, Surat Tugas, SOS */}
          <View style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            borderRadius: R.lg,
            borderWidth: B.default,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Klaim Biaya', Icon: Receipt,   color: C.orange,  route: '/(main)/expense-claims/index' },
              { label: 'Berita Acara',Icon: FileText,   color: C.teal,    route: '/(main)/service-reports/index' },
              { label: 'Surat Tugas', Icon: Briefcase,  color: C.indigo,  route: '/(main)/business-trips/index' },
              { label: 'SOS Darurat', Icon: ShieldAlert, color: C.red,   route: '/(main)/sos' },
            ].map((item, idx, arr) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as never)}
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
            backgroundColor: isDark ? 'rgba(0,122,255,0.12)' : '#EFF6FF',
            borderRadius: R.xl,
            borderWidth: B.default,
            borderColor: isDark ? 'rgba(0,122,255,0.3)' : '#BFDBFE',
            display: balanceLoading ? 'none' : 'flex',
            padding: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#007AFF', letterSpacing: 0.5, textTransform: 'uppercase' }}>
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
            <View style={{ height: 8, width: `${usedPct * 100}%`, backgroundColor: '#007AFF', borderRadius: 4 }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            {[
              { label: 'Digunakan', value: usedDays, Icon: Calendar, color: C.orange },
              { label: 'Akrual', value: balance?.accrued_monthly ?? 0, Icon: PlusCircle, color: C.green },
              { label: 'Kompensasi', value: balance?.accrued_holiday ?? 0, Icon: Gift, color: '#AF52DE' },
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
            backgroundColor: '#007AFF',
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#007AFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
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
                backgroundColor: tab === t ? (isDark ? '#1E293B' : '#FFF') : 'transparent',
                ...(tab === t ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 } : {}),
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: tab === t ? '700' : '500', color: tab === t ? (isDark ? '#FFF' : '#0F172A') : textSecondary }}>
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
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', fontSize: 14 }}>Belum ada pengajuan</Text>
              </View>
            ) : (
              (requestsData?.items ?? []).map((req) => {
                const ss = LEAVE_STATUS_STYLE[req.status] ?? LEAVE_STATUS_STYLE.pending;
                return (
                  <View key={req.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFF', borderRadius: 14, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#FFF' : '#111', textTransform: 'capitalize' }}>
                          {req.type} · {req.total_days} hari kerja
                        </Text>
                        <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280', marginTop: 2 }}>
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
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', fontSize: 14 }}>Belum ada mutasi</Text>
              </View>
            ) : (
              logs.map((log) => {
                const meta = LOG_TYPE_LABELS[log.type] ?? { label: log.type, color: '#6B7280' };
                return (
                  <View key={log.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: meta.color }}>{meta.label}</Text>
                      {log.notes && <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF', marginTop: 2 }}>{log.notes}</Text>}
                      <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF', marginTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: log.amount >= 0 ? C.green : C.red }}>
                        {log.amount >= 0 ? '+' : ''}{log.amount}
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>
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
        <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFF' : '#111', letterSpacing: -0.4 }}>
              Edit Profil
            </Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={{ fontSize: 15, color: '#007AFF' }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { key: 'full_name', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
              { key: 'phone',     label: 'No. Telepon',   placeholder: '08xxxxxxxxxx' },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 6 }}>
                  {label}
                </Text>
                <TextInput
                  value={editForm[key as keyof typeof editForm]}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                  keyboardType={key === 'phone' ? 'phone-pad' : 'default'}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: isDark ? '#FFF' : '#111' }}
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={() => editProfileMutation.mutate()}
              disabled={editProfileMutation.isPending || (!editForm.full_name.trim() && !editForm.phone.trim())}
              style={{
                backgroundColor: (editForm.full_name.trim() || editForm.phone.trim()) ? '#007AFF' : isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
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
                <Text style={{ fontSize: 16, fontWeight: '700', color: (editForm.full_name.trim() || editForm.phone.trim()) ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }}>
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
        <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFF' : '#111', letterSpacing: -0.4 }}>
              Ubah Password
            </Text>
            <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPwForm({ current_password: '', new_password: '', confirm_password: '' }); }}>
              <Text style={{ fontSize: 15, color: '#007AFF' }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { key: 'current_password', label: 'Password Saat Ini' },
              { key: 'new_password', label: 'Password Baru' },
              { key: 'confirm_password', label: 'Konfirmasi Password Baru' },
            ].map(({ key, label }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 6 }}>
                  {label}
                </Text>
                <TextInput
                  value={pwForm[key as keyof typeof pwForm]}
                  onChangeText={(v) => setPwForm((f) => ({ ...f, [key]: v }))}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: isDark ? '#FFF' : '#111' }}
                />
              </View>
            ))}

            {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
              <Text style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>
                Password baru tidak cocok.
              </Text>
            )}

            <TouchableOpacity
              onPress={() => passwordMutation.mutate()}
              disabled={
                passwordMutation.isPending ||
                !pwForm.current_password ||
                !pwForm.new_password ||
                pwForm.new_password !== pwForm.confirm_password
              }
              style={{
                backgroundColor: (!pwForm.current_password || !pwForm.new_password || pwForm.new_password !== pwForm.confirm_password)
                  ? isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
                  : '#007AFF',
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
                <Text style={{ fontSize: 16, fontWeight: '700', color: (!pwForm.current_password || !pwForm.new_password || pwForm.new_password !== pwForm.confirm_password) ? isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' : '#FFF' }}>
                  Simpan Password
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Leave request modal */}
      <Modal visible={showRequestForm} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFF' : '#111', letterSpacing: -0.4 }}>
              Ajukan Cuti / Izin
            </Text>
            <TouchableOpacity onPress={() => setShowRequestForm(false)}>
              <Text style={{ fontSize: 15, color: '#007AFF' }}>Batal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type selector */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 8 }}>
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
                    backgroundColor: form.type === t ? '#007AFF' : isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
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

            {/* Dates */}
            {['start_date', 'end_date'].map((field) => (
              <View key={field} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 6 }}>
                  {field === 'start_date' ? 'Tanggal Mulai' : 'Tanggal Selesai'}
                </Text>
                <TextInput
                  value={form[field as keyof typeof form]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: isDark ? '#FFF' : '#111' }}
                />
              </View>
            ))}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.6)' : '#6B7280', marginBottom: 6 }}>
                Alasan *
              </Text>
              <TextInput
                value={form.reason}
                onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))}
                placeholder="Jelaskan alasan pengajuan..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF', borderRadius: 12, borderWidth: 0.5, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', padding: 12, fontSize: 14, color: isDark ? '#FFF' : '#111', minHeight: 100 }}
              />
            </View>

            <TouchableOpacity
              onPress={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !form.start_date || !form.end_date || !form.reason.trim()}
              style={{
                backgroundColor: form.start_date && form.end_date && form.reason.trim() ? '#007AFF' : isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              {requestMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: form.start_date && form.end_date && form.reason.trim() ? '#FFF' : isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF' }}>
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
