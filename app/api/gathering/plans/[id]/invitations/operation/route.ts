import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/invitations/operation?website_id=${encodeURIComponent(websiteId)}`,
  );
  if (result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Gagal memuat progres pengiriman undangan.' },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
