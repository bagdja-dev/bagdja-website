import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookies } from '../../../lib/session';
import { resolveOrigin } from '../../../lib/resolve-origin';

/**
 * W1 auth renderer: logout.
 * - Clear session cookie renderer (`site_token`).
 * - Redirect ke SSO logout Bagdja dengan `redirect_uri` = origin + returnTo
 *   supaya setelah SSO logout user kembali ke halaman asal (localhost / custom
 *   domain). `returnTo` dari query (disusun getAuthViewState).
 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/';
  const origin = resolveOrigin(request);

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:4001';
  const ssoLogoutUrl = new URL('/logout', authUrl);
  ssoLogoutUrl.searchParams.set('redirect_uri', `${origin}${safeReturnTo}`);

  const response = NextResponse.redirect(ssoLogoutUrl.toString());
  clearSessionCookies(response);
  return response;
}
