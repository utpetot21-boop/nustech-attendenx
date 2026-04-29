/**
 * Shared notification routing map.
 * Single source of truth — digunakan oleh _layout.tsx (push tap) dan notifications.tsx (in-app tap).
 * Sentinels (string bukan route) ditangani secara manual di setiap consumer.
 */

export const ATTENDANCE_HISTORY_SENTINEL = '__attendance_history__';
export const ANN_TAB_SENTINEL            = '__ann__';

/** Tipe notifikasi task yang membawa task_id di payload data — di-route langsung ke detail */
export const TASK_DEEP_LINK_TYPES = new Set([
  'task_assigned',
  'task_accepted',
  'task_rejected',
  'task_cancelled',
  'task_on_hold',
  'task_hold_approved',
  'task_hold_rejected',
  'delegation_request',
  'delegation_rejected',
  'sla_breach',
  'ba_generated',
]);

export const NOTIF_ROUTE_MAP: Record<string, string> = {
  // Tukar Jadwal
  swap_request_received:           '/(main)/schedule-swap',
  swap_request_accepted_by_target: '/(main)/schedule-swap',
  swap_request_approved:           '/(main)/schedule-swap',
  swap_request_rejected:           '/(main)/schedule-swap',
  swap_request_admin:              '/(main)/schedule-swap',
  // Cuti & Izin
  leave_request:                   '/(main)/leave-requests-admin',
  leave_approved:                  '/(main)/leave',
  leave_rejected:                  '/(main)/leave',
  leave_expiry_reminder:           '/(main)/leave',
  collective_leave_deduction:      '/(main)/leave',
  // Absensi check-in/out
  check_in_success:                '/(main)/attendance',
  check_out_success:               '/(main)/attendance',
  overtime_exceeded:               '/(main)/attendance-history',
  // Absensi permohonan
  sp_reminder:                     '/(main)/attendance',
  alfa_detected:                   '/(main)/attendance',
  late_arrival_approved:           ATTENDANCE_HISTORY_SENTINEL,
  late_arrival_rejected:           ATTENDANCE_HISTORY_SENTINEL,
  early_departure_approved:        ATTENDANCE_HISTORY_SENTINEL,
  early_departure_rejected:        ATTENDANCE_HISTORY_SENTINEL,
  attendance_request_submitted:    '/(main)/attendance-requests-admin',
  attendance_request_approved:     ATTENDANCE_HISTORY_SENTINEL,
  attendance_request_rejected:     ATTENDANCE_HISTORY_SENTINEL,
  // Klaim Biaya
  expense_claim_submitted:         '/(main)/expense-claims',
  expense_claim_approved:          '/(main)/expense-claims',
  expense_claim_rejected:          '/(main)/expense-claims',
  expense_claim_paid:              '/(main)/expense-claims',
  // FYI
  leave_fyi:                       '/(main)/leave-requests-admin',
  attendance_request_fyi:          '/(main)/attendance-requests-admin',
  expense_claim_fyi:               '/(main)/expense-claims',
  // Tugas — deep link ke detail via task_id di data payload
  task_assigned:                   '/(main)/tasks',
  task_accepted:                   '/(main)/tasks',
  task_rejected:                   '/(main)/tasks',
  task_cancelled:                  '/(main)/tasks',
  sla_breach:                      '/(main)/tasks',
  task_on_hold:                    '/(main)/tasks',
  task_hold_approved:              '/(main)/tasks',
  task_hold_rejected:              '/(main)/tasks',
  delegation_request:              '/(main)/tasks',
  delegation_rejected:             '/(main)/tasks',
  // Kunjungan / Visit review
  visit_reviewed:                  '/(main)/tasks',
  visit_revision_submitted:        '/(main)/tasks',
  // Berita Acara
  ba_generated:                    '/(main)/service-reports',
  // SOS
  sos:                             '/(main)/sos',
  sos_alert:                       '/(main)/sos-alert',
  // Pengumuman
  announcement_approved:           ANN_TAB_SENTINEL,
  announcement_rejected:           ANN_TAB_SENTINEL,
  announcement_pending:            ANN_TAB_SENTINEL,
};
