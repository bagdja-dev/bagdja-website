import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'Website wajib dipilih.' }, { status: 400 });
  }
  const result = await backendFetch(`/api/gathering/plans?website_id=${encodeURIComponent(websiteId)}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat rencana gathering.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.website_id !== 'string' || typeof body.product_id !== 'string') {
    return NextResponse.json({ message: 'Website dan produk gathering wajib dipilih.' }, { status: 400 });
  }

  const result = await backendFetch('/api/gathering/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal membuat praorder gathering.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 201 });
}