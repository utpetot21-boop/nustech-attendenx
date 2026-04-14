'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { setToken, setAuthUser, type LoginResponse } from '@/lib/auth';
import { getAuthErrorMessage } from '@/lib/errors';

// ── Zod Schema ────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', data);
      const { access_token, require_password_change } = res.data;

      // Token di-memory (tidak di localStorage) — HTTP-only cookie dikirim backend
      setToken(access_token);
      setAuthUser(res.data.user);

      // Jika harus ganti password
      if (require_password_change) {
        router.push('/change-password');
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, 'Email atau password salah'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg-login p-4">
      {/* Dark mode: animated gradient background */}
      <div className="absolute inset-0 dark:block hidden bg-dark-login -z-10" />

      <div className="w-full max-w-sm">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ios-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-white">
            Nustech-AttendenX
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-white/60 mt-1">
            Sistem Absensi & Monitoring Lapangan
          </p>
        </div>

        {/* Card Login */}
        <div className="content-card-light dark:content-card-dark rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-light-text-primary dark:text-white mb-6">
            Masuk ke Akun
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Error banner */}
            {error && (
              <div className="card-tint-red rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-white/60 mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="email@perusahaan.id"
                className={`w-full px-3 py-2.5 rounded-xl text-sm bg-white/85 dark:bg-white/10
                  border dark:border-white/18 outline-none transition
                  text-light-text-primary dark:text-white
                  placeholder:text-light-text-hint dark:placeholder:text-white/35
                  focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20
                  ${errors.email ? 'border-ios-red' : 'border-black/10'}`}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-ios-red mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-white/60 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full px-3 py-2.5 pr-10 rounded-xl text-sm bg-white/85 dark:bg-white/10
                    border dark:border-white/18 outline-none transition
                    text-light-text-primary dark:text-white
                    placeholder:text-light-text-hint dark:placeholder:text-white/35
                    focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20
                    ${errors.password ? 'border-ios-red' : 'border-black/10'}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-hint dark:text-white/40"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-ios-red mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-ios-blue hover:underline"
              >
                Lupa Password?
              </Link>
            </div>

            {/* Submit */}
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
                  Memproses...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-light-text-tertiary dark:text-white/30 mt-6">
          © 2025 Nustech. All rights reserved.
        </p>
      </div>
    </div>
  );
}
