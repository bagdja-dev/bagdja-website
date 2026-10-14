import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const body = await request.json().catch(() => null);
  if (!websiteId || !body || (body.invitation_banner_url === undefined && body.invitation_description === undefined)) {
    return NextResponse.json({ message: 'Konten undangan tidak lengkap.' }, { status: 400 });
  }

  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}/invitation-content?website_id=${encodeURIComponent(websiteId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal menyimpan konten undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}