import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { backendFetch } from '../../../../lib/backend-api';
import { getAuthViewState } from '../../../../lib/auth-view';
import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import TransactionLoadError from '../../../../components/transaction-load-error';
import { CartProvider } from '../../../../lib/cart';
import { toBlogPostItem, toCatalogItem, toFaqItem, toLocationItem, toNavPage, type SectionEntry } from '../../../../lib/template-data';
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';
import type { OrderDetail, TransactionDetail } from '../../../../components/order-detail-content';
import { draftOrderHref, transactionHref } from '../../../../lib/order-href';

export const revalidate = 60;

/** Mirror `TransactionSyncResponseDto` (bagdja-website-api) — hasil POST /api/transactions/:id/sync. */
interface TransactionSyncResult {
  id: string;
  status: string;
  synced: boolean;
  sync_errors: Array<'escrow' | 'direct_payment' | 'termin' | 'digital_delivery'>;
}

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
  const detailPath = `${basePath}/order/${params.transaction_id}`;
  const auth = await getAuthViewState(detailPath, basePath);
  const { website, products, locations, faqs, blogPosts } = tenant;
  const transactionPath = `/api/transactions/${encodeURIComponent(params.transaction_id)}`;
  const websiteQuery = `?website_id=${encodeURIComponent(website.id)}`;

  // Sinkron status (escrow / payment-service / aset digital) dulu — best-effort:
  // gagal di sini tidak menghalangi detail tampil dengan status terakhir di DB.
  const syncResult = await backendFetch<TransactionSyncResult>(`${transactionPath}/sync${websiteQuery}`, { method: 'POST' });
  if (syncResult.status === 401) {
    redirect(`/auth/login?next=${encodeURIComponent(detailPath)}`);
  }
  if (syncResult.status >= 500 || syncResult.data?.synced === false) {
    console.error(
      `[order-detail] sync ${params.transaction_id} -> ${syncResult.status} ${syncResult.data?.sync_errors?.join(',') ?? syncResult.error ?? ''}`,
    );
  }

  const result = await backendFetch<TransactionDetail>(`${transactionPath}${websiteQuery}`);
  if (result.status === 401) {
    redirect(`/auth/login?next=${encodeURIComponent(detailPath)}`);
  }
  if (result.status !== 404 && (result.status >= 400 || !result.data)) {
    // Error server/jaringan — jangan disamarkan jadi 404 (transaksinya bisa jadi ada).
    console.error(`[order-detail] load ${params.transaction_id} -> ${result.status} ${result.error ?? ''}`);
    return <TransactionLoadError retryHref={detailPath} ordersHref={`${basePath}/orders`} />;
  }
  if (!result.data) {
    // Link lama yang masih memakai order ID — arahkan ke URL yang benar.
    const orderResult = await backendFetch<OrderDetail>(`/api/orders/${encodeURIComponent(params.transaction_id)}`);
    if (orderResult.status === 401) {
      redirect(`/auth/login?next=${encodeURIComponent(detailPath)}`);
    }
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
        profile={{ name: website.name, tagline: website.tagline ?? undefined, logoUrl: website.logo_url ?? undefined, whatsapp: website.whatsapp ?? undefined, phone: website.phone ?? undefined, email: website.email ?? undefined, socialLinks: website.social_links, footerSettings: website.footer_settings }}
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
