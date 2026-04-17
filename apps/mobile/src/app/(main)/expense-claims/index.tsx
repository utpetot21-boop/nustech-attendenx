/**
 * M-08 · SCREEN KLAIM BIAYA
 * List klaim + form buat klaim baru
 * Redesigned UI — consistent with app design language
 */
import React, { useState } from 'react';
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
  Info, Calendar, X, Camera,
} from 'lucide-react-native';
import {
  getMyClaims, getConfig, createClaim, uploadReceipt,
  ExpenseClaim, ExpenseConfig, CATEGORY_LABELS, formatRupiah,
} from '@/services/expense-claims.service';
import { BackHeader } from '@/components/ui/BackHeader';

const STATUS_META = {
  pending:  { bg: 'rgba(245,158,11,0.15)', bgLight: '#FFFBEB', text: '#F59E0B', label: 'Menunggu', Icon: Clock },
  approved: { bg: 'rgba(22,163,74,0.15)',  bgLight: '#DCFCE7', text: '#16A34A', label: 'Disetujui', Icon: CheckCircle2 },
  rejected: { bg: 'rgba(239,68,68,0.15)',  bgLight: '#FEF2F2', text: '#EF4444', label: 'Ditolak',   Icon: XCircle },
  paid:     { bg: 'rgba(124,58,237,0.15)', bgLight: '#F5F3FF', text: '#7C3AED', label: 'Dibayar',   Icon: CreditCard },
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

export default function ExpenseClaimsScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showForm, setShowForm] = useState(false);

  const bg = isDark ? '#0A0A0F' : '#F0F4FF';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#64748B';

  const { data: claims = [], isLoading, refetch } = useQuery({
    queryKey: ['my-claims', filter],
    queryFn: () => getMyClaims(filter === 'all' ? undefined : filter),
  });

  const FILTERS: { label: string; value: FilterStatus }[] = [
    { label: 'Semua', value: 'all' },
    { label: 'Menunggu', value: 'pending' },
    { label: 'Disetujui', value: 'approved' },
    { label: 'Dibayar', value: 'paid' },
    { label: 'Ditolak', value: 'rejected' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {isDark && (
        <LinearGradient
          colors={['#1A0D28', '#0A0A0F', '#0D1A0A']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={isDark ? '#FFF' : '#7C3AED'} />}
      >
        {/* Header */}
        <View>
          <BackHeader title="Klaim Biaya" subtitle="Klaim pengeluaran lapangan" accentColor="#7C3AED" />

          {/* Buat Klaim button */}
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              marginTop: 16,
              backgroundColor: '#7C3AED',
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
            }}
          >
            <Plus size={20} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Buat Klaim Baru</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}
        >
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 9,
                  borderRadius: 22,
                  backgroundColor: active ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.09)' : '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: active ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.14)' : '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#FFF' : isDark ? 'rgba(255,255,255,0.75)' : '#475569' }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {claims.length === 0 && !isLoading && (
            <View style={{ paddingTop: 48, alignItems: 'center' }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: isDark ? 'rgba(124,58,237,0.15)' : '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Receipt size={34} color="#7C3AED" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.7)' : '#374151' }}>
                Belum ada klaim biaya
              </Text>
            </View>
          )}

          {claims.map((c) => (
            <ClaimCard key={c.id} claim={c} isDark={isDark} />
          ))}
        </View>

        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      {/* Create Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <CreateClaimForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['my-claims'] });
          }}
        />
      </Modal>
    </View>
  );
}

// ── ClaimCard ─────────────────────────────────────────────────────────────────
function ClaimCard({ claim, isDark }: { claim: ExpenseClaim; isDark: boolean }) {
  const s = STATUS_META[claim.status] ?? STATUS_META.pending;
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#64748B';

  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
      borderRadius: 20, padding: 18,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED', fontFamily: 'monospace', letterSpacing: 0.5, marginBottom: 3 }}>
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
        <View style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Info size={14} color="#EF4444" style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 13, color: '#EF4444', flex: 1 }}>Alasan: {claim.review_note}</Text>
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
  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF';
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
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      // P2-10: cek ukuran file sebelum ditambahkan
      const fileSize = result.assets[0].fileSize ?? 0;
      if (fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Terlalu Besar', 'Ukuran foto maksimal 10 MB. Coba foto ulang dengan kualitas lebih rendah.');
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
        amount: parseInt(amount.replace(/\D/g, '')),
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

  const canSubmit = category && amount && parseInt(amount.replace(/\D/g, '')) > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isDark && (
        <LinearGradient
          colors={['#1A0D28', '#0A0A0F']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>Buat Klaim Biaya</Text>
        <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>Batal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Kategori */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Kategori
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {configs.filter((c) => c.is_active).map((c) => (
                <TouchableOpacity
                  key={c.category}
                  onPress={() => setCategory(c.category)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: category === c.category ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.09)' : '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: category === c.category ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.14)' : '#E2E8F0',
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
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nominal
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
            style={{ borderWidth: 1.5, borderColor: inputBorder, borderRadius: 16, padding: 16, fontSize: 24, fontWeight: '700', color: textPrimary, backgroundColor: inputBg }}
          />
          {amount && (
            <Text style={{ fontSize: 13, color: '#7C3AED', marginTop: 6, fontWeight: '600' }}>
              = {formatRupiah(parseInt(amount.replace(/\D/g, '') || '0'))}
            </Text>
          )}
        </View>

        {/* Keterangan */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Keterangan (opsional)
          </Text>
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
          <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Foto Nota/Struk
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {receiptUris.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 14 }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
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
            backgroundColor: canSubmit ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
            borderRadius: 18, paddingVertical: 17, alignItems: 'center',
            ...(canSubmit ? { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 } : {}),
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
