import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

/**
 * BFF proxy tipis, NO-AUTH — endpoint tujuan (`bagdja-website-api`
 * `GET /api/public/shipping/areas`) sendiri publik (proxy ke
 * bagdja-shipping-service). Dipakai search-select tujuan pengiriman di
 * checkout, dipanggil dari client component per-keystroke (debounced) —
 * lewat proxy sendiri (bukan fetch langsung dari browser ke NEXT_PUBLIC_API_URL)
 * supaya konsisten dengan pola BFF app ini.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  try {
    const res = await fetch(
      `${API_BASE}/api/public/shipping/areas?q=${encodeURIComponent(q)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { message: body || 'Failed to search shipping areas' },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Shipping service unreachable' },
      { status: 502 },
    );
  }
}
