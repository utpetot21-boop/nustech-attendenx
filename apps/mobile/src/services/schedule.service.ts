import api from './api';

export interface UserSchedule {
  id: string;
  user_id: string;
  schedule_type: 'shift' | 'office_hours';
  date: string;
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  is_holiday: boolean;
  is_day_off: boolean;
  shift_type?: {
    id: string;
    name: string;
    color_hex: string;
  };
}

export const scheduleService = {
  getMySchedule(params: { date?: string; week?: string; month?: string }) {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.week) query.set('week', params.week);
    if (params.month) query.set('month', params.month);
    return api.get<UserSchedule[]>(`/schedules/me?${query.toString()}`).then((r) => r.data);
  },
};

export function getCurrentWeekString(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 3600 * 1000));
  return `${now.getFullYear()}-W${String(diff + 1).padStart(2, '0')}`;
}

export function getWeekDates(weekStr: string): string[] {
  // L1: validasi format "YYYY-Www" sebelum parse — cegah NaN silent
  if (!/^\d{4}-W\d{1,2}$/.test(weekStr)) return [];
  const [yearStr, wPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(wPart, 10);
  if (isNaN(year) || isNaN(weekNum) || weekNum < 1 || weekNum > 53) return [];
  const jan4 = new Date(year, 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(startW1);
  monday.setDate(startW1.getDate() + (weekNum - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  });
}
