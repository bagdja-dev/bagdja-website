import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../../lib/backend-api';

export async function GET(request: NextRequest, { params }: { params: { threadId: string } }) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${websiteId}/threads/${params.threadId}/messages`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to load messages' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  const body = await request.json().catch(() => null);

  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }
  if (!body || !body.body) {
    return NextResponse.json({ message: 'Message body is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${websiteId}/threads/${params.threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body: body.body,
      author_name: body.author_name ?? 'Customer',
    }),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to send message' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
