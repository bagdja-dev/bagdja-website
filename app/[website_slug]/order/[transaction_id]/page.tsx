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
import type { TemplateRenderProps } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';
import { renderPinnedTenantHeader, renderPinnedTenantTemplate } from '../../../../lib/template-runtime-route';
import type { TemplateRuntimeOrderAction } from '../../../../lib/template-runtime-bridge';
import type { OrderDetail, TransactionDetail } from '../../../../components/order-detail-content';
import { draftOrderHref, transactionHref } from '../../../../lib/order-href';

export const revalidate = 60;

function formatAmount(value: number): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function getOrderDetailActions(transaction: TransactionDetail, isGathering: boolean): TemplateRuntimeOrderAction[] {
  if (isGathering) return [];
  const actions: TemplateRuntimeOrderAction[] = [];
  if (transaction.status === 'PENDING_PAYMENT' || transaction.status === 'PENDING') {
    actions.push('order.retry_payment', 'order.cancel');
  } else if (transaction.status === 'HELD') {
    actions.push('order.dispute');
    const allFulfillmentComplete = !transaction.fulfillment ||
      Object.values(transaction.fulfillment).every((progress) =>
        progress.steps.every((step) => step.completed),
      );
    if (allFulfillmentComplete) actions.push('order.complete');
  }
  return actions;
}

function createOrderDetailPage(transaction: TransactionDetail, basePath: string) {
  const items = transaction.items ?? [];
  const isGathering = items.some((item) => Boolean(item.order?.gathering_invoice));
  const subtotal = items.reduce((sum, item) => {
    const amount = Number(item.total_amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const shipping = transaction.metadata?.shipping;
  const courierLabel = shipping
    ? `${shipping.courier_code.toUpperCase()}${shipping.courier_service_name || shipping.resolved_service ? ` — ${shipping.courier_service_name ?? shipping.resolved_service}` : ''}`
    : transaction.courier ?? undefined;
  const statusLabels: Record<string, string> = {
    PENDING: 'Menunggu pembayaran',
    PENDING_PAYMENT: 'Menunggu pembayaran',
    HELD: 'Pembayaran sukses',
    COMPLETED: 'Selesai',
    REFUNDED: 'Direfund',
    CLOSED: 'Ditutup',
    DISPUTED: 'Dalam sengketa',
    CANCELLED: 'Dibatalkan',
  };
  const amount = (value: number) => formatAmount(value);

  return {
    isGathering,
    page: {
      type: 'order_detail' as const,
      transaction: {
        title: isGathering ? 'Detail Pembayaran Gathering' : 'Detail Transaksi',
        ...(transaction.ref_number ? { reference: transaction.ref_number } : {}),
        statusLabel: statusLabels[transaction.status] ?? transaction.status,
        paymentModeLabel: isGathering ? 'Escrow seat' : 'Sudah checkout',
        createdAt: transaction.created_at,
        subtotalLabel: amount(subtotal),
        shippingLabel: shipping ? amount(transaction.shipping_cost ?? 0) : 'Ditentukan penjual',
        totalLabel: amount(transaction.total_amount),
        ...(courierLabel ? { courierLabel } : {}),
        ...(isGathering
          ? { statusMessage: `${statusLabels[transaction.status] ?? transaction.status}. Dana escrow seat akan diselesaikan oleh pengelola setelah konfirmasi acara.` }
          : { statusMessage: statusLabels[transaction.status] ?? transaction.status }),
        items: items.map((item, index) => {
          const product = item.order?.product;
          const invoice = item.order?.gathering_invoice;
          return {
            key: item.id || `item-${index}`,
            name: product?.name ?? 'Produk',
            ...(product?.description ? { description: product.description } : {}),
            quantity: item.quantity,
            unitPriceLabel: amount(item.unit_price),
            totalLabel: amount(item.total_amount),
            ...(product?.uom?.symbol ? { unit: product.uom.symbol } : {}),
            ...(product?.images?.[0] ? { image: product.images[0] } : {}),
            ...(invoice ? {
              detailHref: `${basePath}/gathering/invoice/${encodeURIComponent(invoice.registration_id)}`,
            } : {}),
          };
        }),
        ...(
          transaction.recipient_name ||
          transaction.phone ||
          transaction.address ||
          transaction.district ||
          transaction.city ||
          transaction.postal_code
            ? {
              shipping: {
                ...(transaction.recipient_name ? { recipient: transaction.recipient_name } : {}),
                ...(transaction.phone ? { phone: transaction.phone } : {}),
                ...( [
                  transaction.address,
                  transaction.district,
                  transaction.city,
                  transaction.postal_code,
                ].filter(Boolean).join(', ')
                  ? { address: [
                    transaction.address,
                    transaction.district,
                    transaction.city,
                    transaction.postal_code,
                  ].filter(Boolean).join(', ') }
                  : {}),
              },
            }
            : {}
        ),
      },
      actions: getOrderDetailActions(transaction, isGathering),
    },
  };
}

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
    websiteSlug: basePath,
    websiteId: website.id,
    tenantSlug: website.slug,
    pages: website.pages.map(toNavPage),
    blogPosts: blogPosts.map(toBlogPostItem),
    auth,
  };
  // Only the package version declaring the full order_detail contract owns this page.
  if (
    website.template?.slug === 'store-classic' &&
    website.template_runtime_version === '1.0.6'
  ) {
    const orderDetail = createOrderDetailPage(result.data, basePath);
    const templatePage = await renderPinnedTenantTemplate({
      templateSlug: website.template.slug,
      pinnedVersion: website.template_runtime_version,
      tenantSlug: website.slug,
      props: { ...props, page: orderDetail.page },
      orderActionContext: {
        transactionId: result.data.id,
        actions: orderDetail.page.actions,
      },
    });
    if (templatePage) return templatePage;
  }
  const designerHeader = website.template?.slug === 'store-classic'
    ? await renderPinnedTenantHeader({
        templateSlug: website.template.slug,
        pinnedVersion: website.template_runtime_version,
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
          orderDetailDesign={designerHeader.active ? 'store-classic' : undefined}
        />
      </CartProvider>
    </>
  );
}
