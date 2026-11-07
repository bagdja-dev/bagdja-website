/**
 * S8 — origin admin (Studio) yang boleh menyematkan route preview
 * `[website_slug]/__preview` di iframe. Sama dengan getAllowedAdminOrigins()
 * di lib/preview-protocol.ts: env NEXT_PUBLIC_ADMIN_ORIGIN (dipisah koma);
 * kosong → dev: http://localhost:5004, production: 'none' (preview tertutup).
 * Catatan: nilai dibaca saat build (output standalone) — set env juga saat build.
 */
function previewFrameAncestors() {
  const origins = (process.env.NEXT_PUBLIC_ADMIN_ORIGIN ?? '')
    .split(',')
    .map((entry) => {
      try {
        const url = new URL(entry.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (origins.length > 0) return Array.from(new Set(origins)).join(' ');
  return process.env.NODE_ENV === 'production' ? "'none'" : 'http://localhost:5004';
}

const PREVIEW_HEADERS = [
  { key: 'Content-Security-Policy', value: `frame-ancestors ${previewFrameAncestors()}` },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-hosted di Coolify (bukan Vercel) — perlu output standalone untuk image Docker yang ramping.
  output: 'standalone',
  // Renderer publik: memungkinkan gambar dari Supabase Storage (file lama) dan
  // bagdja-storage-service/Cloudflare R2 (file baru, plan/storage-services/overview.md §9 Fase 3).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
  // Header HANYA untuk route preview Studio. Dicocokkan ke path sebelum rewrite
  // middleware: `/__preview` (subdomain/custom domain) dan `/{slug}/__preview`
  // (path-based, lokal). Route lain tidak berubah (tidak ada X-Frame-Options global).
  async headers() {
    return [
      { source: '/__preview', headers: PREVIEW_HEADERS },
      { source: '/:website_slug/__preview', headers: PREVIEW_HEADERS },
    ];
  },
};

module.exports = nextConfig;
