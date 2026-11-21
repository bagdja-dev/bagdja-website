import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getHomePage, getWebsiteBySlug } from '../../lib/api-client';
import { CartProvider } from '../../lib/cart';
import { contentMetadata } from '../../lib/content-seo';
import { loadTenantPageView } from '../../lib/tenant-page-view';
import WebsiteInactiveNotice from '../../components/website-inactive-notice';
import { getTemplateRenderer } from '../../lib/template-registry';
import { renderPinnedTenantTemplate } from '../../lib/template-runtime-route';

export const revalidate = 60;

interface TenantPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const acceptLanguage = (await headers()).get('accept-language') ?? undefined;
  const [website, page] = await Promise.all([
    getWebsiteBySlug(params.website_slug),
    getHomePage(params.website_slug, { acceptLanguage }),
  ]);
  if (!website) return { robots: { index: false, follow: false } };

  return contentMetadata({
    slug: params.website_slug,
    path: '/',
    title: page?.seo_title?.trim() || website.name,
    description: page?.seo_description?.trim() || website.tagline,
    image: page?.seo_image?.trim() || website.logo_url,
    noIndex: page?.seo_no_index,
    website,
  });
}

export default async function TenantPage({ params }: TenantPageProps) {
  const acceptLanguage = (await headers()).get('accept-language') ?? undefined;
  const view = await loadTenantPageView(params.website_slug, undefined, { acceptLanguage });
  if (view.status === 'not_found') notFound();
  if (view.status === 'inactive') return <WebsiteInactiveNotice />;

  const runtime = view.tenant.website.template_runtime ?? null;
  if (runtime) {
    const runtimeTemplate = await renderPinnedTenantTemplate({
      templateSlug: runtime.slug,
      pinnedVersion: runtime.version,
      candidateDigest: runtime.candidateDigest,
      browserBundle: runtime.browserBundle,
      pageOverrides: runtime.pageOverrides,
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
