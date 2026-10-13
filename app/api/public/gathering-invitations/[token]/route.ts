import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

interface RouteContext {
  params: { token: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.token)
    && !/^[A-Za-z0-9_-]{40,64}$/.test(params.token)) {
    return NextResponse.json({ message: 'Undangan tidak valid atau sudah kedaluwarsa.' }, { status: 404 });
  }

  try {
    const response = await fetch(`${API_BASE}/api/public/gathering-invitations/${encodeURIComponent(params.token)}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ message: payload?.message ?? 'Undangan tidak valid atau sudah kedaluwarsa.' }, { status: response.status });
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Layanan undangan sedang tidak tersedia.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token) && !/^[A-Za-z0-9_-]{40,64}$/.test(params.token)) {
    return NextResponse.json({ message: 'Undangan tidak valid atau sudah kedaluwarsa.' }, { status: 404 });
  }

  try {
    const response = await fetch(`${API_BASE}/api/public/gathering-invitations/${encodeURIComponent(params.token)}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await request.json()),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(payload ?? { message: 'RSVP gagal dikirim.' }, { status: response.status });
    }
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Layanan undangan sedang tidak tersedia.' }, { status: 502 });
  }
}