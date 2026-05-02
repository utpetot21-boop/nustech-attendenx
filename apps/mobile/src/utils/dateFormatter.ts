// Shared date/ISO formatting helpers untuk mobile app.
// Semua tampilan tanggal berbahasa Indonesia (id-ID), zona WITA (Asia/Makassar).

export function fmtDateShort(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });
}

export function fmtDateShortWIT(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });
}

export function fmtDateWeekday(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });
}

/** Date → YYYY-MM-DD dalam timezone WITA (UTC+8). */
export function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}

/** YYYY-MM bulan berjalan dalam timezone WITA. */
export function currentMonth(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }).slice(0, 7);
}

/**
 * Format waktu dari ISO string ke "HH:MM" dalam WITA (UTC+8).
 * Menggunakan aritmatika UTC langsung agar tidak bergantung pada dukungan
 * timeZone option di Intl/Hermes pada device tertentu.
 */
export function fmtTimeWITA(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return '—';
  const witaDate = new Date(ms + 8 * 60 * 60 * 1000);
  const h = String(witaDate.getUTCHours()).padStart(2, '0');
  const m = String(witaDate.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
