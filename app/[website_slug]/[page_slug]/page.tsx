import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getWebsiteBySlug } from '../../../lib/api-client';
import { CartProvider } from '../../../lib/cart';
import { loadTenantPageView } from '../../../lib/tenant-page-view';
import WebsiteInactiveNotice from '../../../components/website-inactive-notice';
import { getTemplateRenderer } from '../../../lib/template-registry';
import { renderPinnedTenantTemplate } from '../../../lib/template-runtime-route';

export const revalidate = 60;

interface TenantSubPageProps {
  params: { website_slug: string; page_slug: string };
}

export async function generateMetadata({ params }: TenantSubPageProps): Promise<Metadata> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website) return {};

  const page = website.pages.find((p) => p.slug === params.page_slug);
  return {
    title: page ? `${page.title} · ${website.name}` : website.name,
    description: website.tagline ?? undefined,
  };
}

export default async function TenantSubPage({ params }: TenantSubPageProps) {
  const view = await loadTenantPageView(params.website_slug, params.page_slug);
  if (view.status === 'not_found') notFound();
  if (view.status === 'inactive') return <WebsiteInactiveNotice />;

  if (view.templateSlug) {
    const runtimeTemplate = await renderPinnedTenantTemplate({
      templateSlug: view.templateSlug,
      pinnedVersion: view.tenant.website.template_runtime_version,
      tenantSlug: params.website_slug,
      props: view.props,
    });
    if (runtimeTemplate) return runtimeTemplate;
  }

  const Renderer = view.templateSlug ? getTemplateRenderer(view.templateSlug) : null;
  if (!Renderer) notFound();

  return (
    <CartProvider slug={params.website_slug}>
      <Renderer {...view.props} />
    </CartProvider>
  );
}
