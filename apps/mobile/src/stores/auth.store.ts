import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { queryClient } from '@/services/query-client';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  employee_id: string;
  role: {
    name: string;
    can_approve?: boolean;
    can_delegate?: boolean;
    permissions?: string[] | null;
  };
  position?: { id: string; name: string } | null;
  department_id?: string | null;
  avatar_url?: string | null;
  must_change_password?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,

  setUser: (user) => set({ user }),

  updateUser: async (patch) => {
    const next = get().user ? { ...get().user!, ...patch } : null;
    set({ user: next });
    if (next) await SecureStore.setItemAsync('user', JSON.stringify(next));
  },

  loadUser: async () => {
    try {
      const raw = await SecureStore.getItemAsync('user');
      if (raw) set({ user: JSON.parse(raw) as AuthUser });
    } catch {
      set({ user: null });
    }
  },

  logout: async () => {
    // 1) Hapus credential + token cache di SecureStore
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync('posted_fcm_token'),
      SecureStore.deleteItemAsync('expo_push_token'),
    ]);

    // 2) Clear React Query cache — jangan sampai data user sebelumnya
    // (tasks, leave balance, notifications, dll.) bocor ke user berikutnya
    // di device yang sama.
    queryClient.clear();

    // 3) Bersihkan foto/signature/attachment di cache directory (best-effort).
    // expo-file-system menyimpan foto kunjungan di cacheDirectory sebagai
    // temp file sebelum upload. Kalau logout sebelum upload tuntas, file
    // bisa tertinggal — hapus agar tidak bocor ke user berikut.
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const entries = await FileSystem.readDirectoryAsync(cacheDir).catch(() => [] as string[]);
        await Promise.all(
          entries.map((name) =>
            FileSystem.deleteAsync(cacheDir + name, { idempotent: true }).catch(() => null),
          ),
        );
      }
    } catch {
      // Gagal bersih-bersih cache tidak boleh block logout
    }

    set({ user: null });
  },
}));
