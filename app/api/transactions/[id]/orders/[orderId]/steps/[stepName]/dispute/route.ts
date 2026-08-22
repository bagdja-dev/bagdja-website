import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

/**
 * BFF route /api/transactions/:id/orders/:orderId/steps/:stepName/dispute —
 * buyer mengajukan komplain untuk 1 step fulfillment. TIDAK memanggil
 * escrow/freeze (dana step ini belum pernah dipindah) — murni gate lokal,
 * lihat `disputeStep` di website-api (Order Handling Phase 3 §3.0.1).
 */
interface RouteContext {
  params: { id: string; orderId: string; stepName: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(
    `/api/transactions/${params.id}/orders/${params.orderId}/steps/${encodeURIComponent(params.stepName)}/dispute`,
    { method: 'POST' },
  );

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Gagal mengajukan komplain' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data ?? { success: true }, { status: 200 });
}
