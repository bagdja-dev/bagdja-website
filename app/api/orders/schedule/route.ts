import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

/** Proxy jadwal jasa pembeli (field flow bertanda kalender) — dipakai kalender bawaan renderer. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const websiteId = params.get('website_id');
  const from = params.get('from');
  const to = params.get('to');
  if (!websiteId || !from || !to) {
    return NextResponse.json({ message: 'website_id, from, dan to wajib diisi.' }, { status: 400 });
  }
  const query = new URLSearchParams({ website_id: websiteId, from, to });
  const result = await backendFetch(`/api/orders/schedule?${query.toString()}`);
  if (result.status === 401) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat jadwal jasa.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
