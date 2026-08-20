import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getWebsiteBySlug } from '../../lib/api-client';
import { CartProvider } from '../../lib/cart';
import { getAuthViewState } from '../../lib/auth-view';
import { loadTenant } from '../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../components/website-inactive-notice';
import {
  resolveSections,
  toBlogPostItem,
  toCatalogItem,
  toCategoryItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
} from '../../lib/template-data';
import { getTemplateRenderer } from '../../lib/template-registry';
import { resolveTenantLinkBase } from '../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../lib/website-theme';

export const revalidate = 60;

interface TenantPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website) return {};

  return {
    title: website.name,
    description: website.tagline ?? undefined,
  };
}

export default async function TenantPage({ params }: TenantPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(`/${params.website_slug}`);

  const { website, page, products, categories, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  return (
    <CartProvider slug={params.website_slug}>
    <Renderer
      isPreview={false}
      profile={{
        name: website.name,
        tagline: website.tagline ?? undefined,
        logoUrl: website.logo_url ?? undefined,
        whatsapp: website.whatsapp ?? undefined,
        phone: website.phone ?? undefined,
        email: website.email ?? undefined,
        socialLinks: website.social_links,
      }}
      templateTheme={extractTemplateTheme(website.template?.structure)}
      websiteTheme={sanitizeWebsiteTheme(website.theme)}
      sections={resolveSections(page, website.template)}
      products={products.map(toCatalogItem)}
      categories={categories.map(toCategoryItem)}
      locations={locations.map(toLocationItem)}
      faqs={faqs.map(toFaqItem)}
      websiteSlug={resolveTenantLinkBase(website.slug)}
      tenantSlug={website.slug}
      pages={website.pages.map(toNavPage)}
      blogPosts={blogPosts.map(toBlogPostItem)}
      auth={auth}
    />
    </CartProvider>
  );
}
