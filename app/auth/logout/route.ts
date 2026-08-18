import { NextRequest, NextResponse } from 'next/server';

import { clearSession } from '../../../lib/session';

/**
 * W1 auth renderer: logout.
 * - Clear session cookie renderer (`site_token`).
 * - Redirect ke SSO logout Bagdja dengan `redirect_uri` = origin + returnTo
 *   supaya setelah SSO logout user kembali ke halaman asal (localhost / custom
 *   domain). `returnTo` dari query (disusun getAuthViewState).
 */
export async function GET(request: NextRequest) {
  await clearSession();

  const returnTo = request.nextUrl.searchParams.get('returnTo');
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/';
  const origin = request.nextUrl.origin;

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:4001';
  const ssoLogoutUrl = new URL('/logout', authUrl);
  ssoLogoutUrl.searchParams.set('redirect_uri', `${origin}${safeReturnTo}`);

  return NextResponse.redirect(ssoLogoutUrl.toString());
}
