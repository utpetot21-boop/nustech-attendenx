import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  employee_id: string;
  role: { name: string };
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
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
      SecureStore.deleteItemAsync('user'),
    ]);
    set({ user: null });
  },
}));
