import { View, Text, ScrollView } from 'react-native';
import { useColorScheme } from 'react-native';

interface ScheduleEvent {
  id: string;
  type: 'shift' | 'visit' | 'oncall' | 'day_off' | 'holiday';
  title: string;
  subtitle?: string;
  time_start?: string;
  time_end?: string;
  color: string;
  is_day_off?: boolean;
  is_holiday?: boolean;
}

interface Props {
  date: string;
  events: ScheduleEvent[];
}

const TYPE_COLORS: Record<string, { bg: string; bgDark: string; border: string; borderDark: string }> = {
  shift:   { bg: '#EFF6FF', bgDark: 'rgba(0,122,255,0.18)',   border: '#BFDBFE', borderDark: 'rgba(0,122,255,0.40)' },
  visit:   { bg: '#ECFEFF', bgDark: 'rgba(90,200,250,0.16)',  border: '#A5F3FC', borderDark: 'rgba(90,200,250,0.35)' },
  oncall:  { bg: '#F5F3FF', bgDark: 'rgba(191,90,242,0.16)',  border: '#DDD6FE', borderDark: 'rgba(191,90,242,0.35)' },
  holiday: { bg: '#FEF2F2', bgDark: 'rgba(255,69,58,0.14)',   border: '#FECACA', borderDark: 'rgba(255,69,58,0.35)' },
  day_off: { bg: '#F3F4F6', bgDark: 'rgba(255,255,255,0.08)', border: '#E5E7EB', borderDark: 'rgba(255,255,255,0.14)' },
};

function formatDayLabel(dateStr: string): string {
  // M5: parse "YYYY-MM-DD" sebagai tanggal lokal (bukan UTC midnight) agar diff tidak meleset
  //     karena new Date("2026-04-12") = UTC midnight → bisa menjadi kemarin di zona UTC+8
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day); // local midnight

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hari Ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Asia/Makassar',
  });
}

export function AgendaList({ date, events }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (events.length === 0) {
    return (
      <View
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
          borderRadius: 14,
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
          padding: 20,
          marginHorizontal: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.40)' : '#9CA3AF' }}>
          Tidak ada jadwal pada hari ini
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginHorizontal: 10 }}>
      {/* Day label */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: isDark ? 'rgba(255,255,255,0.50)' : '#6B7280',
          marginBottom: 8,
          paddingHorizontal: 2,
        }}
      >
        {formatDayLabel(date)}
      </Text>

      {/* Event cards */}
      <View style={{ gap: 8 }}>
        {events.map((event) => {
          const colors = TYPE_COLORS[event.type] ?? TYPE_COLORS.shift;
          return (
            <View
              key={event.id}
              style={{
                backgroundColor: isDark ? colors.bgDark : colors.bg,
                borderRadius: 14,
                borderWidth: 0.5,
                borderColor: isDark ? colors.borderDark : colors.border,
                padding: 12,
                ...(isDark
                  ? { shadowColor: 'transparent' }
                  : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 }),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Color dot */}
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: event.color,
                    marginTop: 1,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isDark ? '#FFFFFF' : '#111111',
                      letterSpacing: -0.2,
                    }}
                  >
                    {event.title}
                  </Text>
                  {event.subtitle && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280',
                        marginTop: 1,
                      }}
                    >
                      {event.subtitle}
                    </Text>
                  )}
                </View>
                {/* Time */}
                {event.time_start && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280',
                    }}
                  >
                    {event.time_start.slice(0, 5)}
                    {event.time_end ? `–${event.time_end.slice(0, 5)}` : ''}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
