import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/tokens';
import type { TaskSummary } from '@/services/tasks.service';
import { ConfirmCountdown } from './ConfirmCountdown';
import MiniMap from './MiniMap';
import NavigationButton from './NavigationButton';

interface Props {
  task: TaskSummary;
  onPress: () => void;
  userLat?: number;
  userLng?: number;
}

const PRIORITY_STYLE: Record<string, {
  borderColor: string;
  color: string;
  bg: string;
  bgDark: string;
  label: string;
  icon: string;
}> = {
  low: {
    borderColor: 'transparent',
    color: '#6B7280',
    bg: '#F9FAFB',
    bgDark: 'rgba(107,114,128,0.12)',
    label: 'Rendah',
    icon: 'arrow-down-circle',
  },
  normal: {
    borderColor: 'transparent',
    color: '#2563EB',
    bg: '#EFF6FF',
    bgDark: 'rgba(37,99,235,0.15)',
    label: 'Normal',
    icon: 'remove-circle',
  },
  high: {
    borderColor: '#EA580C',
    color: '#EA580C',
    bg: '#FFF7ED',
    bgDark: 'rgba(234,88,12,0.15)',
    label: 'PENTING',
    icon: 'arrow-up-circle',
  },
  urgent: {
    borderColor: '#EF4444',
    color: '#EF4444',
    bg: '#FEF2F2',
    bgDark: 'rgba(239,68,68,0.15)',
    label: 'MENDADAK',
    icon: 'flash',
  },
};

// L8: gunakan token C.* agar warna status konsisten dengan design system
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unassigned:           { label: 'Belum Ditugaskan',    color: C.labelSecondary.light },
  pending_confirmation: { label: 'Menunggu Konfirmasi', color: C.orange  },
  assigned:             { label: 'Ditugaskan',           color: C.blue    },
  on_hold:              { label: 'Ditunda',              color: C.orange  },
  rescheduled:          { label: 'Dijadwal Ulang',       color: C.indigo  },
  completed:            { label: 'Selesai',              color: C.green   },
};

export function TaskCard({ task, onPress, userLat, userLng }: Props) {
  const isDark = useColorScheme() === 'dark';
  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal;
  const ss = STATUS_LABELS[task.status] ?? { label: task.status, color: '#6B7280' };
  const isUrgent = task.priority === 'urgent';
  const isHigh = task.priority === 'high';
  const needsConfirm = task.status === 'pending_confirmation' && !!task.confirm_deadline;

  const cardBorder = isUrgent || isHigh
    ? ps.borderColor
    : isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: cardBorder,
        padding: 18,
        marginHorizontal: 20,
        marginBottom: 12,
      }}
    >
      {/* Emergency banner */}
      {task.is_emergency && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Ionicons name="warning" size={13} color="#EF4444" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>TUGAS DARURAT</Text>
        </View>
      )}

      {/* Row 1 — title + priority badge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
        <Text
          style={{ flex: 1, fontSize: 16, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A', letterSpacing: -0.3, lineHeight: 22 }}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: isDark ? ps.bgDark : ps.bg }}>
          <Ionicons name={ps.icon as any} size={11} color={ps.color} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: ps.color }}>{ps.label}</Text>
        </View>
      </View>

      {/* Client */}
      {task.client && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Ionicons name="business-outline" size={13} color={isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8'} />
          <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.65)' : '#475569', flex: 1 }} numberOfLines={1}>
            {task.client.name}
            {task.client.address ? ` · ${task.client.address}` : ''}
          </Text>
        </View>
      )}

      {/* Status + scheduled */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ss.color }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: ss.color }}>{ss.label}</Text>
        </View>
        {task.escalated_from && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB' }}>
            <Ionicons name="arrow-up-circle" size={11} color="#F59E0B" />
            <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '600' }}>Eskalasi</Text>
          </View>
        )}
        {task.scheduled_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={12} color={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'} />
            <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>
              {new Date(task.scheduled_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>

      {/* Confirm countdown */}
      {needsConfirm && (
        <View style={{ marginTop: 12 }}>
          <ConfirmCountdown
            deadline={task.confirm_deadline!}
            priority={task.priority as 'normal' | 'high' | 'urgent'}
          />
        </View>
      )}

      {/* MiniMap + Navigation */}
      {task.client?.lat && task.client?.lng && userLat && userLng && (
        <View style={{ marginTop: 12 }}>
          <MiniMap
            originLat={userLat}
            originLng={userLng}
            destLat={Number(task.client.lat)}
            destLng={Number(task.client.lng)}
            height={120}
          />
          <View style={{ marginTop: 8 }}>
            <NavigationButton
              lat={Number(task.client.lat)}
              lng={Number(task.client.lng)}
              label={`Navigasi ke ${task.client.name}`}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}
