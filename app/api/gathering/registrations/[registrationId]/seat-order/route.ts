import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { registrationId: string };
}

export async function POST(request: Request, { params }: RouteContext) {
  const origin = request.headers.get('origin');
  const result = await backendFetch(`/api/gathering/registrations/${encodeURIComponent(params.registrationId)}/seat-order`, {
    method: 'POST',
    headers: origin ? { 'x-return-origin': origin } : undefined,
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal menyiapkan order seat.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}