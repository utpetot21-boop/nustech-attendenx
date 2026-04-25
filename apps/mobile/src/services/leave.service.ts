import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeaveType   = 'cuti' | 'izin' | 'sakit' | 'dinas';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveStatus;
  reject_reason?: string | null;
  attachment_url?: string | null;
  created_at: string;
  user?: { id: string; full_name: string };
}

export interface LeaveBalance {
  balance_days: number;
  used_days: number;
  accrued_monthly: number;
  year: number;
}

export interface CreateLeaveDto {
  type: LeaveType;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  reason: string;
  attachment_url?: string;
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  cuti:  'Cuti Tahunan',
  izin:  'Izin',
  sakit: 'Sakit',
  dinas: 'Dinas',
};

export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  cuti:  '#007AFF',
  izin:  '#AF52DE',
  sakit: '#FF9500',
  dinas: '#34C759',
};

// ── Service ───────────────────────────────────────────────────────────────────

export const leaveService = {
  /** Saldo cuti milik user yang sedang login */
  getMyBalance: async (year?: number): Promise<LeaveBalance> => {
    const params = year ? { year } : undefined;
    const res = await api.get('/leave/balance/me', { params });
    return res.data;
  },

  /** Daftar pengajuan milik user yang sedang login */
  getMyRequests: async (status?: LeaveStatus): Promise<LeaveRequest[]> => {
    const params = status ? { status, limit: 50 } : { limit: 50 };
    const res = await api.get('/leave/requests', { params });
    // API returns { items, total } — ambil items saja
    return res.data?.items ?? res.data ?? [];
  },

  /** Ajukan cuti / izin baru */
  create: async (dto: CreateLeaveDto): Promise<LeaveRequest> => {
    const res = await api.post('/leave/requests', dto);
    return res.data;
  },

  /** Upload lampiran (surat, foto dokumen) — return public URL */
  uploadAttachment: async (uri: string, mimeType: string): Promise<string> => {
    const form = new FormData();
    const ext  = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
    form.append('file', { uri, name: `attachment.${ext}`, type: mimeType } as any);
    const res = await api.post('/leave/requests/upload-attachment', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url as string;
  },

  /** Batalkan pengajuan (jika backend sudah ada endpoint-nya) */
  cancel: async (id: string): Promise<void> => {
    await api.patch(`/leave/requests/${id}/cancel`);
  },

  /** Semua pengajuan untuk approver (tanpa filter user_id) */
  getPendingForApprover: async (status?: LeaveStatus | 'all'): Promise<LeaveRequest[]> => {
    const params: Record<string, string> = { limit: '50' };
    if (status && status !== 'all') params.status = status;
    const res = await api.get('/leave/requests', { params });
    return res.data?.items ?? res.data ?? [];
  },

  /** Setujui pengajuan cuti/izin */
  approve: async (id: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/approve`);
  },

  /** Tolak pengajuan cuti/izin dengan alasan */
  rejectRequest: async (id: string, reason: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/reject`, { reason });
  },
};
