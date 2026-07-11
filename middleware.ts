/**
 * Resolusi tenant berdasarkan Host header, 3 kasus (lihat plan Phase 8a).
 * Platform host untuk web renderer publik = NEXT_PUBLIC_PLATFORM_URL (default
 * sites.bagdja.com) — SENGAJA beda dari website.bagdja.com yang dipakai admin
 * CMS, supaya subdomain tenant tidak nempel di domain admin.
 *
 *  1. Host = apex platform (`sites.bagdja.com`) + path /{slug}/...
 *     -> redirect permanen ke subdomain https://{slug}.sites.bagdja.com/...
 *  2. Host = {slug}.sites.bagdja.com (wildcard subdomain)
 *     -> rewrite ke /{slug}/... (slug diambil langsung dari hostname, tanpa panggilan API)
 *  3. Host lain (kandidat custom domain)
 *     -> tanya API GET /api/public/resolve-domain?host=..., rewrite kalau ketemu
 *
 * Semua rewrite memakai prefix generik `/{slug}${pathname}` sehingga route
 * [website_slug]/... yang sudah ada dipakai apa adanya, tanpa perubahan.
 */
import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';
const PLATFORM_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://website.bagdja.com').hostname;
  } catch {
    return 'website.bagdja.com';
  }
})();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Top-level static routes under web/app/ that are NOT tenant slugs (e.g. the
// dev template-preview route at /templates/...) — must not be redirected to
// a "tenant subdomain" as if they were a website slug.
const RESERVED_TOP_LEVEL_PATHS = new Set(['templates']);

const SUBDOMAIN_PATTERN = new RegExp(`^([a-z0-9-]+)\\.${PLATFORM_HOST.replace(/\./g, '\\.')}$`);

async function resolveSlugForDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/resolve-domain?host=${encodeURIComponent(host)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string };
    return data.slug ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host') ?? '';
  const hostname = hostHeader.split(':')[0];

  if (!hostname || LOCAL_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  // Case 1: apex platform host + /{slug}/... -> modernize to subdomain
  if (hostname === PLATFORM_HOST) {
    const [, slug, ...rest] = request.nextUrl.pathname.split('/');
    if (slug && !RESERVED_TOP_LEVEL_PATHS.has(slug)) {
      const redirectUrl = new URL(request.nextUrl);
      redirectUrl.protocol = 'https:';
      redirectUrl.host = `${slug}.${PLATFORM_HOST}`;
      redirectUrl.pathname = rest.length ? `/${rest.join('/')}` : '/';
      return NextResponse.redirect(redirectUrl, 308);
    }
    return NextResponse.next();
  }

  // Case 2: wildcard subdomain -> rewrite using the slug parsed straight from the hostname
  const subdomainMatch = hostname.match(SUBDOMAIN_PATTERN);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Case 3: candidate custom domain -> ask the API
  const slug = await resolveSlugForDomain(hostname);
  if (slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
