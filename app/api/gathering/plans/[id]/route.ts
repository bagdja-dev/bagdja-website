import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

function websiteQuery(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  return websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const query = websiteQuery(request);
  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}${query}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat detail praorder.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body || (body.title === undefined && body.invite_policy === undefined)) {
    return NextResponse.json({ message: 'Tidak ada perubahan untuk disimpan.' }, { status: 400 });
  }
  const query = websiteQuery(request);
  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}${query}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memperbarui praorder.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}