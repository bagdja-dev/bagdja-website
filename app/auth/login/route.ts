import { NextRequest, NextResponse } from 'next/server';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizeUrl,
} from '../../../lib/auth';
import { generateStateId, saveOAuthState } from '../../../lib/oauth-state-store';
import { resolveOrigin } from '../../../lib/resolve-origin';
import { clearSessionCookies } from '../../../lib/session';
import { resolvePlatformSubdomain } from '../../../lib/tenant-host';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';
const PLATFORM_HOST = (() => {
  try {
    const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL;
    return platformUrl ? new URL(platformUrl).hostname : 'sites.bagdja.com';
  } catch {
    return 'sites.bagdja.com';
  }
})();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const WEBSITE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next; //test
}

async function resolveWebsiteSlug(origin: string, next: string | null): Promise<string | null> {
  const { hostname } = new URL(origin);
  const subdomainSlug = resolvePlatformSubdomain(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (LOCAL_HOSTS.has(hostname) || hostname === PLATFORM_HOST) {
    const pathSlug = next?.split('/')[1] ?? '';
    return WEBSITE_SLUG_PATTERN.test(pathSlug) && pathSlug !== 'templates' ? pathSlug : null;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/public/resolve-domain?host=${encodeURIComponent(hostname)}`,
      { next: { revalidate: 300 } },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(`[auth/login] Website domain resolution failed with status ${response.status}`);
      return null;
    }
    const result = (await response.json()) as { slug?: unknown };
    return typeof result.slug === 'string' && WEBSITE_SLUG_PATTERN.test(result.slug) ? result.slug : null;
  } catch (error) {
    console.error('[auth/login] Website domain resolution request failed:', error);
    return null;
  }
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
  const brand = await resolveWebsiteSlug(origin, next);
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

  const authorizeUrl = buildAuthorizeUrl(stateId, codeChallenge, false, brand);
  const response = NextResponse.redirect(authorizeUrl);
  clearSessionCookies(response, origin);
  return response;
}
