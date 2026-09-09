import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies, isPlatformHost } from '../../../lib/session';
import { syncUserToBackend } from '../../../lib/backend-api';
import { consumeOAuthState, generateStateId, saveSessionHandoff } from '../../../lib/oauth-state-store';

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

    const user = {
      userId: payload.sub ?? payload.userId,
      email: payload.email,
      username: payload.username,
      avatar: payload.picture ?? payload.avatar,
    };

    // Sync user ke Website API DB (upsert users table) — dilakukan sekali di
    // sini regardless jalur cookie di bawah (platform host vs custom
    // domain), efek sampingnya independen dari cookie-domain concern.
    await syncUserToBackend(accessToken);

    const originHostname = new URL(origin).hostname;
    if (isPlatformHost(originHostname) || originHostname === 'localhost' || originHostname === '127.0.0.1') {
      // Subdomain platform kita sendiri ({slug}.sites.bagdja.com) atau
      // localhost dev — cookie wildcard/host-only valid di-set langsung dari
      // sini (host callback ini SENDIRI juga bagian dari domain yang sama
      // atau localhost), jalur pendek seperti sebelumnya.
      const response = NextResponse.redirect(new URL(redirectTo, origin));
      setSessionCookies(response, accessToken, user, origin);
      return response;
    }

    // Domain custom Owner (mis. tokosaya.com) — SECARA FUNDAMENTAL tidak
    // bisa di-set cookie-nya dari sini (host callback ini tetap host
    // NEXT_PUBLIC_PLATFORM_URL, redirect_uri OAuth yang fixed, RFC 6265
    // melarang cookie lintas domain yang tidak terkait). Titipkan payload
    // sesi lewat handoff sekali-pakai, redirect ke /auth/session di origin
    // TENANT ASLI — baru di sana cookie benar-benar bisa di-set. Lihat
    // docblock SessionHandoffPayload di lib/oauth-state-store.ts.
    const handoffId = generateStateId();
    const saved = await saveSessionHandoff(handoffId, { accessToken, user, redirectTo });
    if (!saved) {
      return NextResponse.redirect(new URL('/?error=server_misconfigured', request.url));
    }

    return NextResponse.redirect(new URL(`/auth/session?handoff=${handoffId}`, origin));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}
