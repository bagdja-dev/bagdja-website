import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../lib/backend-api';
import { resolveOrigin } from '../../../../../lib/resolve-origin';

/**
 * BFF route /api/transactions/:id/retry-checkout — (re)inisialisasi
 * pembayaran transaksi PENDING_PAYMENT. Dipakai tombol "Lanjutkan
 * Pembayaran": untuk ESCROW backend selalu menerbitkan ulang sesi + link
 * Pay UI (link lama bisa sudah kedaluwarsa), juga untuk transaksi yang
 * checkout-nya sempat gagal di tengah jalan (belum punya `checkout_url`).
 */
interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const origin = request.headers.get('origin');

  const result = await backendFetch(`/api/transactions/${params.id}/retry-checkout`, {
    method: 'POST',
    headers: origin ? { 'x-return-origin': origin } : undefined,
    body: JSON.stringify(body ?? {}),
    headers: { 'x-return-origin': resolveOrigin(request) },
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
