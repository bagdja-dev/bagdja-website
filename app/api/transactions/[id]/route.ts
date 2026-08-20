import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/transactions/:id — detail transaksi milik buyer login
 * (sinkronisasi status dari escrow di backend). Dipakai halaman order.
 */
interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(`/api/transactions/${params.id}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (result.status === 404 || !result.data) {
    return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
  }
  if (result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load transaction' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
