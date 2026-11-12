/**
 * Halaman Checkout (W2/W2.7). Server Component: load tenant + auth, lalu
 * render lewat template `Renderer` dengan section type `checkout` —
 * header/footer/theme konsisten dengan halaman lain. Konten interaktif
 * (detail pesanan, alamat pengiriman, kurir, submit) di
 * `components/checkout-content.tsx` (client). Route diprotect middleware
 * (wajib login buyer).
 */
import { hostRendererSlug, templateOwnsPage, tenantRuntime } from '../../../lib/tenant-template';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getAuthViewState } from '../../../lib/auth-view';
import { loadTenant } from '../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../components/website-inactive-notice';
import { CartProvider } from '../../../lib/cart';
import {
  toBlogPostItem,
  toCatalogItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../../../lib/template-data';
import { getTemplateRenderer } from '../../../lib/template-registry';
import type { TemplateRenderProps } from '../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../lib/website-theme';
import { renderPinnedTenantHeader } from '../../../lib/template-runtime-route';

export const revalidate = 60;

interface CheckoutPageProps {
  params: { website_slug: string };
  searchParams?: { order_ids?: string };
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Checkout — ${tenant.website.name}` };
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/checkout`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  // order_ids dari halaman cart (checkbox multi-item), comma-separated.
  const orderIds = (searchParams?.order_ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const sections: SectionEntry[] = [
    {
      type: 'checkout',
      content: { slug: params.website_slug, websiteId: website.id, orderIds },
    },
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
    templateTheme: extractTemplateTheme(website.template?.structure),
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
  const designerHeader = runtime && templateOwnsPage(website, 'header')
    ? await renderPinnedTenantHeader({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        tenantSlug: website.slug,
        props,
      })
    : { node: null, active: false };

  return (
    <>
      {designerHeader.node}
      <CartProvider slug={params.website_slug}>
        <Renderer
          {...props}
          hideHeader={designerHeader.active}
          checkoutDesign={designerHeader.active ? 'store-classic' : undefined}
        />
      </CartProvider>
    </>
  );
}
