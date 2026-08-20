import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/orders/:id — update qty / hapus draft PENDING milik buyer.
 * - PATCH: body { quantity } → forward ke website-api (recompute total).
 * - DELETE: cancel draft (status CANCELLED).
 * Dipakai halaman /cart (qty stepper + tombol hapus utk item server).
 */
interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body?.quantity !== 'number' || body.quantity < 1) {
    return NextResponse.json({ message: 'Invalid quantity' }, { status: 400 });
  }

  const result = await backendFetch(`/api/orders/${params.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity: Math.floor(body.quantity) }),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to update order quantity' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(`/api/orders/${params.id}`, {
    method: 'DELETE',
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to cancel order' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
