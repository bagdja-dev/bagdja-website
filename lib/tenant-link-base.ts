import { headers } from 'next/headers';

const PLATFORM_HOSTNAMES = new Set([
  'sites.bagdja.com',
  'website.bagdja.com',
]);

const PLATFORM_HOST = (() => {
  try {
    const envHost = process.env.NEXT_PUBLIC_PLATFORM_URL;
    if (envHost) {
      const hostname = new URL(envHost).hostname;
      PLATFORM_HOSTNAMES.add(hostname);
      return hostname;
    }
  } catch {
    // ignore invalid URL and fall back below
  }

  return 'sites.bagdja.com';
})();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Base path untuk link internal (nav, produk, blog, dst) di halaman tenant.
 *
 * Kosong (`''`) kalau diakses via subdomain (`{slug}.sites.bagdja.com`) atau
 * custom domain (`www.tokosaya.com`) — hostname sudah menyiratkan slug-nya,
 * jadi link internal harus root-relative (`/artikel`), BUKAN `/{slug}/artikel`
 * (dulu ini bug: link jadi dobel slug, mis.
 * `barberjhons.sites.bagdja.com/barberjhons/artikel`).
 *
 * `/{slug}` kalau diakses path-based (local dev via localhost, yang belum
 * punya DNS wildcard nyata — lihat `admin/app/lib/preview-url.ts`).
 */
export function resolveTenantLinkBase(websiteSlug: string): string {
  const host = headers().get('host') ?? '';
  const hostname = host.split(':')[0];
  if (LOCAL_HOSTS.has(hostname) || PLATFORM_HOSTNAMES.has(hostname) || hostname === PLATFORM_HOST) {
    return `/${websiteSlug}`;
  }
  return '';
}
