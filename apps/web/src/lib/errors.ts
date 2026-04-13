/**
 * Centralized error extraction utility.
 * Menggantikan definisi getMsg() lokal yang tersebar di employees, settings, dll.
 *
 * Format backend NestJS yang di-handle:
 *  - { message: string }
 *  - { message: string[] }          ← ValidationPipe
 *  - { message: { error: string } } ← nested object
 *  - { error: string }
 */

interface ApiErrorShape {
  message?: string | string[] | { error?: string; message?: string };
  error?: string;
  statusCode?: number;
}

/**
 * Ekstrak pesan error dari response Axios / fetch error.
 * @param err   - Error yang ditangkap dari catch block
 * @param fallback - Pesan default jika tidak ada pesan dari server
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;

  // Axios error — ada response.data
  const data = (err as { response?: { data?: ApiErrorShape } })?.response?.data;

  if (data) {
    let msg: unknown = data.message ?? data.error;

    // ValidationPipe: message adalah array string
    if (Array.isArray(msg)) return msg.join(', ');

    // Nested object: { error: '...' } atau { message: '...' }
    if (typeof msg === 'object' && msg !== null) {
      msg = (msg as { error?: string; message?: string }).message
        ?? (msg as { error?: string }).error;
    }

    if (typeof msg === 'string' && msg.trim().length > 0) return msg.trim();
  }

  // Error biasa (network error, timeout, dll)
  if (err instanceof Error && err.message) return err.message;

  return fallback;
}

/**
 * Ekstrak pesan error dari login/auth response yang kadang nested berbeda.
 * Backend auth mengembalikan: { message: { error: '...' } } atau { message: '...' }
 */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: ApiErrorShape } })?.response?.data;
  if (!data) return fallback;

  const msg = data.message;

  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
    const nested = (msg as { error?: string }).error;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }

  if (typeof msg === 'string' && msg.trim()) return msg.trim();

  return fallback;
}
