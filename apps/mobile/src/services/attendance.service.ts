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

export interface TeamAttendanceRecord {
  id: string;
  check_in_at: string;
  status: 'hadir' | 'terlambat' | 'dinas';
  user: {
    full_name: string;
    avatar_url: string | null;
    position?: { name: string } | null;
    department?: { name: string } | null;
  };
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

  getTeamToday(date: string): Promise<TeamAttendanceRecord[]> {
    return api.get<any[]>(`/attendance/admin/list?date=${date}`).then((r) =>
      (r.data as any[])
        .filter((a) => ['hadir', 'terlambat', 'dinas'].includes(a.status) && a.check_in_at)
        .sort((a, b) => new Date(a.check_in_at).getTime() - new Date(b.check_in_at).getTime())
        .map((a) => ({
          id: a.id as string,
          check_in_at: a.check_in_at as string,
          status: a.status as TeamAttendanceRecord['status'],
          user: {
            full_name: (a.user?.full_name ?? '—') as string,
            avatar_url: (a.user?.avatar_url ?? null) as string | null,
            position: a.user?.position ? { name: a.user.position.name as string } : null,
            department: a.user?.department ? { name: a.user.department.name as string } : null,
          },
        }))
    );
  },
};
