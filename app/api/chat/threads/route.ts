import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/** backendFetch menaruh body galat mentah (JSON NestJS) di `error`; ambil `message`-nya saja. */
function readableError(error: string | undefined, fallback: string): string {
  if (!error) return fallback;
  try {
    const parsed = JSON.parse(error) as { message?: unknown };
    const message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  } catch {
    return error.length <= 300 ? error : fallback;
  }
}

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${websiteId}/threads${request.nextUrl.search ? `?${request.nextUrl.searchParams.toString().replace('website_id=' + encodeURIComponent(websiteId), '').replace(/^&+|&+$/g, '')}` : ''}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: readableError(result.error, 'Gagal memuat percakapan.') }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.website_id) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${body.website_id}/customer-threads`, {
    method: 'POST',
    body: JSON.stringify({
      channel_type: body.channel_type === 'transaction' ? 'order' : (body.channel_type ?? 'support'),
      channel_label: body.channel_label ?? 'Support',
      initial_message: body.initial_message,
      product_id: body.product_id,
      order_id: body.order_id,
      order_item_id: body.order_item_id,
    }),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: readableError(result.error, 'Gagal membuat percakapan.') }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
