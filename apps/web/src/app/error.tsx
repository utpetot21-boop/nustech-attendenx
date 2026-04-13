'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-8 max-w-sm w-full text-center border border-black/[0.05] dark:border-white/[0.08] shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-[#FF3B30]" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Terjadi Kesalahan
        </h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-6 leading-relaxed">
          Aplikasi mengalami masalah yang tidak terduga. Silakan coba lagi atau muat ulang halaman.
        </p>
        {error?.digest && (
          <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mb-4 bg-gray-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-xl">
            ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] text-white text-sm font-semibold transition"
        >
          <RefreshCw size={15} />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
