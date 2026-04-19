import axios, { type AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth.store';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

// Production build WAJIB HTTPS. Dev build boleh HTTP ke localhost untuk testing.
// Kalau env var tidak di-set di production → hard-fail supaya bug tidak lolos.
if (!ENV_API_URL && !__DEV__) {
  throw new Error(
    'EXPO_PUBLIC_API_URL tidak di-set di production build. ' +
      'Tambahkan EXPO_PUBLIC_API_URL=https://... ke environment EAS build.',
  );
}
if (ENV_API_URL && !__DEV__ && !ENV_API_URL.startsWith('https://')) {
  throw new Error(
    'EXPO_PUBLIC_API_URL di production wajib HTTPS. Current: ' + ENV_API_URL,
  );
}

const API_BASE_URL = ENV_API_URL || 'http://localhost:3001/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Request interceptor ───────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Token refresh lock — mencegah race condition ──────────────
// Jika 2+ request 401 terjadi bersamaan, hanya 1 refresh yang dikirim.
// Request lainnya menunggu promise yang sama.
let refreshPromise: Promise<string> | null = null;

// ── Response interceptor (auto refresh + logout on expire) ───
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Satu refresh untuk semua request yang pending 401 bersamaan
        if (!refreshPromise) {
          refreshPromise = (async (): Promise<string> => {
            try {
              const refreshToken = await SecureStore.getItemAsync('refresh_token');
              if (!refreshToken) throw new Error('no_refresh_token');

              const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });

              await SecureStore.setItemAsync('access_token', data.access_token);
              return data.access_token as string;
            } catch (err) {
              // Refresh gagal (token expired / revoked) → logout & redirect ke login
              // AuthGuard di _layout.tsx otomatis redirect saat user menjadi null
              await useAuthStore.getState().logout();
              throw err;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh sudah gagal dan logout sudah dipanggil — tolak request ini
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
