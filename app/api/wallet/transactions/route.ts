import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/wallet/transactions — riwayat mutasi saldo wallet personal
 * buyer login (topup, pembayaran, dll), dipakai halaman /profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams();
  const page = searchParams.get('page');
  const size = searchParams.get('size');
  if (page) qs.set('page', page);
  if (size) qs.set('size', size);

  const result = await backendFetch(
    `/api/wallet/transactions${qs.toString() ? `?${qs.toString()}` : ''}`,
  );

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load wallet transactions' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
