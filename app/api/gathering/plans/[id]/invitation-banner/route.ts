import { NextRequest, NextResponse } from 'next/server';

import { backendFetchFormData } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const incoming = await request.formData();
  const file = incoming.get('file');
  if (!websiteId || !(file instanceof File)) {
    return NextResponse.json({ message: 'File banner dan website wajib diisi.' }, { status: 400 });
  }

  const outgoing = new FormData();
  outgoing.append('file', file);
  const result = await backendFetchFormData(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/invitation-banner?website_id=${encodeURIComponent(websiteId)}`,
    outgoing,
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal mengunggah banner undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: result.status });
}