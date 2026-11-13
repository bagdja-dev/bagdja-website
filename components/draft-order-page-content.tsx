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
import type { TemplateRenderProps } from '../lib/template-registry';
import { resolveTenantLinkBase } from '../lib/tenant-link-base';
import { sanitizeWebsiteTheme } from '../lib/website-theme';
import { renderPinnedTenantHeader, renderPinnedTenantTemplate } from '../lib/template-runtime-route';
import { buildSystemPageProps } from '../lib/system-page-props';
import { loadGatheringPlanTemplatePage } from '../lib/template-page-loaders';
import { hostRendererSlug, templateOwnsPage, tenantRuntime, tenantTemplateTheme } from '../lib/tenant-template';
import type { GatheringPlanDetail, OrderDetail } from './order-detail-content';
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
  if (!result.data || result.status >= 400) {
    // Tautan lama dari kartu referensi chat Studio membawa ID kelompok gathering, bukan ID order.
    // Bila ID ini rencana milik user, arahkan ke order rencananya; selain itu tetap 404.
    const plan = await backendFetch<{ order_id?: string | null }>(
      `/api/gathering/plans/${encodeURIComponent(orderId)}?website_id=${encodeURIComponent(website.id)}`,
    );
    const planOrderId = plan.status < 400 ? plan.data?.order_id : null;
    if (planOrderId && planOrderId !== orderId) redirect(`${basePath}/cart/order/${encodeURIComponent(planOrderId)}`);
    notFound();
  }
  if (result.data.transaction_id) {
    redirect(transactionHref(basePath, result.data.transaction_id));
  }

  const gatheringMeta = result.data.metadata?.gathering;
  let gatheringPlan: GatheringPlanDetail | null = null;
  if (gatheringMeta?.role === 'initiator' && gatheringMeta.group_id) {
    const gatheringResult = await backendFetch<GatheringPlanDetail>(
      `/api/gathering/plans/${encodeURIComponent(gatheringMeta.group_id)}?website_id=${encodeURIComponent(website.id)}`,
    );
    if (gatheringResult.status === 401) {
      redirect(`/auth/login?next=${encodeURIComponent(`${basePath}/cart/order/${orderId}`)}`);
    }
    if (!gatheringResult.data || gatheringResult.status >= 400) notFound();
    gatheringPlan = gatheringResult.data;
  }

  // Rencana gathering milik template package bila manifest menyatakan `gathering_plan`.
  const runtime = tenantRuntime(website);
  if (gatheringPlan && runtime && templateOwnsPage(website, 'gathering_plan')) {
    const loaded = await loadGatheringPlanTemplatePage(gatheringPlan, website.id, 'initiator', basePath);
    if (loaded && 'unauthenticated' in loaded) {
      redirect(`/auth/login?next=${encodeURIComponent(`${basePath}/cart/order/${orderId}`)}`);
    }
    if (loaded) {
      const templatePage = await renderPinnedTenantTemplate({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        candidateDigest: runtime.candidateDigest,
        tenantSlug: website.slug,
        props: { ...buildSystemPageProps(tenant, { basePath, auth, sections: [] }), page: loaded.page },
      });
      if (templatePage) return <>{templatePage}</>;
    }
  }

  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();
  const sections: SectionEntry[] = [{ type: 'order_detail', content: { order: result.data, transaction: null, gatheringPlan } }];
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
    websiteSlug: basePath,
    websiteId: website.id,
    tenantSlug: website.slug,
    pages: website.pages.map(toNavPage),
    blogPosts: blogPosts.map(toBlogPostItem),
    auth,
  };
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
      <CartProvider slug={websiteSlug}>
        <Renderer
          {...props}
          hideHeader={designerHeader.active}
          orderDetailDesign={designerHeader.active ? 'store-classic' : undefined}
        />
      </CartProvider>
    </>
  );
}