// Shared date/ISO formatting helpers untuk mobile app.
// Semua tampilan tanggal berbahasa Indonesia (id-ID).
// Jika butuh zona waktu eksplisit, pakai varian WIT (Asia/Makassar) / WIB (Asia/Jakarta).

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

// Format ke string YYYY-MM-DD berbasis waktu lokal device (bukan UTC).
// Penting untuk query tanggal tanpa pergeseran ke UTC.
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format YYYY-MM untuk query bulan berjalan.
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
