import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

/**
 * BFF route /api/orders/:id/steps/complete — buyer menyelesaikan 1 step
 * Praorder miliknya sendiri (fulfillment-praorder-plan.md §2.1). Order masih
 * PENDING, belum checkout — beda dari step Pascaorder
 * (/api/transactions/:id/orders/:orderId/steps/complete) yang jalan setelah
 * ada transaksi.
 */
interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body?.step_name) {
    return NextResponse.json({ message: 'step_name wajib diisi' }, { status: 400 });
  }

  const result = await backendFetch(`/api/orders/${params.id}/steps/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Gagal menyelesaikan step ini' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data ?? { success: true }, { status: 200 });
}
