import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SwapType   = 'with_person' | 'with_own_dayoff';
export type SwapStatus = 'pending_target' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';

export interface SwapRequest {
  id: string;
  type: SwapType;
  status: SwapStatus;
  requester_date: string;
  target_date: string;
  notes?: string | null;
  reject_reason?: string | null;
  created_at: string;
  requester?: { id: string; full_name: string };
  target_user?: { id: string; full_name: string } | null;
  requester_shift?: { name: string; start_time: string; end_time: string } | null;
  target_shift?: { name: string; start_time: string; end_time: string } | null;
}

export interface CreateSwapDto {
  type: SwapType;
  requester_date: string;   // YYYY-MM-DD — tanggal kerja pemohon
  target_date: string;      // YYYY-MM-DD — tanggal target
  target_user_id?: string;  // wajib untuk with_person
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const scheduleSwapService = {
  /** Daftar swap milik user yang sedang login (requester atau target) */
  getMyRequests: async (status?: SwapStatus): Promise<{ items: SwapRequest[]; total: number }> => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const res = await api.get('/schedule-swap/requests', { params });
    return res.data;
  },

  /** Ajukan permintaan tukar jadwal */
  create: async (dto: CreateSwapDto): Promise<SwapRequest> => {
    const res = await api.post('/schedule-swap/requests', dto);
    return res.data;
  },

  /** Target user: setujui atau tolak */
  respond: async (id: string, approved: boolean, reason?: string): Promise<SwapRequest> => {
    const res = await api.post(`/schedule-swap/requests/${id}/respond`, { approved, reason });
    return res.data;
  },

  /** Requester: batalkan sebelum dieksekusi */
  cancel: async (id: string): Promise<void> => {
    await api.post(`/schedule-swap/requests/${id}/cancel`);
  },
};

// ── Labels ────────────────────────────────────────────────────────────────────

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  pending_target: 'Menunggu Rekan',
  pending_admin:  'Menunggu Admin',
  approved:       'Disetujui',
  rejected:       'Ditolak',
  cancelled:      'Dibatalkan',
};

export const SWAP_STATUS_COLORS: Record<SwapStatus, string> = {
  pending_target: '#007AFF',
  pending_admin:  '#FF9500',
  approved:       '#34C759',
  rejected:       '#FF3B30',
  cancelled:      '#8E8E93',
};
