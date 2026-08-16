import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import {
  toBlogPostItem,
  toCatalogItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../../../../lib/template-data';
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';

export const revalidate = 60;

interface ProductDetailPageProps {
  params: { website_slug: string; product_slug: string };
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  const product = tenant?.products.find((p) => p.slug === params.product_slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;

  const { website, products, locations, faqs, blogPosts } = tenant;
  const product = products.find((p) => p.slug === params.product_slug);
  if (!product) notFound();

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'product_detail', content: { product: toCatalogItem(product) } },
  ];

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
      sections={sections}
      products={products.map(toCatalogItem)}
      locations={locations.map(toLocationItem)}
      faqs={faqs.map(toFaqItem)}
      websiteSlug={resolveTenantLinkBase(website.slug)}
      pages={website.pages.map(toNavPage)}
      blogPosts={blogPosts.map(toBlogPostItem)}
    />
  );
}
