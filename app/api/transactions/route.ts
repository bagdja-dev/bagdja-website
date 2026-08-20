import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../lib/backend-api';

/**
 * BFF route /api/transactions — list transaksi milik buyer login (halaman
 * `/orders`). Menggantikan `GET /api/orders` sebagai sumber data daftar
 * transaksi sejak W2.8 (status & checkout_url ada di level transaksi).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams();
  const page = searchParams.get('page');
  const size = searchParams.get('size');
  if (page) qs.set('page', page);
  if (size) qs.set('size', size);

  const result = await backendFetch(`/api/transactions${qs.toString() ? `?${qs.toString()}` : ''}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load transactions' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
