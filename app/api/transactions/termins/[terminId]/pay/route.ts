import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../../lib/backend-api';

/**
 * BFF route /api/transactions/termins/:terminId/pay — buyer bayar 1
 * Termin/Tagihan (fulfillment-praorder-plan.md §2.4). Backend bikin
 * transaksi baru (direct-pay) dan kembalikan `checkout_url` untuk redirect
 * — pola sama dengan `/api/transactions/:id/retry-checkout`.
 */
interface RouteContext {
  params: { terminId: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(`/api/transactions/termins/${params.terminId}/pay`, {
    method: 'POST',
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Gagal memproses pembayaran Termin' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
