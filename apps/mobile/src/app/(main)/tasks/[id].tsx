/**
 * M-04b — Detail Tugas
 * Info lengkap tugas: status, klien, deadline konfirmasi, aksi Terima/Tolak/Tunda/Limpahkan
 */
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, StatusBar, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, type TaskSummary } from '@/services/tasks.service';
import { ConfirmCountdown } from '@/components/tasks/ConfirmCountdown';
import NavigationButton from '@/components/tasks/NavigationButton';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<string, { label: string; color: string; bg: string; bgDark: string; icon: string }> = {
  low:    { label: 'Rendah',    color: '#6B7280', bg: '#F9FAFB', bgDark: 'rgba(107,114,128,0.15)', icon: 'arrow-down-circle' },
  normal: { label: 'Normal',   color: '#2563EB', bg: '#EFF6FF', bgDark: 'rgba(37,99,235,0.15)',   icon: 'remove-circle' },
  high:   { label: 'Penting',  color: '#EA580C', bg: '#FFF7ED', bgDark: 'rgba(234,88,12,0.15)',   icon: 'arrow-up-circle' },
  urgent: { label: 'Mendadak', color: '#EF4444', bg: '#FEF2F2', bgDark: 'rgba(239,68,68,0.15)',   icon: 'flash' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
  pending_confirmation: { label: 'Menunggu Konfirmasi', color: '#F59E0B', bg: '#FFFBEB', bgDark: 'rgba(245,158,11,0.15)' },
  assigned:   { label: 'Ditugaskan',    color: '#2563EB', bg: '#EFF6FF', bgDark: 'rgba(37,99,235,0.15)' },
  on_hold:    { label: 'Ditunda',       color: '#EA580C', bg: '#FFF7ED', bgDark: 'rgba(234,88,12,0.15)' },
  rescheduled:{ label: 'Dijadwal Ulang',color: '#7C3AED', bg: '#F5F3FF', bgDark: 'rgba(124,58,237,0.15)' },
  completed:  { label: 'Selesai',       color: '#16A34A', bg: '#DCFCE7', bgDark: 'rgba(22,163,74,0.15)' },
  unassigned: { label: 'Belum Ditugaskan', color: '#6B7280', bg: '#F9FAFB', bgDark: 'rgba(107,114,128,0.15)' },
};

const HOLD_REASON_LABELS: Record<string, string> = {
  client_absent:        'Klien/PIC tidak ada di lokasi',
  access_denied:        'Tidak bisa masuk gedung/area',
  equipment_broken:     'Peralatan rusak di lokasi',
  material_unavailable: 'Spare part/material belum tersedia',
  client_cancel:        'Klien batalkan sepihak',
  weather:              'Cuaca ekstrem',
  technician_sick:      'Teknisi sakit mendadak',
  other:                'Alasan lain',
};

const HOLD_REASONS = Object.entries(HOLD_REASON_LABELS).map(([value, label]) => ({ value, label }));

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [holdReasonType, setHoldReasonType] = useState('client_absent');
  const [holdNotes, setHoldNotes] = useState('');
  const [delegateToUserId, setDelegateToUserId] = useState('');
  const [delegateReason, setDelegateReason] = useState('');

  const bg = isDark ? '#0A0A0F' : '#F0F4FF';
  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#64748B';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.14)' : '#E2E8F0';

  const { data: task, isLoading, refetch } = useQuery({
    queryKey: ['task-detail', id],
    queryFn: () => tasksService.getDetail(id!),
    enabled: !!id,
  });

  const { data: holds = [] } = useQuery({
    queryKey: ['task-holds', id],
    queryFn: () => tasksService.getHolds(id!),
    enabled: !!id && (task?.status === 'on_hold' || task?.status === 'assigned'),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['task-detail', id] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  }, [qc, id]);

  const acceptMut = useMutation({
    mutationFn: () => tasksService.accept(id!),
    onSuccess: () => { invalidate(); Alert.alert('Berhasil', 'Tugas berhasil diterima.'); },
    onError: (err: Error) => Alert.alert('Gagal', err.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => tasksService.reject(id!, rejectReason || undefined),
    onSuccess: () => { invalidate(); setShowRejectModal(false); setRejectReason(''); router.back(); },
    onError: (err: Error) => Alert.alert('Gagal', err.message),
  });

  const holdMut = useMutation({
    mutationFn: () => tasksService.holdTask(id!, {
      reason_type: holdReasonType,
      reason_notes: holdNotes.trim(),
      evidence_urls: [],
    }),
    onSuccess: () => {
      invalidate();
      setShowHoldModal(false);
      setHoldNotes('');
      Alert.alert('Penundaan Diajukan', 'Permintaan penundaan telah dikirim ke manajer.');
    },
    onError: (err: Error) => Alert.alert('Gagal', err.message),
  });

  const delegateMut = useMutation({
    mutationFn: () => tasksService.delegate(id!, {
      to_user_id: delegateToUserId.trim(),
      reason: delegateReason.trim(),
    }),
    onSuccess: () => {
      invalidate();
      setShowDelegateModal(false);
      Alert.alert('Delegasi Dikirim', 'Permintaan delegasi telah dikirim ke manajer untuk disetujui.');
    },
    onError: (err: Error) => Alert.alert('Gagal', err.message),
  });

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading || !task) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        {isDark && (
          <LinearGradient colors={['#0D1428', '#0A1F0A', '#0A0A0F']} style={{ position: 'absolute', inset: 0 }} />
        )}
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  const pm = PRIORITY_META[task.priority] ?? PRIORITY_META.normal;
  const sm = STATUS_META[task.status] ?? STATUS_META.unassigned;
  const isPending = task.status === 'pending_confirmation';
  const isAssigned = task.status === 'assigned';
  const isOnHold = task.status === 'on_hold';
  const isCompleted = task.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {isDark && (
        <LinearGradient
          colors={['#0D1428', '#0A1F0A', '#0A0A0F']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>

        {/* ── Back bar ──────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}
          >
            <Ionicons name="chevron-back" size={18} color="#16A34A" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#16A34A' }}>Tugas</Text>
          </TouchableOpacity>
        </View>

        {/* ── Header card ───────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 24, borderWidth: 1.5, borderColor: cardBorder, padding: 20 }}>
            {/* Emergency banner */}
            {task.is_emergency && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', borderRadius: 12, padding: 10, marginBottom: 14 }}>
                <Ionicons name="warning" size={16} color="#EF4444" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', flex: 1 }}>Tugas Darurat — Segera Ditangani</Text>
              </View>
            )}

            {/* Priority + Status badges */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? pm.bgDark : pm.bg }}>
                <Ionicons name={pm.icon as any} size={13} color={pm.color} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: pm.color }}>{pm.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? sm.bgDark : sm.bg }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: sm.color }}>{sm.label}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary, letterSpacing: -0.5, lineHeight: 30, marginBottom: 8 }}>
              {task.title}
            </Text>

            {/* Type */}
            {task.type && (
              <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 4 }}>
                Tipe: {task.type}
              </Text>
            )}

            {/* Scheduled */}
            {task.scheduled_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="calendar-outline" size={14} color={textSecondary as string} />
                <Text style={{ fontSize: 14, color: textSecondary }}>
                  {new Date(task.scheduled_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Makassar',
                    weekday: 'short', day: '2-digit', month: 'long',
                    hour: '2-digit', minute: '2-digit',
                  })} WITA
                </Text>
              </View>
            )}

            {/* Created */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Ionicons name="time-outline" size={14} color={textSecondary as string} />
              <Text style={{ fontSize: 13, color: textSecondary }}>
                Dibuat {new Date(task.created_at).toLocaleDateString('id-ID', {
                  timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Confirm countdown ──────────────────────── */}
        {isPending && task.confirm_deadline && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <ConfirmCountdown
              deadline={task.confirm_deadline}
              priority={task.priority as 'normal' | 'high' | 'urgent'}
            />
          </View>
        )}

        {/* ── Description ───────────────────────────── */}
        {task.description && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text" size={16} color="#2563EB" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deskripsi</Text>
              </View>
              <Text style={{ fontSize: 15, color: textPrimary, lineHeight: 22 }}>{task.description}</Text>
            </View>
          </View>
        )}

        {/* ── Client info ───────────────────────────── */}
        {task.client && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(234,88,12,0.2)' : '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={16} color="#EA580C" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Klien</Text>
              </View>

              <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary, marginBottom: 4 }}>
                {task.client.name}
              </Text>
              {task.client.address && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                  <Ionicons name="location-outline" size={14} color={textSecondary as string} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 14, color: textSecondary, flex: 1, lineHeight: 20 }}>{task.client.address}</Text>
                </View>
              )}

              {/* Navigation button */}
              {task.client.lat && task.client.lng && (
                <View style={{ marginTop: 14 }}>
                  <NavigationButton
                    lat={Number(task.client.lat)}
                    lng={Number(task.client.lng)}
                    label={`Navigasi ke ${task.client.name}`}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Escalation info ───────────────────────── */}
        {task.escalated_from && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="arrow-up-circle" size={18} color="#F59E0B" />
              <Text style={{ fontSize: 14, color: '#F59E0B', fontWeight: '600', flex: 1 }}>
                Dieskalasi dari {task.escalated_from}
                {task.escalated_at && ` · ${new Date(task.escalated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`}
              </Text>
            </View>
          </View>
        )}

        {/* ── Hold history ──────────────────────────── */}
        {holds.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, borderWidth: 1.5, borderColor: cardBorder, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pause-circle" size={16} color="#F59E0B" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Riwayat Penundaan</Text>
              </View>
              {holds.map((h, i) => {
                const statusColor = h.review_status === 'approved' ? '#16A34A' : h.review_status === 'rejected' ? '#EF4444' : '#F59E0B';
                return (
                  <View key={h.id} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary, flex: 1 }}>
                        {HOLD_REASON_LABELS[h.reason_type] ?? h.reason_type}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${statusColor}20` }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor, textTransform: 'capitalize' }}>
                          {h.is_auto_approved ? 'Auto Approved' : h.review_status}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 4, lineHeight: 18 }}>{h.reason_notes}</Text>
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8' }}>
                      {new Date(h.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                      {h.reschedule_date ? ` → Dijadwal ulang ke ${h.reschedule_date}` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Action buttons ────────────────────────── */}
        {isPending && (
          <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => Alert.alert('Terima Tugas?', `Anda akan menerima tugas "${task.title}".`, [
                { text: 'Batal', style: 'cancel' },
                { text: 'Terima', onPress: () => acceptMut.mutate() },
              ])}
              disabled={acceptMut.isPending}
              style={{ backgroundColor: '#16A34A', borderRadius: 18, paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}
            >
              {acceptMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Terima Tugas</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowRejectModal(true)}
              style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderRadius: 18, paddingVertical: 17, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.35)' }}
            >
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 16 }}>Tolak Tugas</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAssigned && (
          <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => setShowHoldModal(true)}
              style={{ backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.35)' }}
            >
              <Ionicons name="pause-circle" size={20} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 16 }}>Tunda Pekerjaan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDelegateModal(true)}
              style={{ backgroundColor: isDark ? 'rgba(124,58,237,0.12)' : '#F5F3FF', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.35)' }}
            >
              <Ionicons name="arrow-redo-circle" size={20} color="#7C3AED" />
              <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 16 }}>Limpahkan Tugas</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.1)' : '#DCFCE7', borderRadius: 18, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(22,163,74,0.3)' }}>
              <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
              <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 16 }}>Tugas Selesai</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 6 }}>Tolak Tugas</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Sampaikan alasan penolakan kepada manajer.</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Alasan penolakan (opsional)..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              multiline numberOfLines={3} textAlignVertical="top"
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginBottom: 18 }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowRejectModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => rejectMut.mutate()}
                disabled={rejectMut.isPending}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center' }}
              >
                {rejectMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Tolak Tugas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Hold Modal ────────────────────────────────────────────────────── */}
      <Modal visible={showHoldModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24, maxHeight: '82%' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 4 }}>Tunda Pekerjaan</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Pilih alasan. Manajer akan dinotifikasi segera.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {HOLD_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setHoldReasonType(r.value)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9' }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: holdReasonType === r.value ? '#F59E0B' : isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB', backgroundColor: holdReasonType === r.value ? '#F59E0B' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {holdReasonType === r.value && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' }} />}
                  </View>
                  <Text style={{ fontSize: 15, color: textPrimary, flex: 1 }}>{r.label}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                value={holdNotes}
                onChangeText={setHoldNotes}
                placeholder="Keterangan detail (wajib)..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
                multiline numberOfLines={3} textAlignVertical="top"
                style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginTop: 16, marginBottom: 16 }}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => setShowHoldModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!holdNotes.trim()) { Alert.alert('Keterangan Wajib', 'Isi keterangan detail sebelum submit.'); return; }
                    holdMut.mutate();
                  }}
                  disabled={holdMut.isPending || !holdNotes.trim()}
                  style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: holdNotes.trim() ? '#F59E0B' : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
                >
                  {holdMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: holdNotes.trim() ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Ajukan Tunda</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Delegate Modal ────────────────────────────────────────────────── */}
      <Modal visible={showDelegateModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, marginBottom: 4 }}>Limpahkan Tugas</Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginBottom: 18 }}>Manajer akan menyetujui permintaan ini.</Text>

            <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>ID Karyawan Penerima</Text>
            <TextInput
              value={delegateToUserId}
              onChangeText={setDelegateToUserId}
              placeholder="UUID karyawan tujuan..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Alasan Pendelegasian *</Text>
            <TextInput
              value={delegateReason}
              onChangeText={setDelegateReason}
              placeholder="Jelaskan alasan melimpahkan tugas ini..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#CBD5E1'}
              multiline numberOfLines={3} textAlignVertical="top"
              style={{ backgroundColor: inputBg, borderRadius: 16, borderWidth: 1.5, borderColor: inputBorder, padding: 14, fontSize: 15, color: textPrimary, minHeight: 90, marginBottom: 18 }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowDelegateModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!delegateToUserId.trim() || !delegateReason.trim()) {
                    Alert.alert('Lengkapi Data', 'ID penerima dan alasan wajib diisi.');
                    return;
                  }
                  delegateMut.mutate();
                }}
                disabled={delegateMut.isPending || !delegateToUserId.trim() || !delegateReason.trim()}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: (delegateToUserId.trim() && delegateReason.trim()) ? '#7C3AED' : isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', alignItems: 'center' }}
              >
                {delegateMut.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={{ color: (delegateToUserId.trim() && delegateReason.trim()) ? '#FFF' : (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF'), fontWeight: '700', fontSize: 15 }}>Limpahkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
