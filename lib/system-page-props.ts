import type { AuthViewState } from './auth-view';
import { toBlogPostItem, toCatalogItem, toFaqItem, toLocationItem, toNavPage, type SectionEntry } from './template-data';
import type { TemplateRenderProps } from './template-registry';
import type { TenantData } from './tenant-loader';
import { extractTemplateTheme, sanitizeWebsiteTheme } from './website-theme';

/** Props template standar untuk halaman sistem (dipakai renderer bawaan maupun template package). */
export function buildSystemPageProps(
  tenant: TenantData,
  options: { basePath: string; auth: AuthViewState; sections: SectionEntry[] },
): TemplateRenderProps {
  const { website, products, locations, faqs, blogPosts } = tenant;
  return {
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
    sections: options.sections,
    products: products.map(toCatalogItem),
    locations: locations.map(toLocationItem),
    faqs: faqs.map(toFaqItem),
    websiteSlug: options.basePath,
    websiteId: website.id,
    tenantSlug: website.slug,
    pages: website.pages.map(toNavPage),
    blogPosts: blogPosts.map(toBlogPostItem),
    auth: options.auth,
  };
}
