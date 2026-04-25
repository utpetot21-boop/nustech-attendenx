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

export interface AttendanceRequestAdmin extends AttendanceRequest {
  user?: { id: string; full_name: string; avatar_url?: string | null };
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

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Jumlah permohonan pending (badge) */
  adminPendingCount() {
    return api.get<{ count: number }>('/attendance-requests/admin/pending-count').then((r) => r.data.count);
  },

  /** Daftar semua permohonan (admin) */
  adminList(params: { status?: string; type?: string; date?: string; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.type)   q.set('type',   params.type);
    if (params.date)   q.set('date',   params.date);
    if (params.page)   q.set('page',   String(params.page));
    return api
      .get<{ items: AttendanceRequestAdmin[]; total: number } | AttendanceRequestAdmin[]>(
        `/attendance-requests/admin/list?${q}`,
      )
      .then((r) => (Array.isArray(r.data) ? r.data : (r.data as { items: AttendanceRequestAdmin[] }).items ?? []));
  },

  /** Setujui permohonan */
  approve(id: string, note?: string) {
    return api.post(`/attendance-requests/${id}/approve`, { note }).then((r) => r.data);
  },

  /** Tolak permohonan */
  reject(id: string, note?: string) {
    return api.post(`/attendance-requests/${id}/reject`, { note }).then((r) => r.data);
  },
};
