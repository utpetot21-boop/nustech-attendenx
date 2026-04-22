'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

import { apiClient } from '@/lib/api';

const schema = z.object({
  identifier: z.string().min(5, 'Masukkan email atau nomor HP yang valid'),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/forgot-password', { identifier: data.identifier });
      sessionStorage.setItem('fp_identifier', data.identifier);
      setSent(true);
    } catch {
      setError('Terjadi kesalahan. Coba lagi beberapa saat.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg-login p-4">
      <div className="absolute inset-0 dark:block hidden bg-dark-login -z-10" />

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ios-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Mail className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-white">
            Lupa Password
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-white/60 mt-1">
            Masukkan email atau nomor HP terdaftar
          </p>
        </div>

        <div className="content-card-light dark:content-card-dark rounded-2xl p-6 shadow-sm">
          {!sent ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="card-tint-red rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-white/60 mb-1.5">
                  Email / Nomor HP
                </label>
                <input
                  type="text"
                  placeholder="email@perusahaan.id atau 08xxxxxxxxxx"
                  className={inputCls(!!errors.identifier)}
                  {...register('identifier')}
                />
                {errors.identifier && (
                  <p className="text-xs text-ios-red mt-1">{errors.identifier.message}</p>
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
                    Mengirim...
                  </span>
                ) : 'Kirim Kode OTP'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-light-text-primary dark:text-white">Kode OTP Terkirim!</p>
                <p className="text-sm text-light-text-secondary dark:text-white/60 mt-1">
                  Cek email atau SMS untuk kode OTP. Berlaku 10 menit.
                </p>
              </div>
              <button
                onClick={() => router.push('/forgot-password/verify')}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white
                  bg-ios-blue hover:bg-ios-blue/90 transition-all
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_10px_rgba(0,122,255,0.3)]"
              >
                Masukkan Kode OTP
              </button>
              <button
                onClick={() => { setSent(false); }}
                className="text-sm text-ios-blue hover:underline"
              >
                Kirim ulang
              </button>
            </div>
          )}
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
