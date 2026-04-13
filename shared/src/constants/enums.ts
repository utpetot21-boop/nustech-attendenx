// Re-export semua constants sebagai enums yang mudah dipakai
export * from './roles';
export * from './status';

// ── Work Days ─────────────────────────────────────────────────
export const WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type WorkDay = (typeof WORK_DAYS)[number];

// ── Platform ──────────────────────────────────────────────────
export const PLATFORM = {
  ANDROID: 'android',
  IOS: 'ios',
} as const;

export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

// ── Password Reset Channel ────────────────────────────────────
export const RESET_CHANNEL = {
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
} as const;

export type ResetChannel = (typeof RESET_CHANNEL)[keyof typeof RESET_CHANNEL];

// ── Checkout Method ───────────────────────────────────────────
export const CHECKOUT_METHOD = {
  MANUAL: 'manual',
  AUTO: 'auto',
} as const;

export type CheckoutMethod = (typeof CHECKOUT_METHOD)[keyof typeof CHECKOUT_METHOD];

// ── Konstanta Bisnis ──────────────────────────────────────────
export const BUSINESS_CONSTANTS = {
  SHIFT_DURATION_MINUTES: 480,        // 8 jam WAJIB — tidak bisa diubah
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_EXPIRES: '7d',
  GEOFENCE_DEFAULT_RADIUS: 100,       // meter
  CLIENT_GEOFENCE_DEFAULT: 200,       // meter
  CHECKIN_CONFIRM_WINDOW_MINUTES: 10, // toleransi QR/GPS
  TASK_CONFIRM_TIMEOUT_MINUTES: 15,   // timeout konfirmasi tugas
  MAX_PHOTO_SIZE_MB: 5,
  PHOTO_QUALITY: 0.8,
  WATERMARK_FONT_SIZE: 14,
  GPS_PRECISION: 6,                   // desimal koordinat
  PIN_LENGTH: 6,
  OTP_EXPIRES_MINUTES: 15,
} as const;
