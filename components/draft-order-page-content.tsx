import { notFound, redirect } from 'next/navigation';

import { backendFetch } from '../lib/backend-api';
import { getAuthViewState } from '../lib/auth-view';
import { CartProvider } from '../lib/cart';
import { loadTenant } from '../lib/tenant-loader';
import {
  toBlogPostItem,
  toCatalogItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../lib/template-data';
import { getTemplateRenderer } from '../lib/template-registry';
import { resolveTenantLinkBase } from '../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../lib/website-theme';
import type { OrderDetail } from './order-detail-content';
import WebsiteInactiveNotice from './website-inactive-notice';
import { transactionHref } from '../lib/order-href';

interface DraftOrderPageContentProps {
  websiteSlug: string;
  orderId: string;
}

export default async function DraftOrderPageContent({
  websiteSlug,
  orderId,
}: DraftOrderPageContentProps) {
  const tenant = await loadTenant(websiteSlug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;

  const basePath = resolveTenantLinkBase(websiteSlug);
  const auth = await getAuthViewState(`${basePath}/cart/order/${orderId}`, basePath);
  const { website, products, locations, faqs, blogPosts } = tenant;
  const result = await backendFetch<OrderDetail>(`/api/orders/${orderId}`);
  if (result.status === 401) {
    redirect(`/auth/login?next=${encodeURIComponent(`${basePath}/cart/order/${orderId}`)}`);
  }
  if (!result.data || result.status >= 400) notFound();
  if (result.data.transaction_id) {
    redirect(transactionHref(basePath, result.data.transaction_id));
  }

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();
  const sections: SectionEntry[] = [{ type: 'order_detail', content: { order: result.data, transaction: null } }];

  return (
    <CartProvider slug={websiteSlug}>
      <Renderer
        isPreview={false}
        profile={{ name: website.name, tagline: website.tagline ?? undefined, logoUrl: website.logo_url ?? undefined, whatsapp: website.whatsapp ?? undefined, phone: website.phone ?? undefined, email: website.email ?? undefined, socialLinks: website.social_links }}
        templateTheme={extractTemplateTheme(website.template?.structure)}
        websiteTheme={sanitizeWebsiteTheme(website.theme)}
        sections={sections}
        products={products.map(toCatalogItem)}
        locations={locations.map(toLocationItem)}
        faqs={faqs.map(toFaqItem)}
        websiteSlug={basePath}
        websiteId={website.id}
        tenantSlug={website.slug}
        pages={website.pages.map(toNavPage)}
        blogPosts={blogPosts.map(toBlogPostItem)}
        auth={auth}
      />
    </CartProvider>
  );
}