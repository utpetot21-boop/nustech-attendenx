import api from './api';
import type { CheckinMethod, CheckoutMethod, AttendanceStatus, ScheduleType } from '@nustech/shared';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  schedule_type: ScheduleType;
  shift_start: string | null;
  shift_end: string | null;
  tolerance_minutes: number;
  check_in_at: string | null;
  check_in_method: CheckinMethod | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_at: string | null;
  check_out_method: CheckoutMethod | null;
  checkout_earliest: string | null;
  status: AttendanceStatus;
  late_minutes: number;
  overtime_minutes: number;
  is_holiday_work: boolean;
  gps_valid?: boolean | null;
  check_out_gps_valid?: boolean | null;
  late_approved?: boolean;
  early_departure_approved?: boolean;
}

export interface CheckoutInfo {
  canCheckout: boolean;
  remainingSeconds: number;
  checkoutEarliest: string | null;
  checkedOut: boolean;
}

export interface OfficeGeofence {
  lat: number | null;
  lng: number | null;
  radius_meter: number;
  office_name: string;
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

  getMyOffice() {
    return api.get<OfficeGeofence>('/attendance/my-office').then((r) => r.data);
  },

  getHistory(params: { month?: string; from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.month) q.set('month', params.month);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return api.get<AttendanceRecord[]>(`/attendance/history?${q}`).then((r) => r.data);
  },
};
