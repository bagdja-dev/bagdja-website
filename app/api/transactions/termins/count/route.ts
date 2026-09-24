import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../lib/backend-api';

/**
 * BFF route /api/transactions/termins/count — jumlah Termin/Tagihan sesuai
 * status (badge header). Default backend pakai status=ISSUED kalau query
 * kosong (lihat TransactionsController.countTermins).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';

  const result = await backendFetch(`/api/transactions/termins/count${qs}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load termin count' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
