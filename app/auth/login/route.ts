import { NextRequest, NextResponse } from 'next/server';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizeUrl,
} from '../../../lib/auth';
import { generateStateId, saveOAuthState } from '../../../lib/oauth-state-store';

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next; //test
}

/**
 * W1 auth renderer: mulai login SSO Bagdja.
 * Redirect ke /oauth/authorize dengan PKCE; code_verifier + next path
 * disimpan di Upstash Redis (pola admin).
 */
export async function GET(request: NextRequest) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  // Origin asal login (localhost / custom domain subdomain) — callback
  // pakai ini untuk redirect balik, karena request.url di callback selalu
  // localhost (redirect_uri OAuth fixed).
  const origin = request.nextUrl.origin;

  const stateId = generateStateId();
  const saved = await saveOAuthState(stateId, { codeVerifier, next, origin });
  if (!saved) {
    console.error(
      'Upstash Redis belum dikonfigurasi (KV_REST_API_URL/TOKEN atau UPSTASH_REDIS_REST_URL/TOKEN)',
    );
    return NextResponse.redirect(
      new URL('/?error=server_misconfigured', request.url),
    );
  }

  const authorizeUrl = buildAuthorizeUrl(stateId, codeChallenge);
  return NextResponse.redirect(authorizeUrl);
}
