import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { backendFetch } from '../../../../lib/backend-api';
import { getAuthViewState } from '../../../../lib/auth-view';
import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import { CartProvider } from '../../../../lib/cart';
import { toBlogPostItem, toCatalogItem, toFaqItem, toLocationItem, toNavPage, type SectionEntry } from '../../../../lib/template-data';
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';
import type { OrderDetail, TransactionDetail } from '../../../../components/order-detail-content';
import { draftOrderHref, transactionHref } from '../../../../lib/order-href';

export const revalidate = 60;

interface TransactionPageProps {
  params: { website_slug: string; transaction_id: string };
}

export async function generateMetadata({ params }: TransactionPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Detail Transaksi — ${tenant.website.name}` };
}

export default async function TransactionPage({ params }: TransactionPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;

  const basePath = resolveTenantLinkBase(params.website_slug);
  const auth = await getAuthViewState(`${basePath}/order/${params.transaction_id}`, basePath);
  const { website, products, locations, faqs, blogPosts } = tenant;
  const result = await backendFetch<TransactionDetail>(`/api/transactions/${params.transaction_id}?website_id=${encodeURIComponent(website.id)}`);
  if (!result.data || result.status >= 400) {
    const orderResult = await backendFetch<OrderDetail>(`/api/orders/${params.transaction_id}`);
    if (orderResult.data?.transaction_id) {
      redirect(transactionHref(basePath, orderResult.data.transaction_id));
    }
    if (orderResult.data) {
      redirect(draftOrderHref(basePath, orderResult.data.id));
    }
    notFound();
  }

  if (result.data.parent_transaction_id && result.data.parent_transaction_id !== params.transaction_id) {
    redirect(transactionHref(basePath, result.data.parent_transaction_id));
  }

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();
  const sections: SectionEntry[] = [{ type: 'order_detail', content: { transaction: result.data, order: null } }];

  return (
    <CartProvider slug={params.website_slug}>
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
