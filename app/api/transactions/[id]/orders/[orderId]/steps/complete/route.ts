import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

/**
 * BFF route /api/transactions/:id/orders/:orderId/steps/complete — buyer
 * menandai 1 step fulfillment selesai. Khusus step yang field-nya (sebagian/
 * semua) `filled_by:'buyer'` (mis. No Resi pengiriman balik pada flow
 * reparasi, fulfillment-praorder-plan.md §2.1/Q11) — backend menolak kalau
 * step ini tidak punya field milik buyer sama sekali.
 */
interface RouteContext {
  params: { id: string; orderId: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body?.step_name) {
    return NextResponse.json({ message: 'step_name wajib diisi' }, { status: 400 });
  }

  const result = await backendFetch(
    `/api/transactions/${params.id}/orders/${params.orderId}/steps/complete`,
    { method: 'POST', body: JSON.stringify(body) },
  );

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
