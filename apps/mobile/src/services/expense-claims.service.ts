import { api as apiClient } from './api';

export interface ExpenseClaim {
  id: string;
  claim_number: string | null;
  category: string;
  amount: number;
  description: string | null;
  receipt_urls: string[];
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  review_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  visit_id: string | null;
  user?: { full_name: string };
}

export interface ExpenseConfig {
  id: string;
  category: string;
  max_amount: number;
  receipt_required_above: number;
  is_active: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  transport:  'Transport',
  parkir:     'Parkir',
  material:   'Material',
  konsumsi:   'Konsumsi',
  akomodasi:  'Akomodasi',
  lainnya:    'Lainnya',
};

export async function getConfig(): Promise<ExpenseConfig[]> {
  const res = await apiClient.get('/expense-claims/config');
  return res.data;
}

export async function uploadReceipt(imageUri: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: imageUri, type: 'image/jpeg', name: 'receipt.jpg' } as any);
  const res = await apiClient.post('/expense-claims/upload-receipt', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}

export async function createClaim(data: {
  category: string;
  amount: number;
  description?: string;
  receipt_urls: string[];
  visit_id?: string;
}): Promise<ExpenseClaim> {
  const res = await apiClient.post('/expense-claims', data);
  return res.data;
}

export async function getMyClaims(status?: string): Promise<ExpenseClaim[]> {
  const params = status ? `?status=${status}` : '';
  const res = await apiClient.get(`/expense-claims/me${params}`);
  return res.data;
}

export function formatRupiah(amount: number | null | undefined): string {
  // L6: guard null/undefined — cegah "Rp NaN" di UI
  if (amount == null || isNaN(amount)) return 'Rp —';
  return `Rp ${amount.toLocaleString('id-ID')}`;
}
