import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useColorScheme } from 'react-native';

interface DayData {
  date: string; // YYYY-MM-DD
  events: ScheduleEvent[];
}

interface ScheduleEvent {
  id: string;
  type: 'shift' | 'visit' | 'oncall';
  title: string;
  subtitle?: string;
  time?: string;
  color: string;
  is_day_off?: boolean;
  is_holiday?: boolean;
}

interface Props {
  days: DayData[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function parseDate(dateStr: string) {
  const d = new Date(dateStr);
  return { dayNum: d.getDate(), dayLabel: DAY_SHORT[d.getDay()], iso: dateStr };
}

export function WeekView({ days, selectedDate, onSelectDate }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const today = new Date().toISOString().split('T')[0];

  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
        borderRadius: 14,
        borderWidth: 0.5,
        borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.07)',
        padding: 12,
        marginHorizontal: 10,
        marginBottom: 8,
        ...(isDark ? { shadowColor: 'transparent' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }),
      }}
    >
      {/* Week row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map(({ date, events }) => {
            const { dayNum, dayLabel } = parseDate(date);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const dotColors = [...new Set(events.map((e) => e.color))].slice(0, 3);

            return (
              <TouchableOpacity
                key={date}
                onPress={() => onSelectDate(date)}
                style={{
                  width: 40,
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  borderRadius: 10,
                  backgroundColor: isSelected
                    ? '#007AFF'
                    : isToday
                    ? isDark ? 'rgba(0,122,255,0.20)' : 'rgba(0,122,255,0.10)'
                    : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: isSelected ? 'rgba(255,255,255,0.80)' : isDark ? 'rgba(255,255,255,0.60)' : '#6B7280',
                    marginBottom: 3,
                  }}
                >
                  {dayLabel}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: isSelected ? '#FFFFFF' : isToday ? '#007AFF' : isDark ? '#FFFFFF' : '#111111',
                  }}
                >
                  {dayNum}
                </Text>
                {/* Dots */}
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, minHeight: 6 }}>
                  {dotColors.map((c, i) => (
                    <View
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.70)' : c,
                      }}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
