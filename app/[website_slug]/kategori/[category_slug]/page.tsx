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
import { getTemplateRenderer, type TemplateRenderProps } from '../../../../lib/template-registry';
import { renderPinnedTenantHeader } from '../../../../lib/template-runtime-route';
import { hostRendererSlug, templateOwnsPage, tenantRuntime, tenantTemplateTheme } from '../../../../lib/tenant-template';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { sanitizeWebsiteTheme } from '../../../../lib/website-theme';

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

  // Template package tidak merender halaman ini → konten memakai tampilan Bagdja,
  // header tetap milik designer bila manifest menyatakan `header`.
  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'category_listing', content: { category_id: category.id, category_label: category.label } },
  ];

  const props: TemplateRenderProps = {
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
    templateTheme: tenantTemplateTheme(website),
    websiteTheme: sanitizeWebsiteTheme(website.theme),
    sections,
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
  };
  const runtime = tenantRuntime(website);
  const designerHeader = runtime && templateOwnsPage(website, 'header')
    ? await renderPinnedTenantHeader({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        candidateDigest: runtime.candidateDigest,
        bottomNav: templateOwnsPage(website, 'bottom_nav'),
        tenantSlug: website.slug,
        props,
      })
    : { node: null, active: false };

  return (
    <>
      {designerHeader.node}
      <CartProvider slug={params.website_slug}>
        <Renderer {...props} hideHeader={designerHeader.active} />
      </CartProvider>
    </>
  );
}
