import { NextResponse } from 'next/server';
import { publicBackendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { token: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const result = await publicBackendFetch(`/api/public/gathering-tickets/${encodeURIComponent(params.token)}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: 'Tiket tidak ditemukan.' }, { status: result.status || 404 });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
