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
};

module.exports = nextConfig;
