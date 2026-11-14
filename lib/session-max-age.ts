/** Umur cookie sesi renderer (tanpa dependensi Next — dipakai lib/session.ts & diuji langsung). */

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60;
const MAX_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Umur cookie sesi = sisa masa berlaku token (klaim `exp`), supaya renderer tidak
 * "logout" lebih cepat dari token (dulu penanda akun dipatok 1 jam) dan tidak menyimpan
 * token yang sudah kedaluwarsa. Hanya membaca payload untuk umur cookie — verifikasi token
 * tetap di website-api. Token tanpa `exp` yang terbaca → 1 jam.
 */
export function sessionMaxAgeSeconds(token: string, nowMs = Date.now()): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const exp = typeof payload?.exp === 'number' ? payload.exp : null;
    if (exp === null) return DEFAULT_SESSION_MAX_AGE_SECONDS;
    const remaining = Math.floor(exp - nowMs / 1000);
    return Math.max(60, Math.min(MAX_SESSION_MAX_AGE_SECONDS, remaining));
  } catch {
    return DEFAULT_SESSION_MAX_AGE_SECONDS;
  }
}
