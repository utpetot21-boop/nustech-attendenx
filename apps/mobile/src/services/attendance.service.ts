import api from './api';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  schedule_type: 'shift' | 'office_hours';
  shift_start: string | null;
  shift_end: string | null;
  tolerance_minutes: number;
  check_in_at: string | null;
  check_in_method: 'face_id' | 'fingerprint' | 'pin' | 'qr' | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_at: string | null;
  check_out_method: 'manual' | 'qr' | 'auto' | null;
  checkout_earliest: string | null;
  status: 'hadir' | 'terlambat' | 'alfa' | 'izin' | 'sakit' | 'dinas';
  late_minutes: number;
  overtime_minutes: number;
  is_holiday_work: boolean;
}

export interface CheckoutInfo {
  canCheckout: boolean;
  remainingSeconds: number;
  checkoutEarliest: string | null;
  checkedOut: boolean;
}

export const attendanceService = {
  checkIn(payload: { method: string; lat: number | null; lng: number | null; device_id?: string; notes?: string }) {
    return api.post<AttendanceRecord>('/attendance/check-in', payload).then((r) => r.data);
  },

  checkOut(payload: { method: 'manual' | 'qr'; lat?: number; lng?: number }) {
    return api.post<AttendanceRecord>('/attendance/check-out', payload).then((r) => r.data);
  },

  getToday() {
    return api.get<AttendanceRecord | null>('/attendance/today').then((r) => r.data);
  },

  getCheckoutInfo() {
    return api.get<CheckoutInfo>('/attendance/checkout-info').then((r) => r.data);
  },

  getHistory(params: { month?: string; from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.month) q.set('month', params.month);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return api.get<AttendanceRecord[]>(`/attendance/history?${q}`).then((r) => r.data);
  },
};
