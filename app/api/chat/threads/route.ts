import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

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
    return NextResponse.json({ message: result.error ?? 'Failed to load threads' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.website_id) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${body.website_id}/threads`, {
    method: 'POST',
    body: JSON.stringify({
      channel_type: body.channel_type === 'transaction' ? 'transaction' : body.channel_type ?? 'support',
      channel_label: body.channel_label ?? 'Support',
      initial_message: body.initial_message,
      product_id: body.product_id,
      order_id: body.order_id,
      order_item_id: body.order_item_id,
      customer_user_id: body.customer_user_id,
      assigned_admin_user_id: body.assigned_admin_user_id,
    }),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to create thread' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
