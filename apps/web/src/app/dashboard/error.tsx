'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-8 max-w-sm w-full text-center border border-black/[0.05] dark:border-white/[0.08] shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-[#FF3B30]" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Halaman Bermasalah
        </h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-6 leading-relaxed">
          Terjadi kesalahan saat memuat halaman ini. Data Anda aman — ini adalah masalah tampilan saja.
        </p>
        {/* Error detail — untuk debugging, hapus setelah masalah teridentifikasi */}
        {error?.message && (
          <p className="text-[11px] font-mono text-red-400 mb-2 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-xl text-left break-all">
            {error.message}
          </p>
        )}
        {error?.digest && (
          <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mb-4 bg-gray-100 dark:bg-white/[0.06] px-3 py-1.5 rounded-xl">
            ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] text-white text-sm font-semibold transition"
          >
            <RefreshCw size={14} />
            Coba Lagi
          </button>
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold transition hover:bg-gray-200 dark:hover:bg-[#3A3A3C]"
          >
            <Home size={14} />
            Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
