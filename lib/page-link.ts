/** Link menu halaman tenant (internal `/slug` atau tautan eksternal). Diekspor ulang lewat template-data.ts. */

export interface NavPage {
  slug: string;
  title: string;
  isHome: boolean;
  placement: string;
  /** Terisi bila halaman bertipe "Tautan eksternal" (`link_mode = 'external'`): menu langsung menuju URL ini. */
  externalUrl?: string;
}

export interface PageLinkSource {
  link_mode?: 'internal' | 'external';
  external_url?: string | null;
}

const EXTERNAL_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * URL tujuan halaman bertipe tautan eksternal, atau `undefined` bila halaman internal /
 * URL kosong / skema tidak aman (mis. `javascript:`). URL tanpa skema (`www.contoh.com`)
 * dianggap https.
 */
export function resolveExternalPageUrl(page: PageLinkSource): string | undefined {
  if (page.link_mode !== 'external') return undefined;
  const raw = page.external_url?.trim();
  if (!raw) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`;
  try {
    const url = new URL(withScheme);
    return EXTERNAL_LINK_SCHEMES.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `basePath` sudah pre-computed oleh caller (lihat `resolveTenantLinkBase`) —
 * kosong ('') untuk subdomain/custom domain, `/{slug}` untuk path-based
 * (local dev). Jangan diisi raw slug tanpa lewat situ, supaya tidak dobel
 * slug di URL (`{slug}.sites.bagdja.com/{slug}/...`).
 */
export function buildPageHref(basePath: string, page: NavPage): string {
  if (page.externalUrl) return page.externalUrl;
  if (page.isHome) return basePath || '/';
  return `${basePath}/${page.slug}`;
}

/**
 * Atribut tambahan untuk `<a>` menu: link absolut http(s) selalu berasal dari halaman
 * tautan eksternal (link internal tenant selalu relatif), jadi dibuka di tab baru.
 */
export function navLinkTargetProps(href: string): { target?: '_blank'; rel?: string } {
  return /^https?:\/\//i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
