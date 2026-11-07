import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getWebsiteBySlug } from '../../lib/api-client';
import { CartProvider } from '../../lib/cart';
import { loadTenantPageView } from '../../lib/tenant-page-view';
import WebsiteInactiveNotice from '../../components/website-inactive-notice';
import { getTemplateRenderer } from '../../lib/template-registry';

export const revalidate = 60;

interface TenantPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website) return {};

  return {
    title: website.name,
    description: website.tagline ?? undefined,
  };
}

export default async function TenantPage({ params }: TenantPageProps) {
  const view = await loadTenantPageView(params.website_slug);
  if (view.status === 'not_found') notFound();
  if (view.status === 'inactive') return <WebsiteInactiveNotice />;

  const Renderer = view.templateSlug ? getTemplateRenderer(view.templateSlug) : null;
  if (!Renderer) notFound();

  return (
    <CartProvider slug={params.website_slug}>
      <Renderer {...view.props} />
    </CartProvider>
  );
}
