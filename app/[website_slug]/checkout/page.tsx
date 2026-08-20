/**
 * Halaman Checkout (W2/W2.7). Server Component: load tenant + auth, lalu
 * render lewat template `Renderer` dengan section type `checkout` —
 * header/footer/theme konsisten dengan halaman lain. Konten interaktif
 * (detail pesanan, alamat pengiriman, kurir, submit) di
 * `components/checkout-content.tsx` (client). Route diprotect middleware
 * (wajib login buyer).
 */
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
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../lib/website-theme';

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
  const auth = await getAuthViewState(`${resolveTenantLinkBase(params.website_slug)}/checkout`);

  const { website, products, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  // W2.9: order_ids dari halaman cart (checkbox multi-item), comma-separated.
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
