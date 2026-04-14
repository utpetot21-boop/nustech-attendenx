'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { apiClient } from '@/lib/api';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const id = sessionStorage.getItem('fp_identifier');
    if (!id) router.replace('/forgot-password');
    else inputs.current[0]?.focus();
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputs.current[5]?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Masukkan 6 digit kode OTP');
      return;
    }
    const identifier = sessionStorage.getItem('fp_identifier');
    if (!identifier) { router.replace('/forgot-password'); return; }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ reset_token: string }>('/auth/verify-otp', {
        identifier,
        otp: code,
      });
      sessionStorage.setItem('fp_reset_token', res.data.reset_token);
      sessionStorage.removeItem('fp_identifier');
      router.push('/forgot-password/reset');
    } catch {
      setError('Kode OTP tidak valid atau sudah kadaluarsa');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg-login p-4">
      <div className="absolute inset-0 dark:block hidden bg-dark-login -z-10" />

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ios-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-white">
            Verifikasi OTP
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-white/60 mt-1">
            Masukkan 6 digit kode yang telah dikirim
          </p>
        </div>

        <div className="content-card-light dark:content-card-dark rounded-2xl p-6 shadow-sm space-y-5">
          {error && (
            <div className="card-tint-red rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* OTP Input */}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-11 h-13 text-center text-xl font-bold rounded-xl
                  bg-white/85 dark:bg-white/10
                  border border-black/10 dark:border-white/18
                  text-light-text-primary dark:text-white
                  focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20 outline-none
                  transition"
                style={{ height: '52px' }}
              />
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || otp.join('').length !== 6}
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
                Memverifikasi...
              </span>
            ) : 'Verifikasi'}
          </button>

          <p className="text-center text-sm text-light-text-secondary dark:text-white/60">
            Tidak menerima kode?{' '}
            <Link href="/forgot-password" className="text-ios-blue hover:underline font-medium">
              Kirim ulang
            </Link>
          </p>
        </div>

        <div className="text-center mt-4">
          <Link href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-ios-blue hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
        </div>
      </div>
    </div>
  );
}
