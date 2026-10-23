import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get('website_id');
  if (!websiteId) return NextResponse.json({ message: 'website_id wajib diisi.' }, { status: 400 });
  const result = await backendFetch(`/api/gathering/invitations/mine?website_id=${encodeURIComponent(websiteId)}`);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal memuat undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
