import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const result = await backendFetch(`/api/notifications/unread-count?website_id=${encodeURIComponent(websiteId)}`);
  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to load unread count' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}
