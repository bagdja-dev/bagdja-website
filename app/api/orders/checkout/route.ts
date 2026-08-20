import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/orders/checkout — konversi order draft (PENDING) menjadi
 * checkout penuh (escrow + payment) di website-api, lalu redirect ke Pay UI.
 * - body: { order_id, provider, paymentMethod }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await backendFetch('/api/orders', {
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
