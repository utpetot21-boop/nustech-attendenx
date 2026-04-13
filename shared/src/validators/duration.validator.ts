import { BUSINESS_CONSTANTS } from '../constants/enums';

const REQUIRED_MINUTES = BUSINESS_CONSTANTS.SHIFT_DURATION_MINUTES; // 480

/**
 * Hitung durasi shift dalam menit, support lintas tengah malam
 * Contoh: 22:00 → 06:00 = 480 menit (valid)
 */
export function calculateShiftDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    // Lintas tengah malam
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

/**
 * Validasi bahwa shift/office hours tepat 8 jam (480 menit)
 */
export function validateShiftDuration(
  startTime: string,
  endTime: string,
): { valid: boolean; minutes: number; error?: string } {
  const minutes = calculateShiftDuration(startTime, endTime);

  if (minutes !== REQUIRED_MINUTES) {
    return {
      valid: false,
      minutes,
      error: `Durasi shift harus tepat ${REQUIRED_MINUTES} menit (8 jam). Durasi saat ini: ${minutes} menit.`,
    };
  }

  return { valid: true, minutes };
}

/**
 * Hitung waktu checkout paling awal (check_in + 8 jam)
 */
export function getCheckoutEarliest(checkInAt: Date): Date {
  const earliest = new Date(checkInAt);
  earliest.setMinutes(earliest.getMinutes() + REQUIRED_MINUTES);
  return earliest;
}

/**
 * Cek apakah sudah boleh checkout
 */
export function canCheckout(checkInAt: Date, now: Date = new Date()): boolean {
  return now >= getCheckoutEarliest(checkInAt);
}

/**
 * Sisa waktu sebelum boleh checkout (dalam detik)
 */
export function getRemainingSeconds(checkInAt: Date, now: Date = new Date()): number {
  const earliest = getCheckoutEarliest(checkInAt);
  const remaining = earliest.getTime() - now.getTime();
  return Math.max(0, Math.floor(remaining / 1000));
}
