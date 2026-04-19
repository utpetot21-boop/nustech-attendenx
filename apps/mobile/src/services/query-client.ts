import { QueryClient } from '@tanstack/react-query';

// Singleton QueryClient — dibagi antara _layout.tsx (provider) dan
// auth.store.ts (logout() memanggil .clear() untuk bersihkan cache sensitif).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});
