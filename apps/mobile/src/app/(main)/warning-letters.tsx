/**
 * Surat Peringatan Saya — daftar SP yang diterima karyawan.
 * Detail via bottom sheet modal, acknowledge + download PDF.
 */
import { useState, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
} from 'lucide-react-native';
import { C, R, B, cardBg, pageBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  warningLettersService,
  WarningLetter,
  WARNING_LEVEL_LABELS,
  WARNING_LEVEL_COLORS,
} from '@/services/warning-letters.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
  });
}

// ── Card ─────────────────────────────────────────────────────────────────────

function WarningCard({
  sp,
  onPress,
  isDark,
}: {
  sp: WarningLetter;
  onPress: () => void;
  isDark: boolean;
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
}: {
  sp: WarningLetter | null;
  onClose: () => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => warningLettersService.acknowledge(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['warning-letters-me'] });
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
            paddingTop: 16,
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

          {/* Info box jika belum acknowledged */}
          {!acknowledged && (
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
            {!acknowledged && (
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

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function WarningLettersScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<WarningLetter | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery<WarningLetter[]>({
    queryKey: ['warning-letters-me'],
    queryFn: () => warningLettersService.getMine(),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const letters = data ?? [];
  const pendingAck = letters.filter((l) => !l.acknowledged_at).length;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <BackHeader
        title="Surat Peringatan"
        subtitle={
          letters.length === 0
            ? 'Tidak ada SP'
            : pendingAck > 0
            ? `${pendingAck} belum dikonfirmasi`
            : `${letters.length} SP tercatat`
        }
        accentColor={C.red}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.red} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        {letters.length > 0 && (
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
            iconColor={C.green}
            title="Tidak ada Surat Peringatan"
            message="Pertahankan kinerja terbaikmu. Catatan SP akan muncul di sini jika ada."
          />
        ) : (
          letters.map((sp) => (
            <WarningCard key={sp.id} sp={sp} onPress={() => setSelected(sp)} isDark={isDark} />
          ))
        )}
      </ScrollView>

      <DetailModal sp={selected} onClose={() => setSelected(null)} isDark={isDark} />
    </View>
  );
}
