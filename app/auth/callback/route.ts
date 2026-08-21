import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies } from '../../../lib/session';
import { syncUserToBackend } from '../../../lib/backend-api';
import { consumeOAuthState } from '../../../lib/oauth-state-store';

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:4001';
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'bagdja-website';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? '';
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5005/auth/callback';

/**
 * W1 auth renderer: callback OAuth — tukar code → access_token,
 * set session cookie `site_token`, redirect ke next path (default home).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log(`[auth/callback] code=${code ? 'present' : 'null'} state=${state} error=${error ?? 'null'}`);

  if (error) {
    return NextResponse.redirect(new URL('/?error=auth_denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', request.url));
  }

  const decoded = await consumeOAuthState(state);
  if (!decoded) {
    console.error(`[auth/callback] consumeOAuthState returned null for state=${state}`);
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
  }

  const codeVerifier = decoded.codeVerifier;

  try {
    const tokenRes = await fetch(`${AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Token exchange failed:', errBody);
      return NextResponse.redirect(new URL('/?error=token_failed', request.url));
    }

    const data = await tokenRes.json();
    const accessToken: string = data.access_token;

    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );

    const nextPath = decoded.next;
    const redirectTo =
      nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : '/';
    // Redirect balik ke ORIGIN asal login (localhost / custom domain),
    // bukan ke request.url (selalu localhost karena redirect_uri OAuth fixed).
    const origin = decoded.origin ?? request.nextUrl.origin;
    const response = NextResponse.redirect(new URL(redirectTo, origin));

    // Cookie di-attach LANGSUNG ke response ini (bukan lewat cookies()
    // ambient) — lihat catatan di lib/session.ts kenapa ini penting.
    setSessionCookies(response, accessToken, {
      userId: payload.sub ?? payload.userId,
      email: payload.email,
      username: payload.username,
      avatar: payload.picture ?? payload.avatar,
    });

    // Sync user ke Website API DB (upsert users table)
    await syncUserToBackend(accessToken);

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}
