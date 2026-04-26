/**
 * M-04/05 — Pekerjaan (Unified Work Hub)
 * TEKNISI: feed semua tugas + active visit card + filter chips
 * MANAGER/ADMIN: Dispatch Saya | Perlu Ditinjau segmented tabs
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  PauseCircle,
  Play,
  AlertCircle,
  ClipboardList,
  Navigation,
  Plus,
  User,
  Search,
  X,
  Briefcase,
  FileText,
} from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { tasksService, type TaskSummary } from '@/services/tasks.service';
import { visitsService, type VisitSummary } from '@/services/visits.service';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { C, R, B, S, cardBg, pageBg, lPrimary, lSecondary, lTertiary, gradients } from '@/constants/tokens';
import { TaskCardSkeleton } from '@/components/ui/SkeletonLoader';
import { Toast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { useToast } from '@/hooks/useToast';
import { useTabBar } from '@/context/TabBarContext';
import { fmtDateShortWIT } from '@/utils/dateFormatter';

import DateTimePicker from '@react-native-community/datetimepicker';

type Priority    = 'low' | 'normal' | 'high' | 'urgent';
type TaskType    = 'visit' | 'maintenance' | 'inspection' | 'other';
type PickerMode  = 'employee' | 'client' | 'department' | 'template' | null;
type AdminVisit  = VisitSummary & { user?: { id: string; full_name: string } };

interface EmployeeItem   { id: string; full_name: string; employee_id?: string }
interface ClientItem     { id: string; name: string; address?: string }
interface DepartmentItem { id: string; name: string }
interface TemplateItem   { id: string; name: string; work_type?: string }

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Rendah',   color: C.green  },
  { value: 'normal', label: 'Normal',   color: C.blue   },
  { value: 'high',   label: 'Tinggi',   color: C.orange },
  { value: 'urgent', label: 'Mendesak', color: C.red    },
] as const;

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'visit',       label: 'Kunjungan'  },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection',  label: 'Inspeksi'   },
  { value: 'other',       label: 'Lainnya'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status meta + filter constants
// ─────────────────────────────────────────────────────────────────────────────

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  unassigned:           { label: 'Belum Ditugaskan', color: C.teal   },
  pending_confirmation: { label: 'Perlu Konfirmasi', color: C.red    },
  assigned:             { label: 'Siap Dikerjakan',  color: C.orange },
  in_progress:          { label: 'Berlangsung',      color: C.blue   },
  on_hold:              { label: 'Ditunda',          color: C.orange },
  rescheduled:          { label: 'Dijadwal Ulang',   color: C.purple },
  completed:            { label: 'Selesai',          color: C.green  },
  cancelled:            { label: 'Dibatalkan',       color: C.red    },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: 'Rendah',   color: C.green  },
  normal: { label: 'Normal',   color: C.blue   },
  high:   { label: 'Tinggi',   color: C.orange },
  urgent: { label: 'Mendesak', color: C.red    },
};

const TEKNISI_FILTER_CHIPS: { label: string; value: string | undefined }[] = [
  { label: 'Semua',       value: undefined     },
  { label: 'Aktif',       value: 'active'      },
  { label: 'Berlangsung', value: 'in_progress' },
  { label: 'Ditunda',     value: 'on_hold'     },
  { label: 'Selesai',     value: 'done'        },
];

const MANAGER_FILTER_CHIPS: { label: string; value: string | undefined }[] = [
  { label: 'Semua',       value: undefined     },
  { label: 'Aktif',       value: 'active'      },
  { label: 'Berlangsung', value: 'in_progress' },
  { label: 'On Hold',     value: 'on_hold'     },
  { label: 'Selesai',     value: 'done'        },
];

function applyTaskFilter(tasks: TaskSummary[], filter: string | undefined): TaskSummary[] {
  switch (filter) {
    case 'active':      return tasks.filter((t) => ['pending_confirmation', 'assigned'].includes(t.status));
    case 'in_progress': return tasks.filter((t) => t.status === 'in_progress');
    case 'on_hold':     return tasks.filter((t) => t.status === 'on_hold');
    case 'done':        return tasks.filter((t) => ['completed', 'cancelled', 'rescheduled'].includes(t.status));
    default:            return tasks;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useElapsedTimer(startIso: string | null) {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!startIso) return;
    const tick = () => {
      const diff = Date.now() - new Date(startIso).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return elapsed;
}

function distanceLabel(lat?: number, lng?: number, userLat?: number, userLng?: number) {
  if (!lat || !lng || !userLat || !userLng) return null;
  const R_earth = 6371000;
  const dLat = ((lat - userLat) * Math.PI) / 180;
  const dLng = ((lng - userLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const d = R_earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Visit Card
// ─────────────────────────────────────────────────────────────────────────────

function ActiveVisitCard({ visit, onPress }: { visit: VisitSummary; onPress: () => void }) {
  const elapsed = useElapsedTimer(visit.check_in_at);
  const isDark = useColorScheme() === 'dark';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ marginHorizontal: 16, marginBottom: 10 }}>
      <LinearGradient
        colors={isDark ? gradients.heroWorkDark : gradients.heroWorkLight}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: R.xl, padding: 20, overflow: 'hidden' }}
      >
        <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.04)' }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.green, letterSpacing: 1, textTransform: 'uppercase' }}>
            Kunjungan Berlangsung
          </Text>
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 4 }} numberOfLines={1}>
          {visit.client?.name ?? '—'}
        </Text>
        {visit.client?.pic_name && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>
            PIC: {visit.client.pic_name}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={15} strokeWidth={2} color="rgba(255,255,255,0.55)" />
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
              {elapsed}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Buka Detail</Text>
            <ChevronRight size={14} strokeWidth={2.5} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Work Card (teknisi — active tasks with action buttons)
// ─────────────────────────────────────────────────────────────────────────────

function TaskWorkCard({
  task, isDark, onAccept, onDetail, onCheckin, userLat, userLng,
}: {
  task: TaskSummary;
  isDark: boolean;
  onAccept?: () => void;
  onDetail: () => void;
  onCheckin?: () => void;
  userLat?: number;
  userLng?: number;
}) {
  const isPending = task.status === 'pending_confirmation';
  const isAssigned = task.status === 'assigned';
  const isOnHold   = task.status === 'on_hold';

  const distLabel = distanceLabel(
    task.client?.lat ?? undefined,
    task.client?.lng ?? undefined,
    userLat, userLng,
  );

  const deadlineStr = task.confirm_deadline
    ? new Date(task.confirm_deadline).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
      })
    : null;

  return (
    <TouchableOpacity
      onPress={onDetail}
      activeOpacity={0.82}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        overflow: 'hidden',
        ...(isDark ? S.cardDark : S.card),
        opacity: isOnHold ? 0.65 : 1,
      }}
    >
      {task.is_emergency && (
        <View style={{ height: 3, backgroundColor: C.red }} />
      )}

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          {task.is_emergency && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.red + '18', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 3 }}>
              <Zap size={10} strokeWidth={2.5} color={C.red} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.red, letterSpacing: 0.5 }}>DARURAT</Text>
            </View>
          )}
          {task.priority === 'high' && !task.is_emergency && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange, marginTop: 5 }} />
          )}
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }} numberOfLines={2}>
            {task.title}
          </Text>
        </View>

        {task.client && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MapPin size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark), flex: 1 }} numberOfLines={1}>
              {task.client.name}
              {task.client.address ? ` · ${task.client.address}` : ''}
            </Text>
            {distLabel && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.blue + '12', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Navigation size={10} strokeWidth={2} color={C.blue} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.blue }}>{distLabel}</Text>
              </View>
            )}
          </View>
        )}

        {isPending && deadlineStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <AlertCircle size={12} strokeWidth={2} color={C.orange} />
            <Text style={{ fontSize: 12, color: C.orange, fontWeight: '600' }}>
              Konfirmasi sebelum {deadlineStr} WITA
            </Text>
          </View>
        )}

        {task.scheduled_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 12, color: lSecondary(isDark) }}>
              {new Date(task.scheduled_at).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
              })} WITA
            </Text>
          </View>
        )}

        {isPending && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={onAccept}
              style={{
                flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: C.green, borderRadius: R.sm, paddingVertical: 11,
              }}
            >
              <CheckCircle2 size={15} strokeWidth={2.2} color="#FFF" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Terima</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDetail}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                borderRadius: R.sm, paddingVertical: 11,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: lSecondary(isDark) }}>Detail</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAssigned && (
          <TouchableOpacity
            onPress={onCheckin ?? onDetail}
            style={{
              marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: C.orange + '18',
              borderRadius: R.sm, paddingVertical: 12,
              borderWidth: B.default, borderColor: C.orange + '35',
            }}
          >
            <Play size={15} strokeWidth={2.2} color={C.orange} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.orange }}>Check-in Sekarang</Text>
          </TouchableOpacity>
        )}

        {isOnHold && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <PauseCircle size={14} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lTertiary(isDark) }}>Menunggu persetujuan penundaan</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Task Card (teknisi — riwayat tugas selesai/dibatalkan)
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTaskCard({
  task, isDark, onPress,
}: {
  task: TaskSummary;
  isDark: boolean;
  onPress: () => void;
}) {
  const meta = TASK_STATUS_META[task.status] ?? TASK_STATUS_META.assigned;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: lPrimary(isDark) }} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={{ backgroundColor: meta.color + '18', borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
          </View>
        </View>

        {task.client && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MapPin size={11} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }} numberOfLines={1}>{task.client.name}</Text>
          </View>
        )}

        {(task.scheduled_at || task.created_at) && (
          <Text style={{ fontSize: 12, color: lTertiary(isDark), marginTop: 4 }}>
            {fmtDateShortWIT(task.scheduled_at ?? task.created_at)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager Task Card (dispatch view)
// ─────────────────────────────────────────────────────────────────────────────

function ManagerTaskCard({
  task, isDark, onPress,
}: {
  task: TaskSummary;
  isDark: boolean;
  onPress: () => void;
}) {
  const statusMeta   = TASK_STATUS_META[task.status]   ?? TASK_STATUS_META.assigned;
  const priorityMeta = PRIORITY_META[task.priority]    ?? PRIORITY_META.normal;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        ...(isDark ? S.cardDark : S.card),
        overflow: 'hidden',
      }}
    >
      {task.is_emergency && <View style={{ height: 3, backgroundColor: C.red }} />}

      <View style={{ padding: 16 }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          {task.is_emergency && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.red + '18', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 }}>
              <Zap size={10} strokeWidth={2.5} color={C.red} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.red }}>DARURAT</Text>
            </View>
          )}
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.2 }} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={{ backgroundColor: statusMeta.color + '18', borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusMeta.color }}>{statusMeta.label}</Text>
          </View>
        </View>

        {/* Assignee */}
        {task.assignee && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <User size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>{task.assignee.full_name}</Text>
          </View>
        )}

        {/* Client */}
        {task.client && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <MapPin size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }} numberOfLines={1}>{task.client.name}</Text>
          </View>
        )}

        {/* Priority + date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ backgroundColor: priorityMeta.color + '18', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: priorityMeta.color }}>{priorityMeta.label}</Text>
          </View>
          {(task.scheduled_at || task.created_at) && (
            <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
              {fmtDateShortWIT(task.scheduled_at ?? task.created_at)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending Review Card (manager review tab)
// ─────────────────────────────────────────────────────────────────────────────

function PendingReviewCard({
  visit, isDark, onPress,
}: {
  visit: AdminVisit;
  isDark: boolean;
  onPress: () => void;
}) {
  const durationLabel = visit.duration_minutes
    ? `${Math.floor(visit.duration_minutes / 60)}j ${visit.duration_minutes % 60}m`
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: isDark ? C.separator.dark : C.separator.light,
        ...(isDark ? S.cardDark : S.card),
      }}
    >
      <View style={{ padding: 16 }}>
        {/* Client + badge */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: lPrimary(isDark) }} numberOfLines={1}>
            {visit.client?.name ?? '—'}
          </Text>
          <View style={{ backgroundColor: C.orange + '18', borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.orange }}>Perlu Ditinjau</Text>
          </View>
        </View>

        {/* Technician */}
        {visit.user && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <User size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 13, color: lSecondary(isDark) }}>{visit.user.full_name}</Text>
          </View>
        )}

        {/* Check-out + duration */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, marginBottom: 12 }}>
          {visit.check_out_at && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
              <Text style={{ fontSize: 12, color: lSecondary(isDark) }}>
                {fmtDateShortWIT(visit.check_out_at)} WITA
              </Text>
            </View>
          )}
          {durationLabel && (
            <View style={{ backgroundColor: C.blue + '12', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.blue }}>{durationLabel}</Text>
            </View>
          )}
        </View>

        {/* Action button */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            backgroundColor: C.orange + '14', borderRadius: R.sm, paddingVertical: 10,
            borderWidth: B.default, borderColor: C.orange + '35',
          }}
        >
          <CheckCircle2 size={14} strokeWidth={2} color={C.orange} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.orange }}>Tinjau Kunjungan</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager Tab Toggle
// ─────────────────────────────────────────────────────────────────────────────

function ManagerTabToggle({
  tab, onChange, isDark, pendingCount,
}: {
  tab: 'dispatch' | 'review';
  onChange: (t: 'dispatch' | 'review') => void;
  isDark: boolean;
  pendingCount: number;
}) {
  return (
    <View style={{
      flexDirection: 'row', marginHorizontal: 20, marginBottom: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      borderRadius: R.md, padding: 3,
    }}>
      {(['dispatch', 'review'] as const).map((t) => {
        const active = tab === t;
        const label  = t === 'dispatch' ? 'Dispatch Saya' : 'Perlu Ditinjau';
        return (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(t)}
            activeOpacity={0.75}
            style={{
              flex: 1, paddingVertical: 9, borderRadius: R.sm - 2,
              backgroundColor: active ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
              ...(active ? (isDark ? S.cardDark : S.card) : {}),
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? lPrimary(isDark) : lSecondary(isDark) }}>
              {label}
            </Text>
            {t === 'review' && pendingCount > 0 && (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFF' }}>
                  {pendingCount > 99 ? '99+' : String(pendingCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PekerjaanScreen() {
  const isDark    = useColorScheme() === 'dark';
  const router    = useRouter();
  const qc        = useQueryClient();
  const insets    = useSafeAreaInsets();
  const user      = useAuthStore((s) => s.user);
  const { onScroll } = useTabBar();
  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.role?.name ?? '');

  const [showCreate, setShowCreate]         = useState(false);
  const [managerTab, setManagerTab]         = useState<'dispatch' | 'review'>('dispatch');
  const [teknisiFilter, setTekniisiFilter]  = useState<string | undefined>(undefined);
  const [managerFilter, setManagerFilter]   = useState<string | undefined>(undefined);
  const [userLat, setUserLat]               = useState<number | undefined>();
  const [userLng, setUserLng]               = useState<number | undefined>();

  // GPS hanya dibutuhkan teknisi (distanceLabel di TaskWorkCard)
  useEffect(() => {
    if (isManager) return;
    let mounted = true;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted' && mounted) {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then((loc) => {
              if (mounted) { setUserLat(loc.coords.latitude); setUserLng(loc.coords.longitude); }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isManager]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: tasksData, isLoading: loadingTasks, isRefetching: refetchingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['my-tasks-feed'],
    queryFn:  () => tasksService.getMyTasks({ limit: 100 }),
    enabled:  !isManager,
    refetchInterval: 20_000,
  });

  const { data: visitsData, isLoading: loadingVisits, isRefetching: refetchingVisits, refetch: refetchVisits } = useQuery({
    queryKey: ['visits-ongoing'],
    queryFn:  () => visitsService.getMyVisits({ status: 'ongoing' }),
    enabled:  !isManager,
    refetchInterval: 15_000,
  });

  const { data: dispatchData, isLoading: loadingDispatch, isRefetching: refetchingDispatch, refetch: refetchDispatch } = useQuery({
    queryKey: ['manager-dispatch'],
    queryFn:  () => tasksService.getMyTasks({ created_by: 'me', limit: 100 }),
    enabled:  isManager,
    refetchInterval: 30_000,
  });

  const { data: reviewData, isLoading: loadingReview, isRefetching: refetchingReview, refetch: refetchReview } = useQuery({
    queryKey: ['visits-pending-review'],
    queryFn:  () => visitsService.getVisitsAdmin({ review_status: 'unreviewed', limit: 100 }),
    enabled:  isManager,
    refetchInterval: 30_000,
  });

  const isLoading    = isManager ? (loadingDispatch || loadingReview) : (loadingTasks || loadingVisits);
  const isRefetching = isManager ? (refetchingDispatch || refetchingReview) : (refetchingTasks || refetchingVisits);

  const onRefresh = useCallback(() => {
    if (isManager) { refetchDispatch(); refetchReview(); }
    else           { refetchTasks(); refetchVisits(); }
  }, [isManager, refetchDispatch, refetchReview, refetchTasks, refetchVisits]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (id: string) => tasksService.accept(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['my-tasks-feed'] });
      Alert.alert('Berhasil', 'Tugas diterima. Silakan lakukan check-in saat tiba di lokasi.');
    },
    onError: (err: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Gagal', err.message);
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Teknisi
  const allTasks        = tasksData?.items ?? [];
  const activeVisit     = (visitsData?.items ?? []).find((v) => v.status === 'ongoing') ?? null;
  const activeVisitTaskId = activeVisit?.task_id ?? null;
  const visibleTasks    = activeVisitTaskId ? allTasks.filter((t) => t.id !== activeVisitTaskId) : allTasks;
  const filteredTasks   = applyTaskFilter(visibleTasks, teknisiFilter);

  // Manager
  const allDispatch        = dispatchData?.items ?? [];
  const filteredDispatch   = applyTaskFilter(allDispatch, managerFilter);
  const reviewItems        = (reviewData?.items ?? []) as AdminVisit[];
  const pendingReviewCount = reviewData?.total ?? reviewItems.length;

  // Navigation
  const goToTask  = (id: string) => router.push(`/(main)/tasks/${id}` as never);
  const goToVisit = (id: string) => router.push(`/(main)/visits/${id}` as never);

  const handleAccept = (task: TaskSummary) => {
    Alert.alert('Terima Tugas?', `Anda akan menerima tugas "${task.title}".`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Terima', onPress: () => acceptMutation.mutate(task.id) },
    ]);
  };

  const subtitleText = isLoading
    ? 'Memuat…'
    : isManager
    ? `${dispatchData?.total ?? 0} dispatch · ${pendingReviewCount} perlu ditinjau`
    : `${allTasks.length} total tugas`;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.orange} />
        }
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 30, fontWeight: '800', color: lPrimary(isDark), letterSpacing: -0.8 }}>
                Pekerjaan
              </Text>
              <Text style={{ fontSize: 14, color: lSecondary(isDark), marginTop: 3 }}>
                {subtitleText}
              </Text>
            </View>
            {isManager && (
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                activeOpacity={0.8}
                style={{
                  width: 48, height: 48, borderRadius: R.md,
                  backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF7ED',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.orange, shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
                }}
                accessibilityLabel="Buat tugas baru"
              >
                <Plus size={24} strokeWidth={2.5} color={C.orange} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[0, 1, 2, 3].map((i) => <TaskCardSkeleton key={i} isDark={isDark} />)}
          </View>
        ) : isManager ? (
          /* ── MANAGER VIEW ─────────────────────────────────────────────── */
          <>
            <ManagerTabToggle
              tab={managerTab}
              onChange={setManagerTab}
              isDark={isDark}
              pendingCount={pendingReviewCount}
            />

            {managerTab === 'dispatch' ? (
              <>
                <FilterChips
                  options={MANAGER_FILTER_CHIPS}
                  value={managerFilter}
                  onChange={setManagerFilter}
                  accentColor={C.orange}
                  isDark={isDark}
                />
                {filteredDispatch.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    iconColor={C.orange}
                    title={managerFilter ? 'Tidak ada tugas' : 'Belum ada tugas dispatch'}
                    message={
                      managerFilter
                        ? 'Tidak ada tugas dengan filter ini.'
                        : 'Buat tugas baru untuk mulai mendistribusikan pekerjaan.'
                    }
                  />
                ) : (
                  filteredDispatch.map((task) => (
                    <ManagerTaskCard
                      key={task.id}
                      task={task}
                      isDark={isDark}
                      onPress={() => goToTask(task.id)}
                    />
                  ))
                )}
              </>
            ) : (
              <>
                {reviewItems.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    iconColor={C.green}
                    title="Semua kunjungan sudah ditinjau"
                    message="Tidak ada kunjungan yang menunggu tinjauan."
                  />
                ) : (
                  reviewItems.map((visit) => (
                    <PendingReviewCard
                      key={visit.id}
                      visit={visit}
                      isDark={isDark}
                      onPress={() => goToVisit(visit.id)}
                    />
                  ))
                )}
              </>
            )}
          </>
        ) : (
          /* ── TEKNISI VIEW ─────────────────────────────────────────────── */
          <>
            {activeVisit && (
              <ActiveVisitCard
                visit={activeVisit}
                onPress={() => goToVisit(activeVisit.id)}
              />
            )}

            <FilterChips
              options={TEKNISI_FILTER_CHIPS}
              value={teknisiFilter}
              onChange={setTekniisiFilter}
              accentColor={C.orange}
              isDark={isDark}
            />

            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={teknisiFilter ? ClipboardList : CheckCircle2}
                iconColor={teknisiFilter ? C.blue : C.green}
                title={teknisiFilter ? 'Tidak ada tugas' : 'Semua beres!'}
                message={
                  teknisiFilter
                    ? 'Tidak ada tugas dengan filter ini.'
                    : 'Tidak ada tugas yang perlu ditindaklanjuti.'
                }
              />
            ) : (
              filteredTasks.map((task) => {
                const isActive = ['pending_confirmation', 'assigned', 'on_hold'].includes(task.status);
                return isActive ? (
                  <TaskWorkCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    onAccept={task.status === 'pending_confirmation' ? () => handleAccept(task) : undefined}
                    onDetail={() => goToTask(task.id)}
                    onCheckin={task.status === 'assigned' ? () => goToTask(task.id) : undefined}
                    userLat={userLat}
                    userLng={userLng}
                  />
                ) : (
                  <HistoryTaskCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    onPress={() => goToTask(task.id)}
                  />
                );
              })
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 110 }} />
      </ScrollView>

      {isManager && (
        <CreateTaskSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['manager-dispatch'] });
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateTaskSheet — form lengkap sesuai web (judul, tipe, dispatch, jadwal, darurat)
// ─────────────────────────────────────────────────────────────────────────────

function CreateTaskSheet({
  visible, onClose, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isDark  = useColorScheme() === 'dark';
  const insets  = useSafeAreaInsets();
  const { toast, success: toastSuccess, error: toastError, hide: hideToast } = useToast();

  const [pickerMode, setPickerMode]     = useState<PickerMode>(null);
  const [search, setSearch]             = useState('');
  const [title, setTitle]               = useState('');
  const [taskType, setTaskType]         = useState<TaskType>('visit');
  const [priority, setPriority]         = useState<Priority>('normal');
  const [client, setClient]             = useState<ClientItem | null>(null);
  const [dispatchType, setDispatchType] = useState<'direct' | 'broadcast'>('direct');
  const [employee, setEmployee]         = useState<EmployeeItem | null>(null);
  const [department, setDepartment]     = useState<DepartmentItem | null>(null);
  const [scheduledAt, setScheduledAt]   = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidStep, setAndroidStep]   = useState<'date' | 'time'>('date');
  const [androidTempDate, setAndroidTempDate] = useState<Date | null>(null);
  const [isEmergency, setIsEmergency]   = useState(false);
  const [notes, setNotes]               = useState('');
  const [template, setTemplate]         = useState<TemplateItem | null>(null);

  const bg      = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardCol = isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const prim    = lPrimary(isDark);
  const sec     = lSecondary(isDark);
  const ter     = lTertiary(isDark);

  const { data: employees = [], isFetching: loadingEmp } = useQuery({
    queryKey: ['colleagues-picker', search],
    queryFn: () => api.get('/users/colleagues', { params: { search } }).then((r) => r.data.items as EmployeeItem[]),
    enabled: visible && pickerMode === 'employee',
    staleTime: 30_000,
  });

  const { data: clients = [], isFetching: loadingCli } = useQuery({
    queryKey: ['clients-picker', search],
    queryFn: () => api.get('/clients', { params: { search } }).then((r) => r.data as ClientItem[]),
    enabled: visible && pickerMode === 'client',
    staleTime: 30_000,
  });

  const { data: departments = [], isFetching: loadingDept } = useQuery({
    queryKey: ['departments-picker'],
    queryFn: () => api.get('/departments').then((r) => r.data as DepartmentItem[]),
    enabled: visible && pickerMode === 'department',
    staleTime: 5 * 60_000,
  });

  const { data: templates = [], isFetching: loadingTemplates } = useQuery({
    queryKey: ['templates-picker'],
    queryFn: () => tasksService.getTemplates(),
    enabled: visible && pickerMode === 'template',
    staleTime: 5 * 60_000,
  });

  const canSubmit = title.trim() &&
    (dispatchType === 'direct' ? !!employee : !!department);

  const createMut = useMutation({
    mutationFn: () => tasksService.createTask({
      title: title.trim(),
      type: taskType,
      priority,
      client_id: client?.id,
      dispatch_type: dispatchType,
      assigned_to: dispatchType === 'direct' ? employee?.id : undefined,
      broadcast_dept_id: dispatchType === 'broadcast' ? department?.id : undefined,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
      is_emergency: isEmergency || undefined,
      notes: notes.trim() || undefined,
      template_id: template?.id,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      onSuccess();
      toastSuccess('Tugas berhasil dibuat dan dikirim.');
    },
    onError: (err: any) => {
      toastError(err?.response?.data?.message ?? 'Terjadi kesalahan.');
    },
  });

  const disabledReason = (() => {
    if (!title.trim()) return 'Judul tugas wajib diisi';
    if (dispatchType === 'direct' && !employee) return 'Pilih teknisi tujuan';
    if (dispatchType === 'broadcast' && !department) return 'Pilih departemen tujuan';
    return null;
  })();

  const resetForm = () => {
    setPickerMode(null); setSearch(''); setTitle(''); setTaskType('visit');
    setPriority('normal'); setClient(null); setDispatchType('direct');
    setEmployee(null); setDepartment(null); setScheduledAt(null);
    setShowDatePicker(false); setAndroidStep('date'); setAndroidTempDate(null);
    setIsEmergency(false); setNotes(''); setTemplate(null);
  };

  const handleClose = () => { resetForm(); onClose(); };
  const openPicker = (mode: PickerMode) => { setSearch(''); setPickerMode(mode); };

  const formatDate = (d: Date) =>
    d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });

  // ── Picker ─────────────────────────────────────────────────────────────────
  const renderPicker = () => {
    const isEmp  = pickerMode === 'employee';
    const isDept = pickerMode === 'department';
    const isTpl  = pickerMode === 'template';
    type PickerItem = EmployeeItem | DepartmentItem | ClientItem | TemplateItem;
    const items: PickerItem[] = isEmp ? employees : isDept ? departments : isTpl ? templates : clients;
    const loading = isEmp ? loadingEmp : isDept ? loadingDept : isTpl ? loadingTemplates : loadingCli;
    const label  = isEmp ? 'Pilih Teknisi' : isDept ? 'Pilih Departemen' : isTpl ? 'Pilih Template BA' : 'Pilih Klien';
    const noSearch = isDept || isTpl;

    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
          <TouchableOpacity onPress={() => { setPickerMode(null); setSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={22} strokeWidth={2} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: prim, flex: 1 }}>{label}</Text>
          {isTpl && template && (
            <TouchableOpacity onPress={() => { setTemplate(null); setPickerMode(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.red }}>Hapus</Text>
            </TouchableOpacity>
          )}
        </View>
        {!noSearch && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF5', borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Search size={15} strokeWidth={2} color={ter} />
            <TextInput value={search} onChangeText={setSearch} placeholder={isEmp ? 'Cari nama karyawan...' : 'Cari klien...'} placeholderTextColor={ter} style={{ flex: 1, fontSize: 15, color: prim }} autoFocus />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>}
          </View>
        )}
        {loading ? <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} /> : (
          <FlatList<PickerItem>
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: noSearch ? 12 : 0, paddingBottom: insets.bottom + 110 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: ter, marginTop: 32, fontSize: 14 }}>{isTpl ? 'Belum ada template tersedia' : search ? 'Tidak ada hasil' : 'Belum ada data'}</Text>}
            renderItem={({ item }) => {
              const name = isEmp ? (item as EmployeeItem).full_name
                : isTpl ? (item as TemplateItem).name
                : (item as ClientItem | DepartmentItem).name;
              const sub  = isEmp ? (item as EmployeeItem).employee_id
                : isTpl ? (item as TemplateItem).work_type
                : (item as ClientItem).address;
              const Icon = isEmp ? User : isTpl ? FileText : Briefcase;
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isEmp) setEmployee(item as EmployeeItem);
                    else if (isDept) setDepartment(item as DepartmentItem);
                    else if (isTpl) setTemplate(item as TemplateItem);
                    else setClient(item as ClientItem);
                    setPickerMode(null); setSearch('');
                  }}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, marginBottom: 8 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} strokeWidth={1.8} color={C.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: prim }} numberOfLines={1}>{name}</Text>
                    {sub && <Text style={{ fontSize: 12, color: ter, marginTop: 2 }} numberOfLines={1}>{sub}</Text>}
                  </View>
                  <ChevronRight size={14} strokeWidth={2} color={ter} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  };

  // ── Form ───────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>

      {/* Judul */}
      <Text style={[fieldLabel, { color: ter }]}>JUDUL *</Text>
      <TextInput
        value={title} onChangeText={setTitle}
        placeholder="Nama tugas..."
        placeholderTextColor={ter}
        style={{ backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: title ? C.blue + '60' : border, padding: 14, fontSize: 15, color: prim, marginBottom: 16 }}
      />

      {/* Tipe + Prioritas */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={[fieldLabel, { color: ter }]}>TIPE</Text>
          <View style={{ gap: 6 }}>
            {TASK_TYPE_OPTIONS.map((opt) => {
              const active = taskType === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => setTaskType(opt.value)} activeOpacity={0.78}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: active ? C.blue + '18' : cardCol, borderWidth: active ? 1 : B.default, borderColor: active ? C.blue : border }}>
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? C.blue : sec }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fieldLabel, { color: ter }]}>PRIORITAS</Text>
          <View style={{ gap: 6 }}>
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => setPriority(opt.value as Priority)} activeOpacity={0.78}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: active ? opt.color + '18' : cardCol, borderWidth: active ? 1 : B.default, borderColor: active ? opt.color : border }}>
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? opt.color : sec }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Klien */}
      <Text style={[fieldLabel, { color: ter }]}>KLIEN</Text>
      <TouchableOpacity onPress={() => openPicker('client')} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: client ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
        <Briefcase size={17} strokeWidth={1.8} color={client ? C.blue : ter} />
        <Text style={{ flex: 1, fontSize: 15, color: client ? prim : ter, fontWeight: client ? '600' : '400' }}>
          {client?.name ?? '— Pilih klien —'}
        </Text>
        {client
          ? <TouchableOpacity onPress={() => setClient(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
          : <ChevronRight size={15} strokeWidth={2} color={ter} />
        }
      </TouchableOpacity>

      {/* Template BA */}
      <Text style={[fieldLabel, { color: ter }]}>TEMPLATE BERITA ACARA</Text>
      <TouchableOpacity onPress={() => openPicker('template')} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: template ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
        <FileText size={17} strokeWidth={1.8} color={template ? C.blue : ter} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, color: template ? prim : ter, fontWeight: template ? '600' : '400' }} numberOfLines={1}>
            {template?.name ?? '— Tanpa template —'}
          </Text>
          {template?.work_type && (
            <Text style={{ fontSize: 12, color: ter, marginTop: 2 }} numberOfLines={1}>{template.work_type}</Text>
          )}
        </View>
        {template
          ? <TouchableOpacity onPress={() => setTemplate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
          : <ChevronRight size={15} strokeWidth={2} color={ter} />
        }
      </TouchableOpacity>

      {/* Dispatch */}
      <Text style={[fieldLabel, { color: ter }]}>DISPATCH</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'direct',    label: 'Direct',     desc: 'Ke 1 teknisi' },
          { key: 'broadcast', label: 'Broadcast',   desc: 'Ke departemen' },
        ] as const).map((opt) => {
          const active = dispatchType === opt.key;
          return (
            <TouchableOpacity key={opt.key} onPress={() => { setDispatchType(opt.key); setEmployee(null); setDepartment(null); }} activeOpacity={0.78}
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: active ? C.blue + '14' : cardCol, borderWidth: active ? 1.5 : B.default, borderColor: active ? C.blue : border, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: active ? C.blue : sec }}>{opt.label}</Text>
              <Text style={{ fontSize: 11, color: active ? C.blue + 'AA' : ter, marginTop: 2 }}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Teknisi / Departemen */}
      {dispatchType === 'direct' ? (
        <>
          <Text style={[fieldLabel, { color: ter }]}>TEKNISI *</Text>
          <TouchableOpacity onPress={() => openPicker('employee')} activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: employee ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
            <User size={17} strokeWidth={1.8} color={employee ? C.blue : ter} />
            <Text style={{ flex: 1, fontSize: 15, color: employee ? prim : ter, fontWeight: employee ? '600' : '400' }}>
              {employee?.full_name ?? '— Pilih teknisi —'}
            </Text>
            {employee
              ? <TouchableOpacity onPress={() => setEmployee(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
              : <ChevronRight size={15} strokeWidth={2} color={ter} />
            }
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[fieldLabel, { color: ter }]}>DEPARTEMEN *</Text>
          <TouchableOpacity onPress={() => openPicker('department')} activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: department ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
            <Briefcase size={17} strokeWidth={1.8} color={department ? C.blue : ter} />
            <Text style={{ flex: 1, fontSize: 15, color: department ? prim : ter, fontWeight: department ? '600' : '400' }}>
              {department?.name ?? '— Pilih departemen —'}
            </Text>
            {department
              ? <TouchableOpacity onPress={() => setDepartment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
              : <ChevronRight size={15} strokeWidth={2} color={ter} />
            }
          </TouchableOpacity>
        </>
      )}

      {/* Jadwal */}
      <Text style={[fieldLabel, { color: ter }]}>JADWAL</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: scheduledAt ? C.blue + '60' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 }}>
        <Clock size={17} strokeWidth={1.8} color={scheduledAt ? C.blue : ter} />
        <Text style={{ flex: 1, fontSize: 15, color: scheduledAt ? prim : ter, fontWeight: scheduledAt ? '600' : '400' }}>
          {scheduledAt ? formatDate(scheduledAt) : 'Pilih tanggal & waktu...'}
        </Text>
        {scheduledAt
          ? <TouchableOpacity onPress={() => setScheduledAt(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={15} strokeWidth={2} color={ter} /></TouchableOpacity>
          : <ChevronRight size={15} strokeWidth={2} color={ter} />
        }
      </TouchableOpacity>

      {showDatePicker && (
        <>
          <DateTimePicker
            value={
              Platform.OS === 'android' && androidStep === 'time' && androidTempDate
                ? androidTempDate
                : (scheduledAt ?? new Date())
            }
            mode={Platform.OS === 'android' ? androidStep : 'datetime'}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') {
                if (event.type === 'dismissed') {
                  setShowDatePicker(false);
                  setAndroidStep('date');
                  setAndroidTempDate(null);
                  return;
                }
                if (event.type === 'set' && date) {
                  if (androidStep === 'date') {
                    setAndroidTempDate(date);
                    setAndroidStep('time');
                  } else {
                    const combined = new Date(androidTempDate ?? date);
                    combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
                    setScheduledAt(combined);
                    setShowDatePicker(false);
                    setAndroidStep('date');
                    setAndroidTempDate(null);
                  }
                }
              } else if (date) {
                setScheduledAt(date);
              }
            }}
            style={{ marginBottom: 8 }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              activeOpacity={0.8}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.sm, backgroundColor: C.blue + '18', marginBottom: 12 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.blue }}>Selesai</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Darurat */}
      <TouchableOpacity onPress={() => setIsEmergency((v) => !v)} activeOpacity={0.78}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isEmergency ? C.red + '10' : cardCol, borderRadius: R.md, borderWidth: isEmergency ? 1 : B.default, borderColor: isEmergency ? C.red + '50' : border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 20 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: isEmergency ? C.red : ter, backgroundColor: isEmergency ? C.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {isEmergency && <CheckCircle2 size={13} strokeWidth={3} color="#FFF" />}
        </View>
        <AlertCircle size={17} strokeWidth={1.8} color={isEmergency ? C.red : ter} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: isEmergency ? C.red : sec }}>Tandai sebagai Darurat</Text>
      </TouchableOpacity>

      {/* Catatan */}
      <Text style={[fieldLabel, { color: ter }]}>CATATAN</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Instruksi atau catatan tambahan..." placeholderTextColor={ter} multiline numberOfLines={3} textAlignVertical="top"
        style={{ backgroundColor: cardCol, borderRadius: R.md, borderWidth: B.default, borderColor: border, padding: 14, fontSize: 15, color: prim, minHeight: 80, marginBottom: 24 }} />

      {/* Submit */}
      <TouchableOpacity
        onPress={() => createMut.mutate()}
        disabled={!canSubmit || createMut.isPending}
        activeOpacity={0.85}
        style={{ paddingVertical: 16, borderRadius: R.md, backgroundColor: canSubmit ? C.orange : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
      >
        {createMut.isPending
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Briefcase size={18} strokeWidth={2} color={canSubmit ? '#FFF' : ter} />
        }
        <Text style={{ fontSize: 16, fontWeight: '700', color: canSubmit ? '#FFF' : ter }}>
          {createMut.isPending ? 'Membuat Tugas…' : 'Buat & Kirim Tugas'}
        </Text>
      </TouchableOpacity>
      {disabledReason && !createMut.isPending && (
        <Text style={{ fontSize: 12, color: C.orange, textAlign: 'center', marginTop: 10, fontWeight: '500' }}>
          {disabledReason}
        </Text>
      )}
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
        </View>
        {!pickerMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.orange + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} strokeWidth={2} color={C.orange} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: prim }}>Buat Tugas Baru</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} strokeWidth={2.2} color={prim} />
            </TouchableOpacity>
          </View>
        )}
        {pickerMode ? renderPicker() : renderForm()}
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fieldLabel = {
  fontSize: 11, fontWeight: '700' as const,
  letterSpacing: 0.6, marginBottom: 8,
} as const;
