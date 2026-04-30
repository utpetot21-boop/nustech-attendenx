const WITA = 'Asia/Makassar';

/** Tanggal hari ini dalam YYYY-MM-DD timezone WITA (UTC+8). */
export function witaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: WITA });
}

/** Date object → YYYY-MM-DD dalam timezone WITA. */
export function toWitaDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: WITA });
}
