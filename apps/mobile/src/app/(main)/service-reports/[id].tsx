import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, StyleSheet, Image,
  ActivityIndicator,
} from 'react-native';
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
import { C, R } from '@/constants/tokens';
import { SignaturePad } from '@/components/service-reports/SignaturePad';

type SignStep = 'none' | 'tech' | 'client_name' | 'client_sign';

export default function ServiceReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [signStep, setSignStep] = useState<SignStep>('none');
  const [clientPicName, setClientPicName] = useState('');
  const [downloading, setDownloading] = useState(false);

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
      Alert.alert('Sukses', 'Berita Acara telah ditandatangani & dikunci. PDF sedang digenerate.');
    },
    onError: () => Alert.alert('Gagal', 'Tanda tangan klien gagal disimpan'),
  });

  const downloadPdf = async () => {
    if (!report?.is_locked) return;
    try {
      setDownloading(true);
      const filePath = `${FileSystem.cacheDirectory}${report.report_number ?? id}.pdf`;

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
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  const canSignTech = !report.tech_signature_url && !report.is_locked;
  const canSignClient = !!report.tech_signature_url && !report.client_signature_url && !report.is_locked;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {report.report_number ?? 'Berita Acara'}
          </Text>
          {report.is_locked && (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedText}>🔒 Final</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <SectionTitle title="Informasi Kunjungan" />
          <InfoRow label="Klien" value={report.client?.name ?? '—'} />
          <InfoRow label="PIC Klien" value={report.client_pic_name ?? '—'} />
          <InfoRow
            label="Check-in"
            value={report.visit?.check_in_at ? fmtDt(report.visit.check_in_at) : '—'}
          />
          <InfoRow
            label="Check-out"
            value={report.visit?.check_out_at ? fmtDt(report.visit.check_out_at) : '—'}
          />
          {report.visit?.duration_minutes != null && (
            <InfoRow
              label="Durasi"
              value={`${Math.floor(report.visit.duration_minutes / 60)} jam ${report.visit.duration_minutes % 60} menit`}
            />
          )}
        </View>

        {/* Pekerjaan */}
        {report.visit?.work_description && (
          <View style={styles.card}>
            <SectionTitle title="Deskripsi Pekerjaan" />
            <Text style={styles.descText}>{report.visit.work_description}</Text>
          </View>
        )}

        {report.visit?.findings && (
          <View style={styles.card}>
            <SectionTitle title="Temuan" />
            <Text style={styles.descText}>{report.visit.findings}</Text>
          </View>
        )}

        {report.visit?.recommendations && (
          <View style={styles.card}>
            <SectionTitle title="Rekomendasi" />
            <Text style={styles.descText}>{report.visit.recommendations}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.card}>
          <SectionTitle title="Tanda Tangan" />
          <View style={styles.sigGrid}>
            <SignatureBlock
              label="Teknisi"
              url={report.tech_signature_url}
              onSign={canSignTech ? () => setSignStep('tech') : undefined}
            />
            <SignatureBlock
              label={`Klien\n${report.client_pic_name ?? ''}`}
              url={report.client_signature_url}
              onSign={canSignClient ? () => setSignStep('client_name') : undefined}
            />
          </View>
        </View>

        {/* PDF */}
        {report.is_locked && (
          <TouchableOpacity
            style={[styles.pdfBtn, downloading && { opacity: 0.7 }]}
            onPress={downloadPdf}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.pdfBtnText}>↓ Download PDF Berita Acara</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Signature Modal — Teknisi */}
      <Modal visible={signStep === 'tech'} animationType="slide">
        <SignaturePad
          title="Tanda Tangan Teknisi"
          onSave={(base64) => techSignMut.mutate(base64)}
          onCancel={() => setSignStep('none')}
        />
      </Modal>

      {/* Client name input before signature */}
      <Modal visible={signStep === 'client_name'} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.nameModal}>
            <Text style={styles.nameModalTitle}>Nama PIC Klien</Text>
            <TextInput
              value={clientPicName}
              onChangeText={setClientPicName}
              placeholder="Masukkan nama perwakilan klien"
              style={styles.nameInput}
              autoFocus
            />
            <View style={styles.nameActions}>
              <TouchableOpacity style={styles.nameCancelBtn} onPress={() => setSignStep('none')}>
                <Text style={styles.nameCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nameOkBtn, !clientPicName.trim() && { opacity: 0.5 }]}
                disabled={!clientPicName.trim()}
                onPress={() => setSignStep('client_sign')}
              >
                <Text style={styles.nameOkText}>Lanjut →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Client Signature Pad */}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SignatureBlock({
  label,
  url,
  onSign,
}: {
  label: string;
  url: string | null;
  onSign?: () => void;
}) {
  return (
    <View style={styles.sigBlock}>
      <Text style={styles.sigBlockLabel}>{label}</Text>
      {url ? (
        <Image source={{ uri: url }} style={styles.sigImage} resizeMode="contain" />
      ) : (
        <View style={styles.sigEmpty}>
          {onSign ? (
            <TouchableOpacity style={styles.signBtn} onPress={onSign}>
              <Text style={styles.signBtnText}>✍ Tanda Tangan</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sigPending}>Menunggu…</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  header: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 14, color: C.blue },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  lockedBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: C.green + '26', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill,
  },
  lockedText: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.blue,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  infoLabel: { width: 90, fontSize: 13, color: '#9ca3af' },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1f2937' },
  descText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  sigGrid: { flexDirection: 'row', gap: 12 },
  sigBlock: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  sigBlockLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textAlign: 'center', marginBottom: 8 },
  sigImage: { width: '100%', height: 80 },
  sigEmpty: { width: '100%', height: 80, justifyContent: 'center', alignItems: 'center' },
  signBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#eff6ff', borderRadius: 10, borderWidth: 1.5, borderColor: '#bfdbfe',
  },
  signBtnText: { fontSize: 13, fontWeight: '700', color: C.blue },
  sigPending: { fontSize: 12, color: '#d1d5db' },
  pdfBtn: {
    backgroundColor: C.green, borderRadius: 16, padding: 16, alignItems: 'center',
    marginTop: 8,
  },
  pdfBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  nameModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  nameModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  nameInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#111827',
  },
  nameActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  nameCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center',
  },
  nameCancelText: { fontSize: 15, fontWeight: '600', color: '#4b5563' },
  nameOkBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.blue, alignItems: 'center',
  },
  nameOkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
