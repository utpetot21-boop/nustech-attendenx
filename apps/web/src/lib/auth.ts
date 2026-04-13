import { apiClient } from './api';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  role: { name: string; permissions: string[] };
  department_id: string | null;
  location_id: string | null;
  schedule_type: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  require_password_change: boolean;
  user: AuthUser;
}

// ── In-memory token store ──────────────────────────────────────────────────────
// Token disimpan di memory (bukan localStorage) untuk mencegah XSS theft.
// HTTP-only cookie yang dikirim backend menjadi source of truth.
// Saat page reload → token hilang dari memory → request pertama akan 401 →
// refresh interceptor di api.ts otomatis call /auth/refresh → token di-restore.
let _accessToken: string | null = null;

export function getToken(): string | null {
  return _accessToken;
}

export function setToken(token: string): void {
  _accessToken = token;
}

export function clearToken(): void {
  _accessToken = null;
}

// ── Auth user (localStorage — hanya untuk display UI, bukan security) ──────────
export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_user', JSON.stringify(user));
}

// ── Clear semua data auth client-side ─────────────────────────────────────────
export function clearAuthData(): void {
  clearToken();
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_user');
  // Legacy cleanup — hapus jika masih ada dari versi lama
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// ── Derived helpers ────────────────────────────────────────────────────────────
export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    clearAuthData();
  }
}
