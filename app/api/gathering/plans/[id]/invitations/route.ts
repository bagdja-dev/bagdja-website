import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

function query(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  return websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}/invitations${query(request)}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat daftar undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body || (!body.email && !body.whatsapp)) {
    return NextResponse.json({ message: 'Isi email atau nomor WhatsApp penerima.' }, { status: 400 });
  }
  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}/invitations${query(request)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal membuat undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 201 });
}