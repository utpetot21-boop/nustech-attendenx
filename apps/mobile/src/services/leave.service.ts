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

  /** Batalkan pengajuan (jika backend sudah ada endpoint-nya) */
  cancel: async (id: string): Promise<void> => {
    await api.patch(`/leave/requests/${id}/cancel`);
  },
};
