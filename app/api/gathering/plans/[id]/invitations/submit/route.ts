import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) return NextResponse.json({ message: 'Website wajib dipilih.' }, { status: 400 });

  const result = await backendFetch(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/invitations/submit?website_id=${encodeURIComponent(websiteId)}`,
    { method: 'POST' },
  );

  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal submit undangan.' }, { status: result.status });
  }

  return NextResponse.json(result.data);
}