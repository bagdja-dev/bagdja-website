/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-hosted di Coolify (bukan Vercel) — perlu output standalone untuk image Docker yang ramping.
  output: 'standalone',
  // Renderer publik: memungkinkan gambar dari Supabase Storage.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },
};

module.exports = nextConfig;
