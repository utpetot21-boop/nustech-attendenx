/**
 * Surat Peringatan — dual mode:
 *  - Karyawan: daftar SP diri sendiri (`/warning-letters/me`) + detail + konfirmasi + PDF.
 *  - Admin/HR/Manager/Super Admin: tambah tab "Semua SP" (`/warning-letters`) + FAB "Buat SP".
 * Detail pakai bottom-sheet modal; create form pakai page-sheet modal.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ShieldAlert,
  CheckCircle2,
  FileText,
  Download,
  Calendar,
  ChevronRight,
  X,
  AlertTriangle,
  Info,
  Plus,
  Search,
  User,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { C, R, B, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  warningLettersService,
  WarningLetter,
  WarningLevel,
  WARNING_LEVEL_LABELS,
  WARNING_LEVEL_COLORS,
  CreateWarningLetterInput,
} from '@/services/warning-letters.service';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/services/api';

const ADMIN_ROLES = ['super_admin', 'admin', 'manager'];

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_id?: string;
  department?: { name?: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T00:00:00+08:00' : '')).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Card ─────────────────────────────────────────────────────────────────────

function WarningCard({
  sp,
  onPress,
  isDark,
  showUser,
}: {
  sp: WarningLetter;
  onPress: () => void;
  isDark: boolean;
  showUser?: boolean;
}) {
  const color = WARNING_LEVEL_COLORS[sp.level] ?? C.red;
  const label = WARNING_LEVEL_LABELS[sp.level] ?? sp.level;
  const acknowledged = !!sp.acknowledged_at;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: R.md,
            backgroundColor: color + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldAlert size={22} strokeWidth={2} color={color} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color, letterSpacing: -0.2 }}>
              {sp.level}
            </Text>
            <Text style={{ fontSize: 13, color: lSecondary(isDark), flex: 1 }} numberOfLines={1}>
              {label}
            </Text>
          </View>

          {showUser && sp.user?.full_name && (
            <Text style={{ fontSize: 13, color: lPrimary(isDark), fontWeight: '700', marginBottom: 2 }} numberOfLines={1}>
              {sp.user.full_name}
            </Text>
          )}

          <Text
            style={{ fontSize: 13, color: lPrimary(isDark), fontWeight: '500' }}
            numberOfLines={2}
          >
            {sp.reason}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} strokeWidth={2} color={lTertiary(isDark)} />
              <Text style={{ fontSize: 11, color: lSecondary(isDark) }}>
                {fmtDate(sp.issued_at)}
              </Text>
            </View>
            <StatusBadge
              label={acknowledged ? 'Dikonfirmasi' : 'Belum dikonfirmasi'}
              color={acknowledged ? C.green : C.orange}
              dot={!acknowledged}
            />
          </View>
        </View>

        <ChevronRight size={16} strokeWidth={2} color={lTertiary(isDark)} />
      </View>
    </TouchableOpacity>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  sp,
  onClose,
  isDark,
  currentUserId,
}: {
  sp: WarningLetter | null;
  onClose: () => void;
  isDark: boolean;
  currentUserId: string | null;
}) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => warningLettersService.acknowledge(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['warning-letters-me'] });
      qc.invalidateQueries({ queryKey: ['warning-letters-all'] });
      Alert.alert('Terkonfirmasi', 'Anda telah mengkonfirmasi penerimaan SP ini.');
      onClose();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', e?.response?.data?.message ?? 'Gagal mengkonfirmasi SP');
    },
  });

  const pdfMut = useMutation({
    mutationFn: (id: string) => warningLettersService.getPdfUrl(id),
    onSuccess: async (res) => {
      const canOpen = await Linking.canOpenURL(res.url);
      if (canOpen) Linking.openURL(res.url);
      else Alert.alert('Gagal', 'PDF tidak dapat dibuka di perangkat ini.');
    },
    onError: (e: any) =>
      Alert.alert(
        'PDF belum siap',
        e?.response?.data?.message ?? 'Silakan coba lagi beberapa saat.',
      ),
  });

  if (!sp) return null;

  const color = WARNING_LEVEL_COLORS[sp.level] ?? C.red;
  const label = WARNING_LEVEL_LABELS[sp.level] ?? sp.level;
  const acknowledged = !!sp.acknowledged_at;
  const isOwnSp = currentUserId != null && currentUserId === sp.user_id;

  const confirmAck = () => {
    Alert.alert(
      `Konfirmasi ${sp.level}`,
      'Dengan mengkonfirmasi, Anda menyatakan telah menerima dan memahami isi Surat Peringatan ini. Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Konfirmasi',
          style: 'destructive',
          onPress: () => acknowledgeMut.mutate(sp.id),
        },
      ],
    );
  };

  return (
    <Modal
      visible={!!sp}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.4 }}>
            Detail SP
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} strokeWidth={2} color={lSecondary(isDark)} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View
            style={{
              backgroundColor: color + (isDark ? '1F' : '14'),
              borderRadius: R.xl,
              borderWidth: 1,
              borderColor: color + '55',
              padding: 18,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: R.lg,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <ShieldAlert size={28} strokeWidth={2} color="#FFF" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color, letterSpacing: -0.5 }}>
              {sp.level}
            </Text>
            <Text style={{ fontSize: 13, color: lSecondary(isDark), marginTop: 2, fontWeight: '600' }}>
              {label}
            </Text>
          </View>

          {/* Field rows */}
          <View
            style={{
              backgroundColor: cardBg(isDark),
              borderRadius: R.lg,
              borderWidth: B.default,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {sp.user?.full_name && (
              <FieldRow label="Karyawan" value={sp.user.full_name} isDark={isDark} />
            )}
            <FieldRow
              label="Tanggal Terbit"
              value={fmtDate(sp.issued_at)}
              isDark={isDark}
            />
            {sp.valid_until && (
              <FieldRow label="Berlaku Sampai" value={fmtDate(sp.valid_until)} isDark={isDark} />
            )}
            {sp.issuer?.full_name && (
              <FieldRow label="Diterbitkan Oleh" value={sp.issuer.full_name} isDark={isDark} />
            )}
            <FieldRow
              label="Status Konfirmasi"
              value={
                acknowledged
                  ? `Dikonfirmasi ${fmtDateTime(sp.acknowledged_at)}`
                  : 'Belum dikonfirmasi'
              }
              valueColor={acknowledged ? C.green : C.orange}
              isDark={isDark}
              last
            />
          </View>

          {/* Alasan */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1,
              color: lTertiary(isDark),
              marginBottom: 6,
              textTransform: 'uppercase',
            }}
          >
            Alasan
          </Text>
          <View
            style={{
              backgroundColor: cardBg(isDark),
              borderRadius: R.md,
              borderWidth: B.default,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 14, lineHeight: 21, color: lPrimary(isDark) }}>
              {sp.reason}
            </Text>
          </View>

          {/* Catatan */}
          {sp.notes && (
            <>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: lTertiary(isDark),
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}
              >
                Catatan
              </Text>
              <View
                style={{
                  backgroundColor: cardBg(isDark),
                  borderRadius: R.md,
                  borderWidth: B.default,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.10)',
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, lineHeight: 21, color: lPrimary(isDark) }}>
                  {sp.notes}
                </Text>
              </View>
            </>
          )}

          {/* Info box jika belum acknowledged & pemiliknya sendiri */}
          {!acknowledged && isOwnSp && (
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                backgroundColor: C.orange + (isDark ? '1F' : '14'),
                borderRadius: R.md,
                borderWidth: 1,
                borderColor: C.orange + '55',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <AlertTriangle size={18} strokeWidth={2} color={C.orange} />
              <Text style={{ flex: 1, fontSize: 12, color: lPrimary(isDark), lineHeight: 18 }}>
                Anda belum mengkonfirmasi penerimaan SP ini. Konfirmasi bukan berarti menyetujui
                isi, melainkan menyatakan bahwa Anda telah menerima dan membacanya.
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ gap: 10 }}>
            {!acknowledged && isOwnSp && (
              <TouchableOpacity
                onPress={confirmAck}
                disabled={acknowledgeMut.isPending}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: color,
                  paddingVertical: 14,
                  borderRadius: R.md,
                }}
              >
                {acknowledgeMut.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <CheckCircle2 size={18} strokeWidth={2.2} color="#FFF" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>
                      Konfirmasi Penerimaan
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => pdfMut.mutate(sp.id)}
              disabled={pdfMut.isPending}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFF',
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(60,60,67,0.18)',
                paddingVertical: 14,
                borderRadius: R.md,
              }}
            >
              {pdfMut.isPending ? (
                <ActivityIndicator color={C.blue} />
              ) : (
                <>
                  <Download size={18} strokeWidth={2} color={C.blue} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.blue }}>
                    Unduh PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function FieldRow({
  label,
  value,
  valueColor,
  isDark,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  isDark: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : B.default,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.08)',
      }}
    >
      <Text style={{ fontSize: 13, color: lSecondary(isDark), flex: 1 }}>{label}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: valueColor ?? lPrimary(isDark),
          flexShrink: 1,
          textAlign: 'right',
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Create Sheet (admin only) ────────────────────────────────────────────────

function CreateSheet({
  visible,
  onClose,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [level, setLevel] = useState<WarningLevel>('SP1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [issuedAt, setIssuedAt] = useState<Date>(new Date());
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [datePickerFor, setDatePickerFor] = useState<'issued' | 'valid' | null>(null);

  const resetForm = () => {
    setEmployee(null);
    setPickerOpen(false);
    setEmpSearch('');
    setLevel('SP1');
    setReason('');
    setNotes('');
    setIssuedAt(new Date());
    setValidUntil(null);
    setDatePickerFor(null);
  };

  const closeAndReset = () => {
    onClose();
    setTimeout(resetForm, 300);
  };

  const { data: employees = [], isFetching: loadingEmployees } = useQuery<EmployeeOption[]>({
    queryKey: ['sp-employee-search', empSearch],
    queryFn: () =>
      api
        .get('/users', { params: { search: empSearch || undefined, limit: 20 } })
        .then((r) => r.data?.items ?? []),
    enabled: visible && pickerOpen,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (dto: CreateWarningLetterInput) => warningLettersService.create(dto),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['warning-letters-all'] });
      qc.invalidateQueries({ queryKey: ['warning-letters-me'] });
      Alert.alert('Tersimpan', 'Surat Peringatan berhasil dibuat. Karyawan telah diberi notifikasi.');
      closeAndReset();
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', e?.response?.data?.message ?? 'Gagal membuat SP');
    },
  });

  const submit = () => {
    if (!employee) {
      Alert.alert('Lengkapi Data', 'Pilih karyawan yang akan diberi SP.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Lengkapi Data', 'Alasan SP wajib diisi.');
      return;
    }
    const dto: CreateWarningLetterInput = {
      user_id: employee.id,
      level,
      reason: reason.trim(),
      issued_at: toDateStr(issuedAt),
      valid_until: validUntil ? toDateStr(validUntil) : undefined,
      notes: notes.trim() || undefined,
    };
    createMut.mutate(dto);
  };

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC';
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,60,67,0.12)';
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeAndReset}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: pageBg(isDark) }}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, letterSpacing: -0.4 }}>
            Buat Surat Peringatan
          </Text>
          <TouchableOpacity onPress={closeAndReset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} strokeWidth={2} color={textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Karyawan */}
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Karyawan *
          </Text>

          {!pickerOpen && (
            <TouchableOpacity
              onPress={() => { setPickerOpen(true); setEmpSearch(''); }}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
                borderColor: inputBorder, paddingHorizontal: 14, paddingVertical: 14,
                marginBottom: 14,
              }}
            >
              {employee ? (
                <>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.red + '1F', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} strokeWidth={2} color={C.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary }} numberOfLines={1}>
                      {employee.full_name}
                    </Text>
                    {(employee.employee_id || employee.department?.name) && (
                      <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                        {[employee.employee_id, employee.department?.name].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                  <Text style={{ flex: 1, fontSize: 15, color: lTertiary(isDark) }}>
                    Pilih karyawan...
                  </Text>
                </>
              )}
              <ChevronDown size={18} strokeWidth={2} color={lTertiary(isDark)} />
            </TouchableOpacity>
          )}

          {pickerOpen && (
            <View style={{ marginBottom: 14 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
                borderColor: C.red, paddingHorizontal: 14, paddingVertical: 12,
              }}>
                <Search size={16} strokeWidth={2} color={lTertiary(isDark)} />
                <TextInput
                  value={empSearch}
                  onChangeText={setEmpSearch}
                  placeholder="Cari nama atau NIK..."
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
                  autoFocus
                  style={{ flex: 1, fontSize: 15, color: textPrimary, padding: 0 }}
                />
                <TouchableOpacity
                  onPress={() => { setPickerOpen(false); setEmpSearch(''); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} strokeWidth={2} color={lTertiary(isDark)} />
                </TouchableOpacity>
              </View>
              <View style={{
                marginTop: 8, backgroundColor: inputBg, borderRadius: 14,
                borderWidth: 1, borderColor: inputBorder,
                maxHeight: 240, overflow: 'hidden',
              }}>
                {loadingEmployees ? (
                  <ActivityIndicator color={C.red} style={{ paddingVertical: 20 }} />
                ) : employees.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: lTertiary(isDark), padding: 16, fontSize: 14 }}>
                    {empSearch ? 'Tidak ada hasil' : 'Ketik untuk mencari karyawan'}
                  </Text>
                ) : (
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {employees.map((emp) => {
                      const active = employee?.id === emp.id;
                      return (
                        <TouchableOpacity
                          key={emp.id}
                          onPress={() => {
                            setEmployee(emp);
                            setPickerOpen(false);
                            setEmpSearch('');
                          }}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 10,
                            paddingHorizontal: 14, paddingVertical: 10,
                            backgroundColor: active ? C.red + '14' : 'transparent',
                            borderBottomWidth: 0.5,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.red + '1F', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={15} strokeWidth={2} color={C.red} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }} numberOfLines={1}>
                              {emp.full_name}
                            </Text>
                            {(emp.employee_id || emp.department?.name) && (
                              <Text style={{ fontSize: 11, color: lTertiary(isDark), marginTop: 1 }} numberOfLines={1}>
                                {[emp.employee_id, emp.department?.name].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                          {active && <Check size={16} strokeWidth={2.5} color={C.red} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          )}

          {/* Level */}
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tingkat SP *
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['SP1', 'SP2', 'SP3'] as WarningLevel[]).map((lv) => {
              const active = level === lv;
              const lvColor = WARNING_LEVEL_COLORS[lv];
              return (
                <TouchableOpacity
                  key={lv}
                  onPress={() => setLevel(lv)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: active ? lvColor + (isDark ? '30' : '1F') : inputBg,
                    borderWidth: 1.5,
                    borderColor: active ? lvColor : inputBorder,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: active ? lvColor : textSecondary, letterSpacing: -0.2 }}>
                    {lv}
                  </Text>
                  <Text style={{ fontSize: 10, color: active ? lvColor : lTertiary(isDark), marginTop: 2 }} numberOfLines={1}>
                    {WARNING_LEVEL_LABELS[lv].replace('Surat Peringatan ', 'Tingkat ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tanggal */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Tanggal Terbit *
              </Text>
              <TouchableOpacity
                onPress={() => setDatePickerFor('issued')}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: inputBg, borderRadius: 14, borderWidth: 1.5,
                  borderColor: inputBorder, paddingHorizontal: 12, paddingVertical: 13,
                }}
              >
                <Calendar size={15} strokeWidth={2} color={C.red} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: textPrimary }}>
                  {fmtDate(toDateStr(issuedAt))}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Berlaku s/d
              </Text>
              <TouchableOpacity
                onPress={() => setDatePickerFor('valid')}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: inputBg, borderRadius: 14, borderWidth: 1.5,
                  borderColor: inputBorder, paddingHorizontal: 12, paddingVertical: 13,
                }}
              >
                <Calendar size={15} strokeWidth={2} color={validUntil ? C.red : lTertiary(isDark)} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: validUntil ? textPrimary : lTertiary(isDark) }}>
                  {validUntil ? fmtDate(toDateStr(validUntil)) : 'Opsional'}
                </Text>
                {validUntil && (
                  <TouchableOpacity onPress={() => setValidUntil(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={14} strokeWidth={2} color={lTertiary(isDark)} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {datePickerFor && (
            <DateTimePicker
              value={datePickerFor === 'issued' ? issuedAt : (validUntil ?? new Date())}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                if (Platform.OS !== 'ios') setDatePickerFor(null);
                if (event.type === 'set' && selected) {
                  if (datePickerFor === 'issued') setIssuedAt(selected);
                  else setValidUntil(selected);
                }
              }}
            />
          )}

          {Platform.OS === 'ios' && datePickerFor && (
            <TouchableOpacity
              onPress={() => setDatePickerFor(null)}
              style={{
                alignSelf: 'flex-end', backgroundColor: C.red,
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginBottom: 10,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Selesai</Text>
            </TouchableOpacity>
          )}

          {/* Alasan */}
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Alasan *
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Jelaskan alasan penerbitan SP..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
            multiline numberOfLines={4} textAlignVertical="top"
            style={{
              backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
              borderColor: inputBorder, padding: 14, fontSize: 15,
              color: textPrimary, minHeight: 100, marginBottom: 14,
            }}
          />

          {/* Catatan */}
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Catatan (opsional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Catatan tambahan, rekomendasi perbaikan, dll."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
            multiline numberOfLines={3} textAlignVertical="top"
            style={{
              backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5,
              borderColor: inputBorder, padding: 14, fontSize: 15,
              color: textPrimary, minHeight: 80, marginBottom: 18,
            }}
          />

          {/* Peringatan */}
          <View style={{
            flexDirection: 'row', gap: 10,
            backgroundColor: C.orange + (isDark ? '1F' : '14'),
            borderRadius: R.md, borderWidth: 1, borderColor: C.orange + '55',
            padding: 12, marginBottom: 18,
          }}>
            <AlertTriangle size={18} strokeWidth={2} color={C.orange} />
            <Text style={{ flex: 1, fontSize: 12, color: lPrimary(isDark), lineHeight: 18 }}>
              SP bersifat resmi. PDF akan dihasilkan otomatis dan notifikasi terkirim ke karyawan.
              Pastikan data sudah benar sebelum submit.
            </Text>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={closeAndReset}
              style={{
                flex: 1, paddingVertical: 15, borderRadius: 16,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={createMut.isPending || !employee || !reason.trim()}
              style={{
                flex: 1, paddingVertical: 15, borderRadius: 16,
                backgroundColor: (employee && reason.trim()) ? C.red : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                alignItems: 'center',
              }}
            >
              {createMut.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{
                  color: (employee && reason.trim()) ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'),
                  fontWeight: '700', fontSize: 15,
                }}>
                  Terbitkan SP
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function WarningLettersScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role?.name ?? '');

  const [tab, setTab] = useState<'me' | 'all'>('me');
  const activeTab = isAdmin ? tab : 'me';

  const [selected, setSelected] = useState<WarningLetter | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const meQ = useQuery<WarningLetter[]>({
    queryKey: ['warning-letters-me'],
    queryFn: () => warningLettersService.getMine(),
    staleTime: 60_000,
    enabled: activeTab === 'me',
  });

  const allQ = useQuery<WarningLetter[]>({
    queryKey: ['warning-letters-all'],
    queryFn: () => warningLettersService.getAll(),
    staleTime: 60_000,
    enabled: isAdmin && activeTab === 'all',
  });

  const { data, isLoading, isRefetching, refetch } =
    activeTab === 'me' ? meQ : allQ;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const letters = data ?? [];
  const pendingAck = useMemo(
    () => letters.filter((l) => !l.acknowledged_at).length,
    [letters],
  );

  const subtitle =
    letters.length === 0
      ? activeTab === 'me'
        ? 'Tidak ada SP'
        : 'Belum ada SP terbit'
      : activeTab === 'me' && pendingAck > 0
      ? `${pendingAck} belum dikonfirmasi`
      : `${letters.length} SP tercatat`;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <BackHeader
        title="Surat Peringatan"
        subtitle={subtitle}
        accentColor={C.red}
      />

      {/* Tab switcher (admin only) */}
      {isAdmin && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.06)',
              borderRadius: 12,
              padding: 3,
            }}
          >
            {(['me', 'all'] as const).map((t) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 9,
                    backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF') : 'transparent',
                    alignItems: 'center',
                    ...(active && {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDark ? 0 : 0.04,
                      shadowRadius: 2,
                    }),
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: active ? '700' : '600',
                    color: active ? lPrimary(isDark) : lSecondary(isDark),
                  }}>
                    {t === 'me' ? 'SP Saya' : 'Semua SP'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.red} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        {letters.length > 0 && activeTab === 'me' && (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              backgroundColor: C.blue + (isDark ? '14' : '0F'),
              borderRadius: R.md,
              borderWidth: 1,
              borderColor: C.blue + '33',
              padding: 12,
              marginBottom: 14,
            }}
          >
            <Info size={16} strokeWidth={2} color={C.blue} />
            <Text style={{ flex: 1, fontSize: 12, color: lSecondary(isDark), lineHeight: 18 }}>
              Tap SP untuk melihat detail, mengkonfirmasi penerimaan, atau mengunduh PDF resmi.
            </Text>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 48 }} />
        ) : letters.length === 0 ? (
          <EmptyState
            icon={FileText}
            iconColor={activeTab === 'me' ? C.green : C.blue}
            title={activeTab === 'me' ? 'Tidak ada Surat Peringatan' : 'Belum ada SP Terbit'}
            message={
              activeTab === 'me'
                ? 'Pertahankan kinerja terbaikmu. Catatan SP akan muncul di sini jika ada.'
                : 'Tekan tombol + untuk menerbitkan Surat Peringatan kepada karyawan.'
            }
          />
        ) : (
          letters.map((sp) => (
            <WarningCard
              key={sp.id}
              sp={sp}
              onPress={() => setSelected(sp)}
              isDark={isDark}
              showUser={activeTab === 'all'}
            />
          ))
        )}
      </ScrollView>

      {/* FAB Buat SP */}
      {isAdmin && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCreate(true);
          }}
          activeOpacity={0.85}
          style={{
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 104,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: C.red,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: C.red,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <Plus size={26} strokeWidth={2.5} color="#FFF" />
        </TouchableOpacity>
      )}

      <DetailModal
        sp={selected}
        onClose={() => setSelected(null)}
        isDark={isDark}
        currentUserId={user?.id ?? null}
      />
      <CreateSheet visible={showCreate} onClose={() => setShowCreate(false)} isDark={isDark} />
    </View>
  );
}
