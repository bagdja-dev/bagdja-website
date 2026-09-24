import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/transactions/termins — list Termin/Tagihan lintas-order
 * milik buyer login (halaman "Tagihan"). Pola sama `/api/transactions`
 * (lihat app/api/transactions/route.ts), tambah passthrough `status`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams();
  const page = searchParams.get('page');
  const size = searchParams.get('size');
  const status = searchParams.get('status');
  const websiteId = searchParams.get('website_id');
  if (page) qs.set('page', page);
  if (size) qs.set('size', size);
  if (status) qs.set('status', status);
  if (websiteId) qs.set('website_id', websiteId);

  const result = await backendFetch(`/api/transactions/termins${qs.toString() ? `?${qs.toString()}` : ''}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load termins' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
