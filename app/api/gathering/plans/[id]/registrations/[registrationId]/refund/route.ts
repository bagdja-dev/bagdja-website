import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string; registrationId: string };
}

/** Initiator merefund seat peserta yang sudah dibayar (dana masih ditahan escrow) sebelum gathering dikonfirmasi. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) return NextResponse.json({ message: 'Website wajib dipilih.' }, { status: 400 });
  const result = await backendFetch(
    `/api/gathering/plans/${encodeURIComponent(params.id)}/registrations/${encodeURIComponent(params.registrationId)}/refund?website_id=${encodeURIComponent(websiteId)}`,
    { method: 'POST' },
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Refund seat gagal.' }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
