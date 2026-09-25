import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../../lib/backend-api';

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/chat/${websiteId}/threads/${params.threadId}/read`, {
    method: 'POST',
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to mark thread as read' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}