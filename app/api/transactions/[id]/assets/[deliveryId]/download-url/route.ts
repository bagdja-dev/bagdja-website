import { NextResponse } from 'next/server';

import { backendFetch } from '../../../../../../../lib/backend-api';

interface RouteContext {
  params: { id: string; deliveryId: string };
}

export async function POST(_request: Request, { params }: RouteContext) {
  const result = await backendFetch(
    `/api/transactions/${encodeURIComponent(params.id)}/assets/${encodeURIComponent(params.deliveryId)}/download-url`,
    { method: 'POST' },
  );
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Could not create download URL' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}