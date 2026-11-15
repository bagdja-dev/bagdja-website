/**
 * Pemuat browser.js template untuk mode client (plan/website-builder/template-client-rendering-plan.md §5–6).
 *
 * Halaman induk (origin tenant) yang mengambil file dari CDN — bukan iframe sandbox — agar cache
 * HTTP/Cache Storage berlaku normal, lalu SHA-256 diverifikasi sebelum bytes diteruskan ke iframe.
 * Hasil di-cache per SHA-256:
 * - memori modul: dipakai bersama iframe halaman, header, dan navigasi bawah, serta antar-pindah tab
 *   (navigasi client Next.js tidak memuat ulang modul);
 * - Cache Storage: bertahan setelah reload penuh (storage-service tidak mengirim Cache-Control).
 * Isi file immutable (URL & hash baru untuk setiap isi baru), jadi cache tidak perlu kedaluwarsa.
 */

export interface TemplateBrowserBundleRef {
  url: string;
  sha256: string;
}

const MAX_BROWSER_BUNDLE_BYTES = 1024 * 1024;
const CACHE_NAME = 'bagdja-template-browser-bundles-v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const memory = new Map<string, Promise<string>>();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return window.btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await window.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)));
}

/** Kunci Cache Storage per hash (bukan per URL CDN), agar URL berbeda dengan isi sama tetap kena cache. */
function cacheKey(sha256: string): string {
  return `${window.location.origin}/__bagdja/template-browser-bundle/${sha256}.js`;
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function readVerified(response: Response, sha256: string): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BROWSER_BUNDLE_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BROWSER_BUNDLE_BYTES) return null;
  return (await sha256Hex(bytes)) === sha256 ? bytes : null;
}

export function isTemplateBrowserBundleRef(value: unknown): value is TemplateBrowserBundleRef {
  if (!value || typeof value !== 'object') return false;
  const { url, sha256 } = value as Record<string, unknown>;
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256) || typeof url !== 'string' || url.length > 2048) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

async function fetchBundle({ url, sha256 }: TemplateBrowserBundleRef): Promise<string> {
  const cache = await openCache();
  const key = cacheKey(sha256);
  if (cache) {
    try {
      const cached = await cache.match(key);
      const bytes = cached ? await readVerified(cached, sha256) : null;
      if (bytes) return toBase64(bytes);
      if (cached) await cache.delete(key);
    } catch {
      // Cache Storage rusak/tidak tersedia → ambil dari jaringan.
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error('Template tidak dapat diunduh. Periksa koneksi lalu muat ulang halaman.');
  }
  if (!response.ok) throw new Error(`Template tidak dapat diunduh (${response.status}).`);
  const bytes = await readVerified(response, sha256);
  if (!bytes) throw new Error('Isi template tidak cocok dengan versi yang terpasang.');
  if (cache) {
    try {
      await cache.put(key, new Response(new Uint8Array(bytes), { headers: { 'content-type': 'text/javascript' } }));
    } catch {
      // Kuota penuh / mode privat: tetap jalan dengan cache memori.
    }
  }
  return toBase64(bytes);
}

/** browser.js (base64, SHA-256 sudah cocok) untuk dokumen iframe mode client. */
export function loadTemplateBrowserBundle(ref: TemplateBrowserBundleRef): Promise<string> {
  if (!isTemplateBrowserBundleRef(ref)) return Promise.reject(new Error('Referensi template tidak valid.'));
  let pending = memory.get(ref.sha256);
  if (!pending) {
    pending = fetchBundle(ref);
    memory.set(ref.sha256, pending);
    // Gagal tidak di-cache: percobaan berikutnya (refresh) mengambil ulang.
    pending.catch(() => memory.delete(ref.sha256));
  }
  return pending;
}
