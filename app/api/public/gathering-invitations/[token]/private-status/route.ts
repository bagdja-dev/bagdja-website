import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { token: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token) && !/^[A-Za-z0-9_-]{40,64}$/.test(params.token)) {
    return NextResponse.json({ message: 'Undangan tidak valid atau sudah kedaluwarsa.' }, { status: 404 });
  }
  const result = await backendFetch(`/api/public/gathering-invitations/${encodeURIComponent(params.token)}/private-status`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Status undangan tidak dapat dimuat.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}