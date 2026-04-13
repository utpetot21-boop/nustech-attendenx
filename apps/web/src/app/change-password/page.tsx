'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

const schema = z
  .object({
    current_password: z.string().min(1, 'Password lama wajib diisi'),
    new_password: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      .regex(/[A-Z]/, 'Harus mengandung huruf kapital')
      .regex(/[0-9]/, 'Harus mengandung angka'),
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await apiClient.post('/auth/change-password', {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Gagal mengganti password'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ganti Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Anda wajib mengganti password sebelum melanjutkan
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {success ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-semibold">Password berhasil diganti!</p>
              <p className="text-sm text-gray-500 mt-1">Mengalihkan ke dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Password Lama
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm bg-white border outline-none transition
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                    ${errors.current_password ? 'border-red-400' : 'border-gray-200'}`}
                  {...register('current_password')}
                />
                {errors.current_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.current_password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Password Baru
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 karakter, huruf kapital, angka"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm bg-white border outline-none transition
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                    ${errors.new_password ? 'border-red-400' : 'border-gray-200'}`}
                  {...register('new_password')}
                />
                {errors.new_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm bg-white border outline-none transition
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                    ${errors.confirm_password ? 'border-red-400' : 'border-gray-200'}`}
                  {...register('confirm_password')}
                />
                {errors.confirm_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white
                  bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
                  transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Memproses...' : 'Ganti Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
