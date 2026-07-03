/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Renderer publik: memungkinkan gambar dari Supabase Storage.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },
};

module.exports = nextConfig;
