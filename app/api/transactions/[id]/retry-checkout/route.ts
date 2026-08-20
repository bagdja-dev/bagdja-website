import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../lib/backend-api';

/**
 * BFF route /api/transactions/:id/retry-checkout — retry inisialisasi
 * pembayaran transaksi PENDING_PAYMENT yang belum punya `checkout_url`
 * (mis. checkout gagal di tengah jalan). Kalau `checkout_url` sudah ada,
 * backend langsung mengembalikannya tanpa panggil payment-service lagi.
 */
interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => ({}));

  const result = await backendFetch(`/api/transactions/${params.id}/retry-checkout`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Retry checkout failed' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
