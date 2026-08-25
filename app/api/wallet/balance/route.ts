import { NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend-api';

/**
 * BFF route /api/wallet/balance — saldo wallet personal buyer login,
 * dipakai halaman /profile. Proxy tipis ke bagdja-website-api.
 */
export async function GET() {
  const result = await backendFetch('/api/wallet/balance');

  if (result.status === 401) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!result.data || result.status >= 400) {
    return NextResponse.json(
      { message: result.error ?? 'Failed to load wallet balance' },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
