import api from './api';

export type WarningLevel = 'SP1' | 'SP2' | 'SP3';

export interface WarningLetter {
  id: string;
  user_id: string;
  level: WarningLevel;
  reason: string;
  reference_violation_id: string | null;
  issued_by: string;
  issued_at: string;         // YYYY-MM-DD
  valid_until: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  doc_url: string | null;
  notes: string | null;
  created_at: string;
  user?: { id: string; full_name: string };
  issuer?: { id: string; full_name: string };
  reference_violation?: {
    id: string;
    violation_type?: string;
    severity?: string;
    date?: string;
  } | null;
}

export const WARNING_LEVEL_LABELS: Record<WarningLevel, string> = {
  SP1: 'Surat Peringatan 1',
  SP2: 'Surat Peringatan 2',
  SP3: 'Surat Peringatan 3',
};

export const WARNING_LEVEL_COLORS: Record<WarningLevel, string> = {
  SP1: '#FF9500',
  SP2: '#FF3B30',
  SP3: '#AF52DE',
};

export const warningLettersService = {
  getMine: () => api.get<WarningLetter[]>('/warning-letters/me').then((r) => r.data),

  getOne: (id: string) => api.get<WarningLetter>(`/warning-letters/${id}`).then((r) => r.data),

  acknowledge: (id: string) =>
    api.post<WarningLetter>(`/warning-letters/${id}/acknowledge`).then((r) => r.data),

  getPdfUrl: (id: string) =>
    api.get<{ url: string }>(`/warning-letters/${id}/pdf`).then((r) => r.data),
};
