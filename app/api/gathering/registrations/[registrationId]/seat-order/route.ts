import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { registrationId: string };
}

export async function POST(_request: Request, { params }: RouteContext) {
  const result = await backendFetch(`/api/gathering/registrations/${encodeURIComponent(params.registrationId)}/seat-order`, { method: 'POST' });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal menyiapkan order seat.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}