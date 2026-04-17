import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, Alert, useColorScheme,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getMyServiceReports,
  createServiceReport,
  ServiceReport,
} from '@/services/service-reports.service';
import { pageBg, cardBg, lPrimary, lSecondary, C } from '@/constants/tokens';
import { BackHeader } from '@/components/ui/BackHeader';
import { fmtDateShortWIT as fmtDate, currentMonth } from '@/utils/dateFormatter';

function StatusChip({ report, isDark }: { report: ServiceReport; isDark: boolean }) {
  if (report.is_locked) {
    return (
      <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#d1fae5' }]}>
        <Text style={[styles.chipText, { color: isDark ? '#34D399' : '#065f46' }]}>✓ Final</Text>
      </View>
    );
  }
  if (report.tech_signature_url && !report.client_signature_url) {
    return (
      <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7' }]}>
        <Text style={[styles.chipText, { color: isDark ? '#FBBF24' : '#92400e' }]}>⏳ TTD Klien</Text>
      </View>
    );
  }
  return (
    <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : '#f3f4f6' }]}>
      <Text style={[styles.chipText, { color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }]}>Draft</Text>
    </View>
  );
}

export default function ServiceReportsListScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { visit_id } = useLocalSearchParams<{ visit_id?: string }>();
  const [month] = useState(currentMonth());

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['my-service-reports', month],
    queryFn: () => getMyServiceReports(month),
  });

  // If arriving from visit detail, auto-create BA and redirect
  const createMut = useMutation({
    mutationFn: () => createServiceReport(visit_id!),
    onSuccess: (report) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/service-reports/${report.id}`);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Info', err?.response?.data?.message ?? 'Gagal membuat Berita Acara');
    },
  });

  // L2: destructure mutate agar dep array tidak perlu eslint-disable
  const { mutate: triggerCreate } = createMut;
  React.useEffect(() => {
    if (visit_id) triggerCreate();
  }, [visit_id, triggerCreate]);

  return (
    <View style={[styles.container, { backgroundColor: pageBg(isDark) }]}>
      <BackHeader title="Berita Acara" subtitle="Dokumen kunjungan teknis Anda" accentColor={C.blue} onBack={() => router.navigate('/(main)/profile')} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {reports.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyText, { color: lSecondary(isDark) }]}>Belum ada Berita Acara bulan ini</Text>
          </View>
        )}

        {reports.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.card, {
              backgroundColor: cardBg(isDark),
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderWidth: 1,
            }]}
            onPress={() => router.push(`/service-reports/${r.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              {r.report_number ? (
                <Text style={styles.baNumber}>{r.report_number}</Text>
              ) : (
                <Text style={[styles.baDraft, { color: lSecondary(isDark) }]}>Nomor BA belum digenerate</Text>
              )}
              <StatusChip report={r} isDark={isDark} />
            </View>

            <Text style={[styles.clientName, { color: lPrimary(isDark) }]}>{r.client?.name ?? '—'}</Text>

            <View style={styles.cardFooter}>
              <Text style={[styles.dateText, { color: lSecondary(isDark) }]}>
                📅 {r.visit?.check_in_at ? fmtDate(r.visit.check_in_at) : '—'}
              </Text>
              {r.is_locked && r.pdf_url && (
                <Text style={styles.pdfReady}>📄 PDF Tersedia</Text>
              )}
            </View>

            {/* Signature progress */}
            <View style={styles.sigRow}>
              <SigDot label="Teknisi" done={!!r.tech_signature_url} />
              <View style={[styles.sigLine, r.tech_signature_url ? styles.sigLineDone : null]} />
              <SigDot label="Klien" done={!!r.client_signature_url} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function SigDot({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.sigDotWrap}>
      <View style={[styles.sigDot, done ? styles.sigDotDone : styles.sigDotPending]} />
      <Text style={styles.sigLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  baNumber: { fontSize: 13, fontWeight: '700', color: '#1d4ed8', fontFamily: 'monospace' },
  baDraft: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  clientName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 12, color: '#6b7280' },
  pdfReady: { fontSize: 12, color: '#059669', fontWeight: '600' },
  sigRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sigDotWrap: { alignItems: 'center', gap: 4 },
  sigDot: { width: 12, height: 12, borderRadius: 6 },
  sigDotDone: { backgroundColor: '#10b981' },
  sigDotPending: { backgroundColor: '#d1d5db', borderWidth: 1.5, borderColor: '#9ca3af' },
  sigLabel: { fontSize: 10, color: '#6b7280' },
  sigLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb', marginBottom: 12 },
  sigLineDone: { backgroundColor: '#10b981' },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 11, fontWeight: '700' },
});
