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
