import api from './api';

export type AttendanceRequestType   = 'late_arrival' | 'early_departure';
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AttendanceRequest {
  id: string;
  user_id: string;
  date: string;
  type: AttendanceRequestType;
  reason: string;
  estimated_time: string | null;
  status: AttendanceRequestStatus;
  reviewed_by: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const attendanceRequestsService = {
  /** Ajukan izin terlambat atau izin pulang awal */
  submit(payload: {
    type: AttendanceRequestType;
    reason: string;
    estimated_time?: string;
  }) {
    return api.post<AttendanceRequest>('/attendance-requests', payload).then((r) => r.data);
  },

  /** Permohonan saya hari ini (untuk cek status di home screen) */
  getMyToday() {
    return api.get<AttendanceRequest[]>('/attendance-requests/my/today').then((r) => r.data);
  },

  /** Riwayat permohonan saya */
  getMyRequests(params: { date?: string; type?: string } = {}) {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.type) q.set('type', params.type);
    return api.get<AttendanceRequest[]>(`/attendance-requests/my?${q}`).then((r) => r.data);
  },
};
