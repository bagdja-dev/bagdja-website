import { NextResponse } from 'next/server';

// Sengaja di /api/health (bukan /health) supaya otomatis di-exclude oleh
// middleware.ts (matcher: '/((?!_next|api|favicon.ico).*)') — health check
// Coolify tidak boleh melewati logika resolusi Host-based tenant (yang butuh
// hostname sites.bagdja.com/subdomain valid dan bisa panggil API eksternal),
// supaya hasilnya selalu 200 apapun Host header yang dipakai probe internal.
export async function GET() {
  return NextResponse.json({ service: 'bagdja-website-web', status: 'ok' });
}
