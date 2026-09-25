import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/api/public/realtime/ws-token`, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ error: 'Realtime service unavailable' }, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('[website ws-token proxy] fetch failed:', error);
    return NextResponse.json({ error: 'Realtime service unavailable' }, { status: 502 });
  }
}