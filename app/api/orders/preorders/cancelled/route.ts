import { NextResponse } from 'next/server';

import { backendFetch } from '../../../../../lib/backend-api';

export async function GET() {
  const result = await backendFetch('/api/orders/preorders/cancelled');
  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to list cancelled preorders' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}