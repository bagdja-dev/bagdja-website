/**
 * Halaman Daftar Transaksi buyer — W2/W6 list orders.
 *
 * Server Component: load tenant + auth, lalu render lewat template `Renderer`
 * dengan section type `orders` — header/footer/theme konsisten dengan home &
 * halaman lain. Konten interaktif (tabs filter, fetch list, kartu transaksi,
 * tombol detail/bayar) di `components/orders-content.tsx` (client).
 * Route diprotect middleware (wajib login buyer, via PROTECTED_PATH_PATTERN).
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

interface OrdersPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Daftar Transaksi — ${tenant.website.name}` };
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(`${resolveTenantLinkBase(params.website_slug)}/orders`);

  const { website, products, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'orders', content: { slug: params.website_slug } },
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
