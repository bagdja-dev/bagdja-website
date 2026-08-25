import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/shipping/cost — proxy tipis, AUTH required (buyer login,
 * sama pola `app/api/transactions/checkout/route.ts`).
 * body: { websiteId, order_ids, location_id, destination_area_id, courier_code? }
 * `websiteId` dipakai bangun path, sisanya diteruskan mentah ke
 * `POST /api/websites/:websiteId/shipping/cost` (bagdja-website-api).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.websiteId !== 'string' || !body.websiteId) {
    return NextResponse.json({ message: 'websiteId is required' }, { status: 400 });
  }

  const { websiteId, ...rest } = body;
  const result = await backendFetch(`/api/websites/${encodeURIComponent(websiteId)}/shipping/cost`, {
    method: 'POST',
    body: JSON.stringify(rest),
  });

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to calculate shipping cost' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
