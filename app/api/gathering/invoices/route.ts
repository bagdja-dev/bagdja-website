import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const query = websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
  const result = await backendFetch(`/api/gathering/invoices${query}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat tagihan gathering.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
