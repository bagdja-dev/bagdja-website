import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CartProvider } from '../../../../lib/cart';
import { getAuthViewState } from '../../../../lib/auth-view';
import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import {
  slugifyLabel,
  toBlogPostItem,
  toCatalogItem,
  toCategoryItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../../../../lib/template-data';
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';

export const revalidate = 60;

interface CategoryPageProps {
  params: { website_slug: string; category_slug: string };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  const category = tenant?.categories.find((c) => slugifyLabel(c.label) === params.category_slug);
  if (!tenant || !category) return {};

  return {
    title: `${category.label} · ${tenant.website.name}`,
    description: tenant.website.tagline ?? undefined,
  };
}

/** Halaman listing kategori tersendiri — dituju saat klik tile di section `category_grid` (lihat store-classic-catalog.tsx / barber-classic-catalog.tsx). */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/kategori/${params.category_slug}`,
    resolveTenantLinkBase(params.website_slug),
  );

  const category = tenant.categories.find((c) => slugifyLabel(c.label) === params.category_slug);
  if (!category) notFound();

  const { website, products, categories, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'category_listing', content: { category_id: category.id, category_label: category.label } },
  ];

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
      sections={sections}
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
