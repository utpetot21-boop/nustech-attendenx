import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import {
  AlertTriangle, ArrowDownCircle, MinusCircle, ArrowUpCircle,
  Zap, Building2, Calendar,
  type LucideIcon,
} from 'lucide-react-native';
import { C, R, B, cardBg, lPrimary, lSecondary, lTertiary, separator } from '@/constants/tokens';
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
  bgLight: string;
  bgDark: string;
  label: string;
  Icon: LucideIcon;
}> = {
  low: {
    borderColor: 'transparent',
    color: C.labelSecondary.light,
    bgLight: 'rgba(60,60,67,0.08)',
    bgDark:  'rgba(235,235,245,0.12)',
    label: 'Rendah',
    Icon: ArrowDownCircle,
  },
  normal: {
    borderColor: 'transparent',
    color: C.blue,
    bgLight: C.blue + '14',
    bgDark:  C.blue + '26',
    label: 'Normal',
    Icon: MinusCircle,
  },
  high: {
    borderColor: C.orange,
    color: C.orange,
    bgLight: C.orange + '14',
    bgDark:  C.orange + '26',
    label: 'PENTING',
    Icon: ArrowUpCircle,
  },
  urgent: {
    borderColor: C.red,
    color: C.red,
    bgLight: C.red + '14',
    bgDark:  C.red + '26',
    label: 'MENDADAK',
    Icon: Zap,
  },
};

// L8: gunakan token C.* agar warna status konsisten dengan design system
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unassigned:           { label: 'Belum Ditugaskan',    color: C.labelSecondary.light },
  pending_confirmation: { label: 'Menunggu Konfirmasi', color: C.orange  },
  assigned:             { label: 'Ditugaskan',           color: C.blue    },
  in_progress:          { label: 'Sedang Dikerjakan',   color: C.teal    },
  on_hold:              { label: 'Ditunda',              color: C.orange  },
  rescheduled:          { label: 'Dijadwal Ulang',       color: C.indigo  },
  completed:            { label: 'Selesai',              color: C.green   },
  cancelled:            { label: 'Dibatalkan',           color: C.red     },
};

export function TaskCard({ task, onPress, userLat, userLng }: Props) {
  const isDark = useColorScheme() === 'dark';
  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal;
  const ss = STATUS_LABELS[task.status] ?? { label: task.status, color: lSecondary(isDark) };
  const isUrgent = task.priority === 'urgent';
  const isHigh = task.priority === 'high';
  const needsConfirm = task.status === 'pending_confirmation' && !!task.confirm_deadline;

  const cardBorder = isUrgent || isHigh ? ps.borderColor : separator(isDark);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={{
        backgroundColor: cardBg(isDark),
        borderRadius: R.lg,
        borderWidth: B.default,
        borderColor: cardBorder,
        padding: 18,
        marginHorizontal: 20,
        marginBottom: 12,
      }}
    >
      {/* Emergency banner */}
      {task.is_emergency && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <AlertTriangle size={13} strokeWidth={2} color={C.red} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.red }}>TUGAS DARURAT</Text>
        </View>
      )}

      {/* Row 1 — title + priority badge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
        <Text
          style={{ flex: 1, fontSize: 16, fontWeight: '700', color: lPrimary(isDark), letterSpacing: -0.3, lineHeight: 22 }}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: R.xs, backgroundColor: isDark ? ps.bgDark : ps.bgLight }}>
          <ps.Icon size={11} strokeWidth={2} color={ps.color} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: ps.color }}>{ps.label}</Text>
        </View>
      </View>

      {/* Client */}
      {task.client && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Building2 size={13} strokeWidth={1.8} color={lTertiary(isDark)} />
          <Text style={{ fontSize: 14, color: lSecondary(isDark), flex: 1 }} numberOfLines={1}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: C.orange + (isDark ? '26' : '1A') }}>
            <ArrowUpCircle size={11} strokeWidth={2} color={C.orange} />
            <Text style={{ fontSize: 10, color: C.orange, fontWeight: '600' }}>Eskalasi</Text>
          </View>
        )}
        {task.scheduled_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Calendar size={12} strokeWidth={1.8} color={lTertiary(isDark)} />
            <Text style={{ fontSize: 12, color: lTertiary(isDark) }}>
              {new Date(task.scheduled_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })}
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
