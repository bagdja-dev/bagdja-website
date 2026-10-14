import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const query = websiteId ? `?website_id=${encodeURIComponent(websiteId)}` : '';
  const body = await request.json().catch(() => null);
  const origin = request.headers.get('origin');
  const result = await backendFetch(`/api/gathering/plans/${encodeURIComponent(params.id)}/registrations/collective-checkout${query}`, {
    method: 'POST',
    headers: origin ? { 'x-return-origin': origin } : undefined,
    body: JSON.stringify(body),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal menyiapkan pembayaran kolektif.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
