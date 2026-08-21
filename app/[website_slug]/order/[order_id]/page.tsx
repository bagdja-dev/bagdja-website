/**
 * Halaman status order (W2/W2.8). Server Component.
 *
 * Dirender lewat template `Renderer` (section type `order_detail`) supaya
 * header/footer/theme konsisten dengan cart/checkout/orders/home — sama
 * pola dengan `app/[website_slug]/orders/page.tsx`.
 *
 * W2.8: alur baru — checkout membuat TRANSACTION, redirect payment
 * mengarah ke `/order/{transaction.id}`. Halaman ini coba fetch
 * `/api/transactions/:id` dulu; kalau 404 → fallback ke order legacy
 * (`/api/orders/:id`, order lama sebelum W2.8 yang masih pakai escrow di
 * level order). Konten read-only-nya ada di `components/order-detail-content.tsx`.
 *
 * Tombol "Konfirmasi Terima" (release milestone) BELUM ada — menyusul W5.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { backendFetch } from '../../../../lib/backend-api';
import { getAuthViewState } from '../../../../lib/auth-view';
import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import { CartProvider } from '../../../../lib/cart';
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
import type { OrderDetail, TransactionDetail } from '../../../../components/order-detail-content';

interface OrderStatusPageProps {
  params: { website_slug: string; order_id: string };
}

export async function generateMetadata({ params }: OrderStatusPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Status Pesanan — ${tenant.website.name}` };
}

export default async function OrderStatusPage({ params }: OrderStatusPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/order/${params.order_id}`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  // Alur baru: id = transaction id. Fallback: order legacy.
  const { data: transaction, status: txStatus } =
    await backendFetch<TransactionDetail>(`/api/transactions/${params.order_id}`);

  if (txStatus === 401) notFound();

  let order: OrderDetail | null = null;
  if (!transaction) {
    const orderResult = await backendFetch<OrderDetail>(`/api/orders/${params.order_id}`);
    if (orderResult.status === 404 || !orderResult.data) notFound();
    order = orderResult.data;
  }

  const sections: SectionEntry[] = [
    { type: 'order_detail', content: { transaction, order } },
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
