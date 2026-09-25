import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../lib/backend-api';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) {
    return NextResponse.json({ message: 'website_id is required' }, { status: 400 });
  }

  const { id } = params;
  const result = await backendFetch(`/api/notifications/${id}/read?website_id=${encodeURIComponent(websiteId)}`, {
    method: 'PATCH',
  });
  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Failed to mark notification read' }, { status: result.status || 500 });
  }

  return NextResponse.json({ data: result.data }, { status: 200 });
}
