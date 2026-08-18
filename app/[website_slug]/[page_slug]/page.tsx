import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getWebsiteBySlug } from '../../../lib/api-client';
import { getAuthViewState } from '../../../lib/auth-view';
import { loadTenant } from '../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../components/website-inactive-notice';
import {
  resolveSections,
  toBlogPostItem,
  toCatalogItem,
  toCategoryItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
} from '../../../lib/template-data';
import { getTemplateRenderer } from '../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../lib/website-theme';

export const revalidate = 60;

interface TenantSubPageProps {
  params: { website_slug: string; page_slug: string };
}

export async function generateMetadata({ params }: TenantSubPageProps): Promise<Metadata> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website) return {};

  const page = website.pages.find((p) => p.slug === params.page_slug);
  return {
    title: page ? `${page.title} · ${website.name}` : website.name,
    description: website.tagline ?? undefined,
  };
}

export default async function TenantSubPage({ params }: TenantSubPageProps) {
  const tenant = await loadTenant(params.website_slug, params.page_slug);
  if (!tenant || !tenant.page) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(`/${params.website_slug}`);

  const { website, page, products, categories, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  return (
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
      sections={resolveSections(page, website.template, false)}
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
  );
}
