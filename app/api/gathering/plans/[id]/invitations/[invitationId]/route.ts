import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string; invitationId: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const query = websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
  const result = await backendFetch(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/invitations/${encodeURIComponent(params.invitationId)}/link${query}`,
    { method: 'POST' },
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal membuat tautan undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const query = websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
  const result = await backendFetch(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/invitations/${encodeURIComponent(params.invitationId)}${query}`,
    { method: 'DELETE' },
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal mencabut undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}