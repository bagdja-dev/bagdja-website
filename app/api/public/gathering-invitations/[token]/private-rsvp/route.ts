import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { token: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token) && !/^[A-Za-z0-9_-]{40,64}$/.test(params.token)) {
    return NextResponse.json({ message: 'Undangan tidak valid atau sudah kedaluwarsa.' }, { status: 404 });
  }
  const result = await backendFetch(`/api/public/gathering-invitations/${encodeURIComponent(params.token)}/private-rsvp`, {
    method: 'POST',
    body: JSON.stringify(await request.json()),
  });
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'RSVP gagal dikirim.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}