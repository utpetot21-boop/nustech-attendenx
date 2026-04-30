/**
 * Check-in Reminder Service
 * - Schedule local notification H-X menit sebelum jam mulai jadwal
 * - Data source: /schedules/me (office hours / shift)
 * - Settings disimpan di AsyncStorage (enabled, offset_minutes)
 * - Fire-and-forget: cancel-all lalu re-schedule untuk hindari duplikasi
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleService, getCurrentWeekString } from './schedule.service';

const SETTINGS_KEY = 'checkin_reminder_settings';
const NOTIF_PREFIX = 'checkin-reminder-';

export interface ReminderSettings {
  enabled: boolean;
  offset_minutes: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  offset_minutes: 15,
};

export const OFFSET_OPTIONS = [5, 10, 15, 30, 60] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return { ...DEFAULT_REMINDER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function setReminderSettings(
  patch: Partial<ReminderSettings>,
): Promise<ReminderSettings> {
  const current = await getReminderSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildTriggerDate(
  date: string,
  startTime: string,
  offsetMin: number,
): Date | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = startTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm || !tm) return null;
  const h = Number(tm[1]);
  const min = Number(tm[2]);
  const s = tm[3] ? Number(tm[3]) : 0;
  // Konstruksi timestamp WITA eksplisit (+08:00) — aman dari device timezone
  const witaBase = new Date(`${date}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}+08:00`);
  if (isNaN(witaBase.getTime())) return null;
  const trigger = new Date(witaBase.getTime() - offsetMin * 60_000);
  return isNaN(trigger.getTime()) ? null : trigger;
}

function getWeekStringFor(d: Date): string {
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = Math.floor(
    (d.getTime() - startW1.getTime()) / (7 * 24 * 3600 * 1000),
  );
  return `${year}-W${String(diff + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelAllCheckInReminders(): Promise<number> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    let count = 0;
    for (const n of all) {
      if (n.identifier?.startsWith(NOTIF_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
        count++;
      }
    }
    return count;
  } catch (e) {
    console.warn('[CheckinReminder] Gagal cancel:', e);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────────────────────────────────────────

export interface RescheduleResult {
  scheduled: number;
  skipped: number;
  reason?: string;
}

/**
 * Cancel semua reminder existing lalu re-schedule berdasarkan jadwal user
 * minggu ini + minggu depan. Idempotent — aman dipanggil berulang.
 */
export async function rescheduleCheckInReminders(): Promise<RescheduleResult> {
  try {
    const settings = await getReminderSettings();
    await cancelAllCheckInReminders();

    if (!settings.enabled) {
      return { scheduled: 0, skipped: 0, reason: 'disabled' };
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return { scheduled: 0, skipped: 0, reason: 'no_permission' };
    }

    const thisWeek = getCurrentWeekString();
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    const nextWeek = getWeekStringFor(nextDate);

    const [a, b] = await Promise.all([
      scheduleService.getMySchedule({ week: thisWeek }).catch(() => []),
      scheduleService.getMySchedule({ week: nextWeek }).catch(() => []),
    ]);
    const schedules = [...a, ...b];

    let scheduled = 0;
    let skipped = 0;
    const now = Date.now();

    for (const s of schedules) {
      if (s.is_holiday || s.is_day_off) { skipped++; continue; }
      if (!s.start_time) { skipped++; continue; }

      const trigger = buildTriggerDate(s.date, s.start_time, settings.offset_minutes);
      if (!trigger || trigger.getTime() <= now) { skipped++; continue; }

      const label =
        s.shift_type?.name ??
        (s.schedule_type === 'office_hours' ? 'Office Hours' : 'Shift');
      const hhmm = s.start_time.slice(0, 5);

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIF_PREFIX}${s.id}`,
          content: {
            title: 'Pengingat Check-in',
            body: `${label} mulai jam ${hhmm} — jangan lupa absen masuk.`,
            sound: 'default',
            data: {
              type: 'check_in_reminder',
              route: '/(main)/attendance',
              schedule_id: s.id,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
          },
        });
        scheduled++;
      } catch (e) {
        console.warn('[CheckinReminder] Gagal schedule item:', e);
        skipped++;
      }
    }

    return { scheduled, skipped };
  } catch (e) {
    console.warn('[CheckinReminder] Error:', e);
    return { scheduled: 0, skipped: 0, reason: 'error' };
  }
}

/**
 * Debug helper — list semua reminder yang sedang terschedule.
 */
export async function listScheduledReminders() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((n) => n.identifier?.startsWith(NOTIF_PREFIX));
  } catch {
    return [];
  }
}
