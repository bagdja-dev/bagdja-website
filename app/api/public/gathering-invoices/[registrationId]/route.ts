import { NextResponse } from 'next/server';
import { publicBackendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { registrationId: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const result = await publicBackendFetch(`/api/public/gathering-invoices/${encodeURIComponent(params.registrationId)}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Tagihan tidak ditemukan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
