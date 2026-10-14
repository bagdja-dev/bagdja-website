import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

interface RouteContext {
  params: { id: string; operationId: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await getSession();
  if (!token) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  const path = `/api/gathering/plans/${encodeURIComponent(params.id)}/operations/${encodeURIComponent(params.operationId)}/events?website_id=${encodeURIComponent(websiteId)}`;
  const upstream = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
    cache: 'no-store',
    signal: request.signal,
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ message: await upstream.text().catch(() => 'Unable to open progress stream') }, { status: upstream.status || 502 });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
