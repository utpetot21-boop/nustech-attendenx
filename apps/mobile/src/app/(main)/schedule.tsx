import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, B, pageBg, cardBg, lPrimary, lSecondary, lTertiary } from '@/constants/tokens';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ScheduleWeekSkeleton } from '@/components/ui/SkeletonLoader';
import { useQuery } from '@tanstack/react-query';

import {
  scheduleService,
  getCurrentWeekString,
  getWeekDates,
  type UserSchedule,
} from '@/services/schedule.service';
import { attendanceService, type AttendanceRecord } from '@/services/attendance.service';
import { rescheduleCheckInReminders } from '@/services/check-in-reminder.service';

/** Konversi tanggal arbitrary ke ISO week string (YYYY-Www) */
function getWeekStringForDate(date: Date): string {
  const year = date.getFullYear();
  const jan4  = new Date(year, 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = Math.floor((date.getTime() - startW1.getTime()) / (7 * 24 * 3600 * 1000));
  const week = diff + 1;
  if (week < 1)  return getWeekStringForDate(new Date(year - 1, 11, 28));
  const nextYearW1 = new Date(year + 1, 0, 4);
  nextYearW1.setDate(nextYearW1.getDate() - ((nextYearW1.getDay() + 6) % 7));
  if (date >= nextYearW1) return `${year + 1}-W01`;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
import { WeekView } from '@/components/schedule/WeekView';
import { AgendaList } from '@/components/schedule/AgendaList';
import { BackHeader } from '@/components/ui/BackHeader';

type ViewMode = 'week' | 'month' | 'agenda';

const VIEW_LABELS: Record<ViewMode, string> = {
  week: 'Mingguan',
  month: 'Bulanan',
  agenda: 'Agenda',
};

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function scheduleToEvent(s: UserSchedule) {
  if (s.is_holiday) {
    return { id: s.id, type: 'holiday' as const, title: 'Hari Libur Nasional', color: C.red, time_start: undefined, time_end: undefined };
  }
  if (s.is_day_off) {
    return { id: s.id, type: 'day_off' as const, title: 'Libur', color: C.red, time_start: undefined, time_end: undefined };
  }
  return {
    id: s.id,
    type: 'shift' as const,
    title: s.shift_type?.name ?? (s.schedule_type === 'office_hours' ? 'Office Hours' : 'Shift'),
    subtitle: `Toleransi ${s.tolerance_minutes} menit`,
    time_start: s.start_time,
    time_end: s.end_time,
    color: s.shift_type?.color_hex ?? C.blue,
  };
}

export default function ScheduleScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeekString());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }));

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  // Queries
  const { data: weekSchedules = [], isLoading: loadingWeek, refetch: refetchWeek } = useQuery({
    queryKey: ['my-schedule-week', currentWeek],
    queryFn: () => scheduleService.getMySchedule({ week: currentWeek }),
  });

  const { data: monthSchedules = [], isLoading: loadingMonth, refetch: refetchMonth } = useQuery({
    queryKey: ['my-schedule-month', currentMonth],
    queryFn: () => scheduleService.getMySchedule({ month: currentMonth }),
  });

  const { data: attendanceHistory = [], refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance-history', currentMonth],
    queryFn: () => attendanceService.getHistory({ month: currentMonth }),
  });

  // Refetch saat screen kembali fokus
  useFocusEffect(
    useCallback(() => {
      refetchWeek();
      refetchMonth();
      refetchAttendance();
      // Fire-and-forget: jadwal mungkin berubah sejak terakhir login
      rescheduleCheckInReminders().catch(() => null);
    }, [refetchWeek, refetchMonth, refetchAttendance])
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchWeek(), refetchMonth(), refetchAttendance()]);
    setRefreshing(false);
  }, [refetchWeek, refetchMonth, refetchAttendance]);

  const attendanceByDate = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    for (const a of attendanceHistory) map[a.date] = a;
    return map;
  }, [attendanceHistory]);

  // Map schedules by date
  const scheduleByDate = useMemo(() => {
    const map: Record<string, UserSchedule[]> = {};
    const source = viewMode === 'month' ? monthSchedules : weekSchedules;
    for (const s of source) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [weekSchedules, monthSchedules, viewMode]);

  // Build WeekView data
  const weekViewDays = weekDates.map((date) => ({
    date,
    events: (scheduleByDate[date] ?? []).map(scheduleToEvent),
  }));

  // Navigate week — juga pindahkan selectedDate ke hari yang sama di minggu baru
  const shiftSelectedDate = (newWeek: string) => {
    const newDates = getWeekDates(newWeek);
    if (newDates.length < 7) return;
    // ISO week: Mon=index 0 … Sun=index 6; JS getDay(): Sun=0, Mon=1 … Sat=6
    const dayJS = new Date(selectedDate + 'T00:00:00').getDay();
    const idx = dayJS === 0 ? 6 : dayJS - 1;
    setSelectedDate(newDates[idx]);
  };

  const prevWeek = () => {
    const [y, w] = currentWeek.split('-W').map(Number);
    const newWeek = w === 1 ? `${y - 1}-W52` : `${y}-W${String(w - 1).padStart(2, '0')}`;
    setCurrentWeek(newWeek);
    shiftSelectedDate(newWeek);
  };
  const nextWeek = () => {
    const [y, w] = currentWeek.split('-W').map(Number);
    const newWeek = w >= 52 ? `${y + 1}-W01` : `${y}-W${String(w + 1).padStart(2, '0')}`;
    setCurrentWeek(newWeek);
    shiftSelectedDate(newWeek);
  };

  // Navigate month
  const prevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    if (m === 1) setCurrentMonth(`${y - 1}-12`);
    else setCurrentMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    if (m === 12) setCurrentMonth(`${y + 1}-01`);
    else setCurrentMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
  };

  // Build month grid
  const monthGrid = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  const [y, m] = currentMonth.split('-').map(Number);

  const isLoading = loadingWeek || loadingMonth;

  const textPrimary = lPrimary(isDark);
  const textSecondary = lSecondary(isDark);

  return (
    <View style={{ flex: 1, backgroundColor: pageBg(isDark) }}>

      {/* Header */}
      <View>
        <BackHeader
          title="Jadwal"
          subtitle={viewMode === 'month'
            ? `${MONTHS_ID[m - 1]} ${y}`
            : weekDates.length >= 7
            ? `${weekDates[0].slice(5).replace('-', '/')} – ${weekDates[6].slice(5).replace('-', '/')}`
            : undefined}
          accentColor={C.blue}
        />

        {/* Toolbar nav + segmented */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <TouchableOpacity
            onPress={viewMode === 'month' ? prevMonth : prevWeek}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.18)' }}
          >
            <ChevronLeft size={18} strokeWidth={2} color={isDark ? 'rgba(255,255,255,0.7)' : '#475569'} />
          </TouchableOpacity>

          <View style={{ flex: 1, flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF5', borderRadius: 14, padding: 3 }}>
          {(['week', 'month', 'agenda'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 11,
                alignItems: 'center',
                backgroundColor: viewMode === mode
                  ? cardBg(isDark)
                  : 'transparent',
                ...(viewMode === mode ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 3 } : {}),
              }}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: viewMode === mode ? '700' : '500',
                color: viewMode === mode
                  ? lPrimary(isDark)
                  : lSecondary(isDark),
              }}>
                {VIEW_LABELS[mode]}
              </Text>
            </TouchableOpacity>
          ))}
          </View>

          <TouchableOpacity
            onPress={viewMode === 'month' ? nextMonth : nextWeek}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: B.default, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.18)' }}
          >
            <ChevronRight size={18} strokeWidth={2} color={isDark ? 'rgba(255,255,255,0.7)' : '#475569'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#FFFFFF' : C.blue}
          />
        }
      >
        {isLoading && <ScheduleWeekSkeleton isDark={isDark} />}

        {!isLoading && (
          <>
            {/* ── WEEK VIEW ──────────────────────────── */}
            {(viewMode === 'week' || viewMode === 'agenda') && (
              <WeekView
                days={weekViewDays}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}

            {/* ── MONTH VIEW ─────────────────────────── */}
            {viewMode === 'month' && (
              <View style={{
                marginHorizontal: 20,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
                borderRadius: R.lg,
                borderWidth: B.default,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.18)',
                padding: 16,
                marginBottom: 12,
              }}>
                {/* Day headers */}
                <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                  {DAYS_SHORT.map((d) => (
                    <Text key={d} style={{
                      flex: 1, textAlign: 'center',
                      fontSize: 11, fontWeight: '600',
                      color: lTertiary(isDark),
                      textTransform: 'uppercase',
                    }}>{d}</Text>
                  ))}
                </View>
                {/* Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {monthGrid.map((cell, i) => {
                    if (!cell) return <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                    const events = scheduleByDate[cell] ?? [];
                    const isToday = cell === today;
                    const isSelected = cell === selectedDate;
                    const dayNum = new Date(cell).getDate();
                    const dotColors = events.map((s) => scheduleToEvent(s).color).slice(0, 3);

                    return (
                      <TouchableOpacity
                        key={cell}
                        onPress={() => {
                          const weekStr = getWeekStringForDate(new Date(cell));
                          setCurrentWeek(weekStr);
                          setSelectedDate(cell);
                          setViewMode('agenda');
                        }}
                        style={{
                          width: `${100 / 7}%`,
                          aspectRatio: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 2,
                        }}
                      >
                        <View style={{
                          width: 32, height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected
                            ? C.blue
                            : isToday
                            ? isDark ? C.blue + '40' : C.blue + '1A'
                            : 'transparent',
                        }}>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: isToday || isSelected ? '700' : '400',
                            color: isSelected ? '#FFFFFF' : isToday ? C.blue : lPrimary(isDark),
                          }}>
                            {dayNum}
                          </Text>
                        </View>
                        {/* Dots */}
                        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, minHeight: 5 }}>
                          {dotColors.map((c, j) => (
                            <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? 'rgba(255,255,255,0.70)' : c }} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── AGENDA (detail hari yang dipilih) ─── */}
            <View style={{ marginTop: 4 }}>
              <AgendaList
                date={selectedDate}
                events={(scheduleByDate[selectedDate] ?? []).map(scheduleToEvent)}
                attendance={attendanceByDate[selectedDate] ?? null}
              />
            </View>

            {/* Legenda */}
            <View style={{
              marginHorizontal: 20,
              marginTop: 16,
              flexDirection: 'row',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              {[
                { color: C.blue, label: 'Shift' },
                { color: C.green, label: 'Office Hours' },
                { color: C.purple, label: 'Piket/On-Call' },
                { color: C.red, label: 'Hari Libur' },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                  <Text style={{ fontSize: 11, color: lSecondary(isDark) }}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
