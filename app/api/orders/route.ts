import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../lib/backend-api';

/**
 * BFF route /api/orders — forward ke website-api dengan session cookie renderer.
 * - POST: buat order draft (PENDING) dari tombol "+ Keranjang".
 * - GET: list order milik buyer login (dipakai halaman /cart).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await backendFetch('/api/orders/draft', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to create draft order' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function GET(request: NextRequest) {
  // Teruskan `?cart=true` apa adanya — website-api yang memfilter "keranjang
  // aktif" (PENDING & belum di-claim transaksi) di server, jadi FE tidak
  // perlu memfilter/menduplikasi logic ini sendiri.
  const qs = request.nextUrl.searchParams.toString();
  const result = await backendFetch(`/api/orders${qs ? `?${qs}` : ''}`);

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to list orders' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
