/**
 * M-08 · SCREEN KLAIM BIAYA
 * Karyawan: list klaim sendiri + form buat klaim baru
 * Approver: tambahan tab "Perlu Ditinjau" untuk approve/reject/paid
 */
import React, { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Image, Modal,
  KeyboardAvoidingView, Platform, RefreshControl, useColorScheme,
  StatusBar,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Receipt, Plus, Clock, CheckCircle2, XCircle, CreditCard,
  Info, Calendar, X, Camera, User, ChevronDown,
} from 'lucide-react-native';
import {
  getMyClaims, getAllClaims, getConfig, createClaim, uploadReceipt, reviewClaim,
  ExpenseClaim, ExpenseConfig, CATEGORY_LABELS, formatRupiah,
} from '@/services/expense-claims.service';
import { useAuthStore } from '@/store/auth.store';
import { C, pageBg, cardBg, lPrimary, lSecondary, lTertiary, gradients, R, B } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_META = {
  pending:  { bg: C.orange + '26', bgLight: C.orange + '12', text: C.orange, label: 'Menunggu',  Icon: Clock },
  approved: { bg: C.green + '26',  bgLight: C.green + '12',  text: C.green,  label: 'Disetujui', Icon: CheckCircle2 },
  rejected: { bg: C.red + '26',    bgLight: C.red + '12',    text: C.red,    label: 'Ditolak',   Icon: XCircle },
  paid:     { bg: C.purple + '26', bgLight: C.purple + '12', text: C.purple, label: 'Dibayar',   Icon: CreditCard },
};

const MINE_FILTERS = [
  { label: 'Semua',    value: undefined },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Disetujui',value: 'approved' },
  { label: 'Dibayar',  value: 'paid' },
  { label: 'Ditolak',  value: 'rejected' },
];

const REVIEW_FILTERS = [
  { label: 'Semua',    value: undefined },
  { label: 'Menunggu', value: 'pending' },
  { label: 'Disetujui',value: 'approved' },
  { label: 'Ditolak',  value: 'rejected' },
  { label: 'Dibayar',  value: 'paid' },
];

export default function ExpenseClaimsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const storeUser = useAuthStore((s) => s.user);
  const isApprover = !!storeUser?.role?.can_approve;

  const [activeTab, setActiveTab] = useState<'mine' | 'review'>('mine');
  const [mineFilter, setMineFilter] = useState<string | undefined>(undefined);
  const [reviewFilter, setReviewFilter] = useState<string | undefined>('pending');
  const [showForm, setShowForm] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ claim: ExpenseClaim; action: 'approve' | 'reject' | 'paid' } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const bg = pageBg(isDark);
  const card = cardBg(isDark);
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);
  const textTertiary = lTertiary(isDark);
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

  const { data: myClaims = [], isLoading: myLoading, isError: myError, refetch: refetchMine } = useQuery({
    queryKey: ['my-claims', mineFilter],
    queryFn: () => getMyClaims(mineFilter),
    enabled: activeTab === 'mine',
  });

  const { data: allClaims = [], isLoading: allLoading, isError: allError, refetch: refetchAll } = useQuery({
    queryKey: ['all-claims', reviewFilter],
    queryFn: () => getAllClaims(reviewFilter),
    enabled: isApprover && activeTab === 'review',
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject' | 'paid'; note?: string }) =>
      reviewClaim(id, action, note),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReviewModal(null);
      setRejectNote('');
      qc.invalidateQueries({ queryKey: ['all-claims'] });
      qc.invalidateQueries({ queryKey: ['pending-expense-count'] });
    },
    onError: (err: any) => {
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Gagal memproses klaim');
    },
  });

  const handleReview = (claim: ExpenseClaim, action: 'approve' | 'reject' | 'paid') => {
    if (action === 'approve') {
      Alert.alert(
        'Setujui Klaim',
        `Setujui klaim ${CATEGORY_LABELS[claim.category] ?? claim.category} sebesar ${formatRupiah(claim.amount)} dari ${claim.user?.full_name ?? 'karyawan'}?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Setujui', onPress: () => reviewMut.mutate({ id: claim.id, action: 'approve' }) },
        ],
      );
    } else if (action === 'paid') {
      Alert.alert(
        'Tandai Dibayar',
        `Tandai klaim ini sudah dibayarkan kepada ${claim.user?.full_name ?? 'karyawan'}?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Dibayar', onPress: () => reviewMut.mutate({ id: claim.id, action: 'paid' }) },
        ],
      );
    } else {
      setRejectNote('');
      setReviewModal({ claim, action });
    }
  };

  const isLoading = activeTab === 'mine' ? myLoading : allLoading;
  const isError   = activeTab === 'mine' ? myError   : allError;
  const refetch   = activeTab === 'mine' ? refetchMine : refetchAll;
  const claims    = activeTab === 'mine' ? myClaims : allClaims;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {isDark && (
        <LinearGradient
          colors={gradients.heroExpenseFull}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={isDark ? '#FFF' : C.purple} />}
      >
        <BackHeader title="Klaim Biaya" subtitle="Klaim pengeluaran lapangan" accentColor={C.blue} onBack={() => router.navigate('/(main)/profile')} />

        {/* Tab switcher — hanya muncul untuk approver */}
        {isApprover && (
          <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 8, marginBottom: 4, gap: 8 }}>
            {(['mine', 'review'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 14,
                  backgroundColor: activeTab === tab ? C.purple : isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: activeTab === tab ? '#FFF' : textSecondary }}>
                  {tab === 'mine' ? 'Klaim Saya' : 'Perlu Ditinjau'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tombol buat klaim — hanya di tab "Klaim Saya" */}
        {activeTab === 'mine' && (
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              marginHorizontal: 20, marginTop: 8, marginBottom: 16,
              backgroundColor: C.purple, borderRadius: 18, paddingVertical: 14,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6,
            }}
          >
            <Plus size={20} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Buat Klaim Baru</Text>
          </TouchableOpacity>
        )}

        {/* Filter chips */}
        <FilterChips
          options={activeTab === 'mine' ? MINE_FILTERS : REVIEW_FILTERS}
          value={activeTab === 'mine' ? mineFilter : reviewFilter}
          onChange={activeTab === 'mine' ? setMineFilter : setReviewFilter}
          accentColor={C.purple}
          isDark={isDark}
        />

        {/* List */}
        <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 4 }}>
          {isError && (
            <EmptyState
              icon={XCircle}
              iconColor={C.red}
              title="Gagal memuat data"
              message="Periksa koneksi internet lalu tarik layar ke bawah untuk coba lagi."
            />
          )}
          {!isError && claims.length === 0 && !isLoading && (
            <EmptyState
              icon={Receipt}
              iconColor={C.purple}
              title={activeTab === 'mine' ? 'Belum ada klaim biaya' : 'Tidak ada klaim'}
              message={activeTab === 'mine'
                ? "Tekan 'Buat Klaim Baru' untuk mengajukan reimbursement."
                : 'Tidak ada klaim yang perlu ditinjau saat ini.'}
            />
          )}

          {claims.map((c) => (
            activeTab === 'review'
              ? <AdminClaimCard
                  key={c.id} claim={c} isDark={isDark}
                  onAction={handleReview}
                  isPending={reviewMut.isPending && reviewMut.variables?.id === c.id}
                />
              : <ClaimCard key={c.id} claim={c} isDark={isDark} />
          ))}
        </View>

        <View style={{ height: insets.bottom + 110 }} />
      </ScrollView>

      {/* Modal form buat klaim */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <CreateClaimForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['my-claims'] });
          }}
        />
      </Modal>

      {/* Modal reject — input alasan */}
      <Modal
        visible={reviewModal?.action === 'reject'}
        animationType="slide"
        transparent
        onRequestClose={() => { setReviewModal(null); setRejectNote(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        >
          <View style={{
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: insets.bottom + 24,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.35)', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 6 }}>Tolak Klaim</Text>
            {reviewModal?.claim && (
              <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 16 }}>
                {CATEGORY_LABELS[reviewModal.claim.category] ?? reviewModal.claim.category} · {formatRupiah(reviewModal.claim.amount)} · {reviewModal.claim.user?.full_name ?? '—'}
              </Text>
            )}
            <TextInput
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Alasan penolakan (wajib)..."
              placeholderTextColor={textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F9FAFB',
                borderRadius: 16, borderWidth: 1.5,
                borderColor: rejectNote.trim() ? C.red : borderColor,
                padding: 14, fontSize: 15, color: textPrimary,
                minHeight: 88, marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}
                onPress={() => { setReviewModal(null); setRejectNote(''); }}
              >
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 2, paddingVertical: 15, borderRadius: 16, alignItems: 'center',
                  backgroundColor: rejectNote.trim() ? C.red : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  opacity: reviewMut.isPending ? 0.7 : 1,
                }}
                disabled={!rejectNote.trim() || reviewMut.isPending}
                onPress={() => {
                  if (reviewModal) reviewMut.mutate({ id: reviewModal.claim.id, action: 'reject', note: rejectNote.trim() });
                }}
              >
                {reviewMut.isPending
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={{ color: rejectNote.trim() ? '#FFF' : textTertiary, fontWeight: '700', fontSize: 15 }}>Tolak Klaim</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── ClaimCard (karyawan — klaim sendiri) ──────────────────────────────────────
function ClaimCard({ claim, isDark }: { claim: ExpenseClaim; isDark: boolean }) {
  const s = STATUS_META[claim.status] ?? STATUS_META.pending;
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  return (
    <View style={{
      backgroundColor: cardBg(isDark), borderRadius: 20, padding: 18,
      borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.purple, fontFamily: 'monospace', letterSpacing: 0.5, marginBottom: 3 }}>
            {claim.claim_number ?? '—'}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary }}>
            {CATEGORY_LABELS[claim.category] ?? claim.category}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: isDark ? s.bg : s.bgLight }}>
          <s.Icon size={13} color={s.text} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: s.text }}>{s.label}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 24, fontWeight: '800', color: textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>
        {formatRupiah(claim.amount)}
      </Text>

      {claim.description && (
        <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 20, marginBottom: 8 }} numberOfLines={2}>
          {claim.description}
        </Text>
      )}

      {claim.review_note && claim.status === 'rejected' && (
        <View style={{ backgroundColor: isDark ? C.red + '1F' : C.red + '12', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Info size={14} color={C.red} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 13, color: C.red, flex: 1 }}>Alasan: {claim.review_note}</Text>
        </View>
      )}

      {claim.receipt_urls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {claim.receipt_urls.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={{ width: 60, height: 60, borderRadius: 10, marginRight: 8 }} />
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Calendar size={12} color={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'} />
        <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8' }}>
          {new Date(claim.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </Text>
      </View>
    </View>
  );
}

// ── AdminClaimCard (approver — tinjau klaim orang lain) ───────────────────────
function AdminClaimCard({ claim, isDark, onAction, isPending }: {
  claim: ExpenseClaim;
  isDark: boolean;
  onAction: (claim: ExpenseClaim, action: 'approve' | 'reject' | 'paid') => void;
  isPending: boolean;
}) {
  const s = STATUS_META[claim.status] ?? STATUS_META.pending;
  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  return (
    <View style={{
      backgroundColor: cardBg(isDark), borderRadius: 20, padding: 18,
      borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
    }}>
      {/* Submitter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.purple + '22', alignItems: 'center', justifyContent: 'center' }}>
          <User size={15} color={C.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary }}>{claim.user?.full_name ?? '—'}</Text>
          <Text style={{ fontSize: 11, color: textSecondary, fontFamily: 'monospace' }}>{claim.claim_number ?? '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: isDark ? s.bg : s.bgLight }}>
          <s.Icon size={13} color={s.text} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: s.text }}>{s.label}</Text>
        </View>
      </View>

      {/* Kategori + Nominal */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: textSecondary }}>
          {CATEGORY_LABELS[claim.category] ?? claim.category}
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5, flex: 1 }}>
          {formatRupiah(claim.amount)}
        </Text>
      </View>

      {claim.description && (
        <Text style={{ fontSize: 13, color: textSecondary, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>
          {claim.description}
        </Text>
      )}

      {claim.receipt_urls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {claim.receipt_urls.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={{ width: 64, height: 64, borderRadius: 10, marginRight: 8 }} />
          ))}
        </ScrollView>
      )}

      {claim.review_note && (
        <View style={{ backgroundColor: isDark ? C.red + '1F' : C.red + '12', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', gap: 6 }}>
          <Info size={14} color={C.red} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 13, color: C.red, flex: 1 }}>Catatan: {claim.review_note}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 }}>
        <Calendar size={12} color={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'} />
        <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8' }}>
          {new Date(claim.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </Text>
      </View>

      {/* Action buttons */}
      {claim.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={() => onAction(claim, 'reject')}
            disabled={isPending}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: isDark ? C.red + '22' : C.red + '12', borderWidth: 1.5, borderColor: C.red + '4D' }}
          >
            {isPending ? <ActivityIndicator size="small" color={C.red} /> : <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>Tolak</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAction(claim, 'approve')}
            disabled={isPending}
            style={{ flex: 2, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: C.green, shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            {isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Setujui</Text>}
          </TouchableOpacity>
        </View>
      )}

      {claim.status === 'approved' && (
        <TouchableOpacity
          onPress={() => onAction(claim, 'paid')}
          disabled={isPending}
          style={{ paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: C.purple, shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        >
          {isPending ? <ActivityIndicator color="#FFF" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Tandai Sudah Dibayar</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── CreateClaimForm ───────────────────────────────────────────────────────────
function CreateClaimForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUris, setReceiptUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const bg = isDark ? '#0A0A0F' : '#F0F4FF';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#64748B';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.14)' : '#E2E8F0';

  const { data: configs = [] } = useQuery<ExpenseConfig[]>({
    queryKey: ['expense-config'],
    queryFn: getConfig,
  });

  const selectedConfig = configs.find((c) => c.category === category);

  const addReceipt = async () => {
    if (receiptUris.length >= 5) {
      Alert.alert('Batas Maksimum', 'Maksimal 5 foto receipt per klaim.');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Izin diperlukan', 'Akses kamera diperlukan'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const fileSize = result.assets[0].fileSize ?? 0;
      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Terlalu Besar', 'Ukuran foto maksimal 10 MB.');
        return;
      }
      setReceiptUris((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const createMut = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const uploadedUrls: string[] = [];
      for (const uri of receiptUris) {
        const url = await uploadReceipt(uri);
        uploadedUrls.push(url);
      }
      setUploading(false);
      return createClaim({
        category,
        amount: parseInt(amount.replace(/\D/g, '') || '0', 10),
        description: description || undefined,
        receipt_urls: uploadedUrls,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setUploading(false);
      Alert.alert('Gagal', err?.response?.data?.message ?? 'Gagal mengajukan klaim');
    },
  });

  const canSubmit = category && amount && parseInt(amount.replace(/\D/g, '') || '0', 10) > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isDark && (
        <LinearGradient
          colors={gradients.heroExpense}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>Buat Klaim Biaya</Text>
        <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>Batal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kategori */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {configs.filter((c) => c.is_active).map((c) => (
                <TouchableOpacity
                  key={c.category}
                  onPress={() => setCategory(c.category)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: category === c.category ? C.purple : isDark ? 'rgba(255,255,255,0.09)' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: category === c.category ? C.purple : isDark ? 'rgba(255,255,255,0.14)' : '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: category === c.category ? '#FFF' : (isDark ? 'rgba(255,255,255,0.75)' : '#475569') }}>
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {selectedConfig && (
            <Text style={{ fontSize: 12, color: textSecondary, marginTop: 8 }}>
              Maks: {formatRupiah(selectedConfig.max_amount)} · Nota wajib ≥ {formatRupiah(selectedConfig.receipt_required_above)}
            </Text>
          )}
        </View>

        {/* Nominal */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nominal</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
            style={{ borderWidth: 1.5, borderColor: inputBorder, borderRadius: 16, padding: 16, fontSize: 24, fontWeight: '700', color: textPrimary, backgroundColor: inputBg }}
          />
          {amount && (
            <Text style={{ fontSize: 13, color: C.purple, marginTop: 6, fontWeight: '600' }}>
              = {formatRupiah(parseInt(amount.replace(/\D/g, '') || '0', 10))}
            </Text>
          )}
        </View>

        {/* Keterangan */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Keterangan (opsional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Deskripsi pengeluaran..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ borderWidth: 1.5, borderColor: inputBorder, borderRadius: 16, padding: 16, fontSize: 15, color: textPrimary, backgroundColor: inputBg, minHeight: 88 }}
          />
        </View>

        {/* Foto nota */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Foto Nota/Struk</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {receiptUris.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 14 }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setReceiptUris((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={12} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {receiptUris.length < 5 && (
              <TouchableOpacity
                onPress={addReceipt}
                style={{ width: 80, height: 80, borderRadius: 14, borderWidth: 2, borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Camera size={22} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
                <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8', fontWeight: '600' }}>+ Foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => createMut.mutate()}
          disabled={!canSubmit || createMut.isPending || uploading}
          style={{
            backgroundColor: canSubmit ? C.purple : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
            borderRadius: 18, paddingVertical: 17, alignItems: 'center',
            ...(canSubmit ? { shadowColor: C.purple, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 } : {}),
          }}
        >
          {(createMut.isPending || uploading) ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: canSubmit ? '#FFF' : (isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF') }}>
              Ajukan Klaim
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
