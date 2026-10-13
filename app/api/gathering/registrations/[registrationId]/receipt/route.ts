import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { registrationId: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const result = await backendFetch(`/api/gathering/registrations/${encodeURIComponent(params.registrationId)}/receipt`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Status RSVP tidak ditemukan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}