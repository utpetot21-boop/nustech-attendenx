// ── Attendance Status ────────────────────────────────────────
export const ATTENDANCE_STATUS = {
  HADIR: 'hadir',
  TERLAMBAT: 'terlambat',
  ALFA: 'alfa',
  IZIN: 'izin',
  SAKIT: 'sakit',
  DINAS: 'dinas',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

// ── Check-in Method ──────────────────────────────────────────
export const CHECKIN_METHOD = {
  FACE_ID: 'face_id',
  FINGERPRINT: 'fingerprint',
  PIN: 'pin',
  QR: 'qr',
  GPS: 'gps',
} as const;

export type CheckinMethod = (typeof CHECKIN_METHOD)[keyof typeof CHECKIN_METHOD];

// ── Check-out Method ─────────────────────────────────────────
export const CHECKOUT_METHOD = {
  FACE_ID: 'face_id',
  FINGERPRINT: 'fingerprint',
  PIN: 'pin',
  GPS: 'gps',
  MANUAL: 'manual',
} as const;

export type CheckoutMethod = (typeof CHECKOUT_METHOD)[keyof typeof CHECKOUT_METHOD];

// ── Leave Type ───────────────────────────────────────────────
export const LEAVE_TYPE = {
  CUTI: 'cuti',
  IZIN: 'izin',
  SAKIT: 'sakit',
  DINAS: 'dinas',
} as const;

export type LeaveType = (typeof LEAVE_TYPE)[keyof typeof LEAVE_TYPE];

// ── Leave Request Status ─────────────────────────────────────
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

// ── Task Status ──────────────────────────────────────────────
export const TASK_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// ── Task Priority ─────────────────────────────────────────────
export const TASK_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

// ── Visit Status ─────────────────────────────────────────────
export const VISIT_STATUS = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
} as const;

export type VisitStatus = (typeof VISIT_STATUS)[keyof typeof VISIT_STATUS];

// ── Visit Photo Phase ─────────────────────────────────────────
export const VISIT_PHOTO_PHASE = {
  ARRIVAL: 'arrival',
  WORK: 'work',
  COMPLETION: 'completion',
} as const;

export type VisitPhotoPhase = (typeof VISIT_PHOTO_PHASE)[keyof typeof VISIT_PHOTO_PHASE];

// ── Schedule Type ─────────────────────────────────────────────
export const SCHEDULE_TYPE = {
  SHIFT: 'shift',
  OFFICE_HOURS: 'office_hours',
} as const;

export type ScheduleType = (typeof SCHEDULE_TYPE)[keyof typeof SCHEDULE_TYPE];

// ── Notification Channel ──────────────────────────────────────
export const NOTIF_CHANNEL = {
  PUSH: 'push',
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
} as const;

export type NotifChannel = (typeof NOTIF_CHANNEL)[keyof typeof NOTIF_CHANNEL];

// ── Leave Balance Log Type ─────────────────────────────────────
export const LEAVE_LOG_TYPE = {
  ACCRUAL_MONTHLY: 'accrual_monthly',
  ACCRUAL_HOLIDAY: 'accrual_holiday',
  USED: 'used',
  EXPIRED: 'expired',
  ALFA_DEDUCTION: 'alfa_deduction',
  ACCRUAL_SKIPPED: 'accrual_skipped',
  OBJECTION_CANCEL: 'objection_cancel',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  COLLECTIVE_LEAVE_DEDUCTION: 'collective_leave_deduction',
} as const;

export type LeaveLogType = (typeof LEAVE_LOG_TYPE)[keyof typeof LEAVE_LOG_TYPE];

// ── Delegation Status ─────────────────────────────────────────
export const DELEGATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export type DelegationStatus = (typeof DELEGATION_STATUS)[keyof typeof DELEGATION_STATUS];
