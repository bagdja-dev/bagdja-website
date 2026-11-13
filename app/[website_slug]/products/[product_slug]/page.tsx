import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getAuthViewState } from '../../../../lib/auth-view';
import { CartProvider } from '../../../../lib/cart';
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
import { getTemplateRenderer, type TemplateRenderProps } from '../../../../lib/template-registry';
import { renderPinnedTenantHeader, renderPinnedTenantTemplate } from '../../../../lib/template-runtime-route';
import { buildProductDetailPage, createPageKeyFactory, PUBLIC_PAGE_KEY_SCOPE } from '../../../../lib/template-pages';
import { hostRendererSlug, templateOwnsPage, tenantRuntime, tenantTemplateTheme } from '../../../../lib/tenant-template';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { sanitizeWebsiteTheme } from '../../../../lib/website-theme';

export const revalidate = 60;

interface ProductDetailPageProps {
  params: { website_slug: string; product_slug: string };
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  const product = tenant?.products.find((p) => p.slug === params.product_slug || p.id === params.product_slug);
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
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/products/${params.product_slug}`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;
  const product = products.find((p) => p.slug === params.product_slug || p.id === params.product_slug);
  if (!product) notFound();
  if (product.slug && product.slug !== params.product_slug) {
    redirect(`${resolveTenantLinkBase(params.website_slug)}/products/${product.slug}`);
  }

  // Template package tidak merender halaman ini → konten memakai tampilan Bagdja,
  // header tetap milik designer bila manifest menyatakan `header`.
  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'product_detail', content: { product: toCatalogItem(product) } },
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
  // Detail produk gathering milik template package (template-owned-system-pages-plan.md §8.6).
  // Produk lain, atau bila render template gagal, tetap tampilan Bagdja di bawah.
  if (runtime && product.type === 'gathering' && templateOwnsPage(website, 'product_detail')) {
    const catalogProducts = props.products ?? [];
    const page = buildProductDetailPage(
      toCatalogItem(product),
      catalogProducts.filter((item) => item.category && item.category === toCatalogItem(product).category),
      {
        key: createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE),
        basePath: resolveTenantLinkBase(params.website_slug),
        loggedIn: auth.isLoggedIn,
      },
    );
    const templatePage = await renderPinnedTenantTemplate({
      templateSlug: runtime.slug,
      pinnedVersion: runtime.version,
      candidateDigest: runtime.candidateDigest,
      tenantSlug: website.slug,
      props: { ...props, sections: [], page },
    });
    if (templatePage) return templatePage;
  }
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
