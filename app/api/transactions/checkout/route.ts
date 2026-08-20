import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/transactions/checkout — buat transaction + transaction_items
 * dari order (cart) PENDING, lalu escrow + payment di level transaksi.
 * - body: { order_ids: string[], shipping_address?, courier?, provider?,
 *   paymentMethod?, selectedWalletId? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await backendFetch('/api/transactions/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Checkout failed' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
