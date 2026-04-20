/**
 * M-07 — Profil
 * Akun, edit profil, ubah password, pengingat check-in,
 * dan Persetujuan Cuti (approver only).
 *
 * Fitur cuti karyawan (saldo, ajukan, riwayat) dipindahkan ke /(main)/leave.
 *
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
  Calendar,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  getReminderSettings,
  setReminderSettings,
  rescheduleCheckInReminders,
  OFFSET_OPTIONS,
  type ReminderSettings,
} from '@/services/check-in-reminder.service';

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

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [editForm, setEditForm] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '' });
  const [avatarError, setAvatarError] = useState(false);

  // ── Approval (admin/manager/super_admin) ──────────────────────────
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectId, setRejectId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cek can_approve dari /auth/me (selalu fresh, tidak bergantung SecureStore)
  const { data: meData } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data as {
      role?: { name?: string; can_approve?: boolean };
      avatar_url?: string | null;
      full_name?: string;
      phone?: string | null;
    }),
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

  // ── Sync user.role + avatar_url dari /auth/me ke store ─────────────
  useEffect(() => {
    if (!meData) return;
    const patch: Partial<typeof user & Record<string, unknown>> = {};
    if (meData.role) patch.role = { name: meData.role.name ?? '' };
    if (meData.avatar_url !== undefined && meData.avatar_url !== user?.avatar_url) {
      patch.avatar_url = meData.avatar_url;
    }
    if (Object.keys(patch).length > 0) updateUser(patch);
  }, [meData?.role?.name, meData?.avatar_url]);

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

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['auth-me'] });
    if (isApprover) refetchPending();
  }, [qc, isApprover, refetchPending]);

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
      if (__DEV__) console.log('[avatar] upload OK →', res.data?.avatar_url);
      updateUser({ avatar_url: res.data.avatar_url });
      setAvatarError(false);
      qc.invalidateQueries({ queryKey: ['auth-me'] });
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
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatarMutation.mutate(result.assets[0].uri);
    }
  };

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
          <RefreshControl refreshing={pendingLoading} onRefresh={handleRefresh}
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
                    resizeMode="cover"
                    onLoad={() => { if (__DEV__) console.log('[avatar] Image loaded:', user.avatar_url); }}
                    onError={(e) => {
                      if (__DEV__) console.warn('[avatar] Image error:', user.avatar_url, e.nativeEvent);
                      setAvatarError(true);
                    }}
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
          {/* Menu: Klaim, BA, Surat Tugas, Pengumuman, SOS */}
          <View style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            borderRadius: R.lg,
            borderWidth: B.default,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
            overflow: 'hidden',
          }}>
            {([
              { label: 'Klaim Biaya',      Icon: Receipt,     color: C.orange, route: '/(main)/expense-claims' as Href, roles: null as string[] | null },
              { label: 'Berita Acara',     Icon: FileText,    color: C.teal,   route: '/(main)/service-reports' as Href, roles: null as string[] | null },
              { label: 'Surat Tugas',      Icon: Briefcase,   color: C.indigo, route: '/(main)/business-trips' as Href, roles: null as string[] | null },
              { label: 'Surat Peringatan', Icon: ShieldAlert, color: C.red,    route: '/(main)/warning-letters' as Href, roles: null as string[] | null },
              { label: 'Pengumuman',       Icon: Megaphone,   color: C.blue,   route: '/(main)/announcements' as Href,  roles: ['admin', 'manager', 'super_admin'] as string[] },
              { label: 'SOS Darurat',      Icon: ShieldAlert, color: C.red,    route: '/(main)/sos' as Href, roles: null as string[] | null },
            ]).filter((item) => !item.roles || item.roles.includes(user?.role?.name ?? ''))
            .map((item, idx, arr) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => item.route ? router.push(item.route) : setShowApprovalModal(true)}
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
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(52,199,89,0.14)' : 'rgba(52,199,89,0.10)',
                  borderRadius: R.xl,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(52,199,89,0.40)' : 'rgba(52,199,89,0.30)',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  shadowColor: C.green,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.22 : 0.14,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: C.green,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <ClipboardList size={20} strokeWidth={2} color="#FFF" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }}
                  >
                    Persetujuan Cuti / Izin
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 12, color: lSecondary(isDark), marginTop: 2 }}
                  >
                    {pendingData?.total
                      ? 'Tap untuk meninjau pengajuan'
                      : 'Tidak ada pengajuan menunggu'}
                  </Text>
                </View>

                {!!pendingData?.total && pendingData.total > 0 && (
                  <View
                    style={{
                      minWidth: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: C.red,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 7,
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>
                      {pendingData.total}
                    </Text>
                  </View>
                )}

                <ChevronRight size={18} strokeWidth={2} color={C.green} style={{ marginLeft: 6 }} />
              </View>
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
                        ? new Date(req.start_date + 'T00:00:00+08:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })
                        : `${new Date(req.start_date + 'T00:00:00+08:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' })} — ${new Date(req.end_date + 'T00:00:00+08:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}`
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
    </View>
  );
}
