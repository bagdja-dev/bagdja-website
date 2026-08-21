import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../../lib/backend-api';

/**
 * BFF route /api/transactions/:id/dispute — buyer mengajukan komplain,
 * membuka dispute (freeze escrow) selama dana masih ditahan (HELD).
 */
interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const result = await backendFetch(`/api/transactions/${params.id}/dispute`, {
    method: 'POST',
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Gagal mengajukan komplain' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
