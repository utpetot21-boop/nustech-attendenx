import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { getToken, setToken, clearAuthData } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Kirim HTTP-only cookie secara otomatis
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Lampirkan access_token dari memory sebagai Authorization header.
// Jika token hilang (page reload), cookie HTTP-only tetap dikirim otomatis.
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor (auto refresh token) ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Refresh token dikirim otomatis via HTTP-only cookie (withCredentials: true)
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        if (typeof data?.access_token !== 'string' || data.access_token.length === 0) {
          throw new Error('Invalid refresh response');
        }

        // Simpan ke memory — request interceptor akan memakai ini pada retry
        setToken(data.access_token);
        return api(originalRequest);
      } catch {
        clearAuthData();
        if (typeof window !== 'undefined') {
          window.location.replace('/login');
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export const apiClient = api;
