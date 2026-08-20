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
 * Origin asal request sebenarnya. `request.nextUrl.origin` dibangun dari
 * header `Host` mentah yang diterima Next.js — di belakang reverse proxy
 * (Traefik/Coolify) ini kadang meleset (mis. jadi bind address container
 * sendiri, `0.0.0.0:3000`, bukan domain publik). `X-Forwarded-Host` +
 * `X-Forwarded-Proto` jauh lebih bisa dipercaya karena proxy SELALU
 * men-set-nya sendiri berdasarkan request asli dari browser, terlepas dari
 * isu apapun di penerusan `Host` biasa.
 */
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    const forwardedProto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

/**
 * W1 auth renderer: mulai login SSO Bagdja.
 * Redirect ke /oauth/authorize dengan PKCE; code_verifier + next path
 * disimpan di Redis (lihat lib/oauth-state-store.ts).
 */
export async function GET(request: NextRequest) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  // Origin asal login (localhost / custom domain subdomain) — callback
  // pakai ini untuk redirect balik, karena request.url di callback selalu
  // localhost (redirect_uri OAuth fixed).
  const origin = resolveOrigin(request);
  console.log(
    `[auth/login] host=${request.headers.get('host')} x-forwarded-host=${request.headers.get('x-forwarded-host')} x-forwarded-proto=${request.headers.get('x-forwarded-proto')} resolvedOrigin=${origin}`,
  );

  const stateId = generateStateId();
  const saved = await saveOAuthState(stateId, { codeVerifier, next, origin });
  if (!saved) {
    console.error('Redis belum dikonfigurasi (REDIS_URL)');
    return NextResponse.redirect(
      new URL('/?error=server_misconfigured', request.url),
    );
  }

  const authorizeUrl = buildAuthorizeUrl(stateId, codeChallenge);
  return NextResponse.redirect(authorizeUrl);
}
