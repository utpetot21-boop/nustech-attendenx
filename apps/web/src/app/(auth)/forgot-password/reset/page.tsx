'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';

import { apiClient } from '@/lib/api';

const schema = z.object({
  new_password: z
    .string()
    .min(8, 'Minimal 8 karakter')
    .regex(/[A-Z]/, 'Harus mengandung 1 huruf kapital')
    .regex(/\d/, 'Harus mengandung 1 angka'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirm_password'],
});

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('fp_reset_token');
    if (!token) router.replace('/forgot-password');
  }, [router]);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    const reset_token = sessionStorage.getItem('fp_reset_token');
    if (!reset_token) { router.replace('/forgot-password'); return; }

    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/reset-password', {
        reset_token,
        new_password: data.new_password,
      });
      sessionStorage.removeItem('fp_reset_token');
      setSuccess(true);
    } catch {
      setError('Token tidak valid atau sudah kadaluarsa. Ulangi proses reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2.5 rounded-xl text-sm bg-white/85 dark:bg-white/10
    border dark:border-white/18 outline-none transition
    text-light-text-primary dark:text-white
    placeholder:text-light-text-hint dark:placeholder:text-white/35
    focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20
    ${hasError ? 'border-ios-red' : 'border-black/10'}`;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg-login p-4">
        <div className="absolute inset-0 dark:block hidden bg-dark-login -z-10" />
        <div className="w-full max-w-sm">
          <div className="content-card-light dark:content-card-dark rounded-2xl p-8 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-primary dark:text-white">Password Berhasil Diubah!</h2>
              <p className="text-sm text-light-text-secondary dark:text-white/60 mt-2">
                Silakan login dengan password baru Anda.
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-12 rounded-xl font-semibold text-sm text-white
                bg-ios-blue hover:bg-ios-blue/90 transition-all
                shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_10px_rgba(0,122,255,0.3)]"
            >
              Ke Halaman Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg-login p-4">
      <div className="absolute inset-0 dark:block hidden bg-dark-login -z-10" />

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ios-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <KeyRound className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-white">
            Buat Password Baru
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-white/60 mt-1">
            Minimal 8 karakter, 1 huruf kapital, 1 angka
          </p>
        </div>

        <div className="content-card-light dark:content-card-dark rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="card-tint-red rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-white/60 mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={inputCls(!!errors.new_password) + ' pr-10'}
                  {...register('new_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-hint dark:text-white/40"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.new_password && (
                <p className="text-xs text-ios-red mt-1">{errors.new_password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-white/60 mb-1.5">
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={inputCls(!!errors.confirm_password) + ' pr-10'}
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-hint dark:text-white/40"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs text-ios-red mt-1">{errors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl font-semibold text-sm text-white
                bg-ios-blue hover:bg-ios-blue/90 active:scale-[0.98]
                transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_10px_rgba(0,122,255,0.3)]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Menyimpan...
                </span>
              ) : 'Simpan Password Baru'}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-ios-blue hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}
