import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { id: string; orderId: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!body?.step_name) {
    return NextResponse.json({ message: 'step_name wajib diisi' }, { status: 400 });
  }
  const result = await backendFetch(`/api/transactions/${params.id}/orders/${params.orderId}/steps/draft`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (result.status === 401) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal menyimpan draft fulfillment' }, { status: result.status });
  }
  return NextResponse.json(result.data ?? { success: true });
}
