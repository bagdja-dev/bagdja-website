/**
 * Persiapan props View template untuk halaman tenant — dipakai bersama oleh
 * route publik (`[website_slug]/page.tsx`, `[website_slug]/[page_slug]/page.tsx`)
 * dan route preview Studio (`[website_slug]/__preview`). Caching: route publik
 * memanggil tanpa `options` (tetap ISR, fetch `revalidate: 60`); route preview
 * mengirim `{ fresh: true }` (fetch `cache: 'no-store'`).
 */
import { getAuthViewState } from './auth-view';
import type { PublicFetchOptions } from './api-client';
import { loadTenant, type TenantData } from './tenant-loader';
import {
  resolveSections,
  toBlogPostItem,
  toCatalogItem,
  toCategoryItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
} from './template-data';
import type { TemplateRenderProps } from './template-registry';
import { resolveTenantLinkBase } from './tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from './website-theme';

export type TenantPageViewResult =
  | { status: 'not_found' }
  | { status: 'inactive' }
  | {
      status: 'ok';
      tenant: TenantData;
      /** `null` bila website belum punya template (route memanggil notFound). */
      templateSlug: string | null;
      props: TemplateRenderProps;
    };

/**
 * `pageSlug` kosong = halaman home (fallback section template diizinkan);
 * diisi = halaman lain (tanpa fallback, `page` wajib ada).
 */
export async function loadTenantPageView(
  websiteSlug: string,
  pageSlug?: string,
  options?: PublicFetchOptions,
): Promise<TenantPageViewResult> {
  const tenant = await loadTenant(websiteSlug, pageSlug, options);
  if (!tenant) return { status: 'not_found' };
  if (pageSlug && !tenant.page) return { status: 'not_found' };
  if (tenant.subscription_inactive) return { status: 'inactive' };

  const linkBase = resolveTenantLinkBase(websiteSlug);
  const auth = await getAuthViewState(pageSlug ? `${linkBase}/${pageSlug}` : linkBase || '/', linkBase);

  const { website, page, products, categories, locations, faqs, blogPosts } = tenant;

  return {
    status: 'ok',
    tenant,
    templateSlug: website.template?.slug ?? null,
    props: {
      isPreview: false,
      profile: {
        name: website.name,
        tagline: website.tagline ?? undefined,
        logoUrl: website.logo_url ?? undefined,
        whatsapp: website.whatsapp ?? undefined,
        phone: website.phone ?? undefined,
        email: website.email ?? undefined,
        socialLinks: website.social_links,
        footerSettings: website.footer_settings,
      },
      templateTheme: extractTemplateTheme(website.template?.structure),
      websiteTheme: sanitizeWebsiteTheme(website.theme),
      sections: resolveSections(page, website.template, !pageSlug),
      products: products.map(toCatalogItem),
      categories: categories.map(toCategoryItem),
      locations: locations.map(toLocationItem),
      faqs: faqs.map(toFaqItem),
      websiteSlug: resolveTenantLinkBase(website.slug),
      websiteId: website.id,
      tenantSlug: website.slug,
      pages: website.pages.map(toNavPage),
      blogPosts: blogPosts.map(toBlogPostItem),
      auth,
    },
  };
}
