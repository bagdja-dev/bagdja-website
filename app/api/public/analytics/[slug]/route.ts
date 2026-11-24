import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(params.slug)) {
    return NextResponse.json({ message: 'Invalid website slug' }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 4096) {
    return NextResponse.json({ message: 'Analytics event is too large' }, { status: 413 });
  }

  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > 4096) {
          await reader.cancel();
          return NextResponse.json({ message: 'Analytics event is too large' }, { status: 413 });
        }
        chunks.push(value);
      }
    }
    const bodyBytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = new TextDecoder().decode(bodyBytes);
    const response = await fetch(
      `${API_BASE}/api/public/sites/${encodeURIComponent(params.slug)}/analytics/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      },
    );
    const responseBody = await response.text();
    return new NextResponse(responseBody || null, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
    });
  } catch (error) {
    console.error('[website-analytics] analytics API request failed', error);
    return NextResponse.json({ message: 'Analytics service unavailable' }, { status: 502 });
  }
}
