import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { registrationId: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) return NextResponse.json({ message: 'website_id wajib diisi.' }, { status: 400 });
  const result = await backendFetch(
    `/api/gathering/reservations/${encodeURIComponent(params.registrationId)}?website_id=${encodeURIComponent(websiteId)}`,
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.status === 404 ? 'Reservasi tidak ditemukan.' : result.error ?? 'Gagal memuat reservasi.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
