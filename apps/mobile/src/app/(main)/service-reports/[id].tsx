import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, Image,
  ActivityIndicator, useColorScheme, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import {
  getServiceReport,
  signTechnician,
  signClientDigital,
  ServiceReport,
  getPdfUrl,
} from '@/services/service-reports.service';
import { api as apiClient } from '@/services/api';
import { C, R, B, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { SignaturePad } from '@/components/service-reports/SignaturePad';

type SignStep = 'none' | 'tech' | 'client_name' | 'client_sign';

export default function ServiceReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const [signStep, setSignStep] = useState<SignStep>('none');
  const [clientPicName, setClientPicName] = useState('');
  const [downloading, setDownloading] = useState(false);

  const bg        = pageBg(isDark);
  const card      = cardBg(isDark);
  const textPrimary   = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);
  const textTertiary  = lTertiary(isDark);
  const borderColor   = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const inputBg       = isDark ? 'rgba(255,255,255,0.08)' : '#F9FAFB';

  const { data: report, isLoading } = useQuery<ServiceReport>({
    queryKey: ['service-report', id],
    queryFn: () => getServiceReport(id),
    refetchInterval: (query) => (query.state.data?.is_locked ? false : 30_000),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['service-report', id] });

  const techSignMut = useMutation({
    mutationFn: (base64: string) => signTechnician(id, base64),
    onSuccess: () => { invalidate(); setSignStep('none'); },
    onError: () => Alert.alert('Gagal', 'Tanda tangan teknisi gagal disimpan'),
  });

  const clientSignMut = useMutation({
    mutationFn: ({ name, base64 }: { name: string; base64: string }) =>
      signClientDigital(id, name, base64),
    onSuccess: () => {
      invalidate();
      setSignStep('none');
      setClientPicName('');
      Alert.alert('Sukses', 'Berita Acara telah ditandatangani & dikunci. PDF sedang digenerate.');
    },
    onError: () => Alert.alert('Gagal', 'Tanda tangan klien gagal disimpan'),
  });

  const downloadPdf = async () => {
    if (!report?.is_locked) return;
    try {
      setDownloading(true);
      const safeFileName = (report.report_number ?? id).replace(/\//g, '-');
      // documentDirectory: persisten, tidak dihapus OS (beda dari cacheDirectory)
      const filePath = `${FileSystem.documentDirectory}${safeFileName}.pdf`;

      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        Alert.alert('Sesi Berakhir', 'Silakan login ulang untuk mengunduh PDF.');
        return;
      }
      const baseUrl = String(apiClient.defaults.baseURL ?? '');

      const dl = await FileSystem.downloadAsync(
        `${baseUrl}${getPdfUrl(id)}`,
        filePath,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (dl.status !== 200) {
        Alert.alert('Gagal', `Server mengembalikan error ${dl.status}. Coba beberapa saat lagi.`);
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dl.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Info', `PDF tersimpan di: ${dl.uri}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Gagal', `Gagal mengunduh PDF: ${msg}`);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading || !report) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  const canSignTech   = !report.tech_signature_url && !report.is_locked;
  const canSignClient = !!report.tech_signature_url && !report.client_signature_url && !report.is_locked;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 110 }}
      >
        {/* ── Header ── */}
        <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, color: C.blue, fontWeight: '600' }}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
            {report.report_number ?? 'Berita Acara'}
          </Text>
          {report.is_locked && (
            <View style={{
              marginTop: 10, alignSelf: 'flex-start',
              backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : C.green + '18',
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.pill,
              borderWidth: B.default, borderColor: C.green + '4D',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>🔒 Final</Text>
            </View>
          )}
        </View>

        {/* ── Informasi Kunjungan ── */}
        <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
          <SectionTitle title="Informasi Kunjungan" isDark={isDark} />
          <InfoRow label="Klien"    value={report.client?.name ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
          <InfoRow label="PIC Klien" value={report.client_pic_name ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
          <InfoRow
            label="Check-in"
            value={report.visit?.check_in_at ? fmtDt(report.visit.check_in_at) : '—'}
            textPrimary={textPrimary} textSecondary={textSecondary}
          />
          <InfoRow
            label="Check-out"
            value={report.visit?.check_out_at ? fmtDt(report.visit.check_out_at) : '—'}
            textPrimary={textPrimary} textSecondary={textSecondary}
          />
          {report.visit?.duration_minutes != null && (
            <InfoRow
              label="Durasi"
              value={`${Math.floor(report.visit.duration_minutes / 60)} jam ${report.visit.duration_minutes % 60} menit`}
              textPrimary={textPrimary} textSecondary={textSecondary}
            />
          )}
        </View>

        {/* ── Deskripsi Pekerjaan ── */}
        {report.visit?.work_description && (
          <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
            <SectionTitle title="Deskripsi Pekerjaan" isDark={isDark} />
            <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 22 }}>{report.visit.work_description}</Text>
          </View>
        )}

        {report.visit?.findings && (
          <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
            <SectionTitle title="Temuan" isDark={isDark} />
            <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 22 }}>{report.visit.findings}</Text>
          </View>
        )}

        {report.visit?.recommendations && (
          <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
            <SectionTitle title="Rekomendasi" isDark={isDark} />
            <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 22 }}>{report.visit.recommendations}</Text>
          </View>
        )}

        {/* ── Tanda Tangan ── */}
        <View style={{ backgroundColor: card, borderRadius: 20, borderWidth: B.default, borderColor, padding: 18 }}>
          <SectionTitle title="Tanda Tangan" isDark={isDark} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SignatureBlock
              label="Teknisi"
              url={report.tech_signature_url}
              onSign={canSignTech ? () => setSignStep('tech') : undefined}
              isDark={isDark}
              borderColor={borderColor}
              textTertiary={textTertiary}
            />
            <SignatureBlock
              label={`Klien\n${report.client_pic_name ?? ''}`}
              url={report.client_signature_url}
              onSign={canSignClient ? () => setSignStep('client_name') : undefined}
              isDark={isDark}
              borderColor={borderColor}
              textTertiary={textTertiary}
            />
          </View>
        </View>

        {/* ── Lihat / Download PDF ── */}
        {report.is_locked && (
          <TouchableOpacity
            style={{
              backgroundColor: C.green, borderRadius: 18, padding: 18,
              alignItems: 'center', opacity: downloading ? 0.7 : 1,
              shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
            }}
            onPress={downloadPdf}
            disabled={downloading}
          >
            {downloading ? (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <ActivityIndicator color="#fff" />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                  Membuka PDF…
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                Lihat PDF Berita Acara
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal: Tanda Tangan Teknisi ── */}
      <Modal visible={signStep === 'tech'} animationType="slide">
        <SignaturePad
          title="Tanda Tangan Teknisi"
          onSave={(base64) => techSignMut.mutate(base64)}
          onCancel={() => setSignStep('none')}
        />
      </Modal>

      {/* ── Modal: Input Nama PIC Klien ── */}
      <Modal
        visible={signStep === 'client_name'}
        animationType="slide"
        transparent
        onRequestClose={() => { setSignStep('none'); setClientPicName(''); }}
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 6 }}>
              Nama PIC Klien
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>
              Masukkan nama perwakilan klien yang akan menandatangani.
            </Text>
            <TextInput
              value={clientPicName}
              onChangeText={setClientPicName}
              placeholder="Nama lengkap perwakilan klien"
              placeholderTextColor={textTertiary}
              autoFocus
              style={{
                backgroundColor: inputBg,
                borderRadius: 16, borderWidth: 1.5,
                borderColor: clientPicName.trim() ? C.blue : borderColor,
                padding: 14, fontSize: 15, color: textPrimary,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 15, borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                  alignItems: 'center',
                }}
                onPress={() => { setSignStep('none'); setClientPicName(''); }}
              >
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 2, paddingVertical: 15, borderRadius: 16,
                  backgroundColor: clientPicName.trim() ? C.blue : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  alignItems: 'center',
                  opacity: clientPicName.trim() ? 1 : 0.5,
                }}
                disabled={!clientPicName.trim()}
                onPress={() => setSignStep('client_sign')}
              >
                <Text style={{
                  color: clientPicName.trim() ? '#FFF' : textTertiary,
                  fontWeight: '700', fontSize: 15,
                }}>
                  Lanjut ke Tanda Tangan →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Tanda Tangan Klien ── */}
      <Modal visible={signStep === 'client_sign'} animationType="slide">
        <SignaturePad
          title={`Tanda Tangan Klien — ${clientPicName}`}
          onSave={(base64) => clientSignMut.mutate({ name: clientPicName, base64 })}
          onCancel={() => setSignStep('client_name')}
        />
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: '700', color: C.blue,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14,
    }}>
      {title}
    </Text>
  );
}

function InfoRow({
  label, value, textPrimary, textSecondary,
}: {
  label: string; value: string;
  textPrimary: string; textSecondary: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
      <Text style={{ width: 90, fontSize: 13, color: textSecondary }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: textPrimary }}>{value}</Text>
    </View>
  );
}

function SignatureBlock({
  label, url, onSign, isDark, borderColor, textTertiary,
}: {
  label: string;
  url: string | null;
  onSign?: () => void;
  isDark: boolean;
  borderColor: string;
  textTertiary: string;
}) {
  return (
    <View style={{
      flex: 1, borderWidth: 1.5, borderColor,
      borderRadius: 14, padding: 12, alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    }}>
      <Text style={{
        fontSize: 12, fontWeight: '700', color: textTertiary,
        textAlign: 'center', marginBottom: 10,
      }}>
        {label}
      </Text>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: 80 }}
          resizeMode="contain"
        />
      ) : (
        <View style={{ width: '100%', height: 80, justifyContent: 'center', alignItems: 'center' }}>
          {onSign ? (
            <TouchableOpacity
              style={{
                paddingHorizontal: 14, paddingVertical: 9,
                backgroundColor: isDark ? 'rgba(0,122,255,0.15)' : '#EFF6FF',
                borderRadius: 10, borderWidth: 1.5,
                borderColor: isDark ? 'rgba(0,122,255,0.4)' : '#BFDBFE',
              }}
              onPress={onSign}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.blue }}>✍ Tanda Tangan</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 12, color: textTertiary }}>Menunggu…</Text>
          )}
        </View>
      )}
    </View>
  );
}

function fmtDt(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Makassar',
  }) + ' WITA';
}
